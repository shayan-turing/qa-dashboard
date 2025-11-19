from flask import Blueprint, request, jsonify
import tempfile
import zipfile
import os
import shutil
from .sanity_checks import generate_sanity_report

sanity_bp = Blueprint("api_sanity_check", __name__, url_prefix="/api_sanity_check")

# In-memory cache of the last generated report
_LAST_REPORT = {"report": None, "tools_info_path": None, "report_path": None}


@sanity_bp.route("/upload", methods=["POST"])
def upload_and_run():
	"""Accept a ZIP upload (form field 'zip_file' or 'file'), extract and run sanity check.
	Returns the generated report JSON.
	"""
	if 'zip_file' in request.files:
		f = request.files['zip_file']
	elif 'file' in request.files:
		f = request.files['file']
	else:
		return jsonify({"error": "zip_file (or file) is required"}), 400

	filename = f.filename or "upload.zip"
	if not filename.lower().endswith('.zip'):
		return jsonify({"error": "only .zip archives are supported"}), 400

	tmp_dir = tempfile.mkdtemp(prefix="sanity_upload_")
	try:
		zpath = os.path.join(tmp_dir, filename)
		f.save(zpath)
		extract_dir = os.path.join(tmp_dir, "extracted")
		os.makedirs(extract_dir, exist_ok=True)
		with zipfile.ZipFile(zpath, 'r') as zf:
			zf.extractall(extract_dir)

		# The repo may have a top-level folder inside the zip; try to locate the folder
		# that contains get_set_APIs.yaml
		candidate = None
		for root, dirs, files in os.walk(extract_dir):
			if 'get_set_APIs.yaml' in files:
				candidate = root
				break
		if candidate is None:
			return jsonify({"error": "uploaded zip does not contain get_set_APIs.yaml"}), 400

		report, tools_info_path, report_path = generate_sanity_report(candidate, write_files=False)

		# cache last
		_LAST_REPORT['report'] = report
		_LAST_REPORT['tools_info_path'] = tools_info_path
		_LAST_REPORT['report_path'] = report_path

		return jsonify(report)
	except zipfile.BadZipFile:
		return jsonify({"error": "invalid zip file"}), 400
	finally:
		try:
			shutil.rmtree(tmp_dir)
		except Exception:
			pass


@sanity_bp.route('/last', methods=['GET'])
def get_last_report():
	"""Return the last generated report (from in-memory cache)."""
	if _LAST_REPORT['report'] is None:
		return jsonify({"error": "no report generated yet"}), 404
	return jsonify(_LAST_REPORT['report'])
