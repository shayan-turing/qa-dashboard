from flask import Blueprint, request, jsonify, send_file
import tempfile
import zipfile
import os
import shutil
import json
from datetime import datetime, timezone
from bson import ObjectId
from flask_jwt_extended import jwt_required, get_jwt_identity
from pymongo import MongoClient
from dotenv import load_dotenv
from .sanity_checks import generate_sanity_report

# DB Setup
load_dotenv()
mongo = MongoClient(os.getenv("MONGO_URI"))
db = mongo["docdiff"]

def oid(x): return ObjectId(str(x))
def now(): return datetime.now(timezone.utc)

sanity_bp = Blueprint("api_sanity_check", __name__, url_prefix="/api_sanity_check")


@sanity_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_and_run():
	"""Accept a ZIP upload (form field 'zip_file' or 'file'), extract and run sanity check.
	Returns the generated report JSON.
	"""
	uid = get_jwt_identity()

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

		# Save to database
		doc = {
			"user_id": oid(uid),
			"title": f"API Sanity Check - {now().isoformat()}",
			"results": report,
			"status": "completed",
			"report_type": "api_sanity",
			"created_at": now()
		}
		result = db.reports.insert_one(doc)
		doc["_id"] = str(result.inserted_id)
		doc["user_id"] = uid

		return jsonify(doc)
	except zipfile.BadZipFile:
		return jsonify({"error": "invalid zip file"}), 400
	finally:
		try:
			shutil.rmtree(tmp_dir)
		except Exception:
			pass


@sanity_bp.route('/reports', methods=['GET'])
@sanity_bp.route('/reports/<report_id>', methods=['GET'])
@jwt_required()
def get_reports(report_id=None):
	"""Return all reports for the user, or a specific report by id."""
	uid = get_jwt_identity()
	
	if report_id:
		# Get specific report
		try:
			report = db.reports.find_one({
				"_id": ObjectId(report_id),
				"user_id": oid(uid),
				"report_type": "api_sanity"
			})
			if not report:
				return jsonify({"error": "report not found"}), 404
			report["_id"] = str(report["_id"])
			report["user_id"] = uid
			return jsonify(report)
		except Exception:
			return jsonify({"error": "invalid report id"}), 400
	else:
		# List all reports
		reports = list(db.reports.find({
			"user_id": oid(uid),
			"report_type": "api_sanity"
		}).sort("created_at", -1))
		for r in reports:
			r["_id"] = str(r["_id"])
			r["user_id"] = uid
		return jsonify(reports)


@sanity_bp.route('/reports/<report_id>/download', methods=['GET'])
@jwt_required()
def download_report(report_id):
	"""Download a specific report as JSON file."""
	uid = get_jwt_identity()
	
	try:
		report = db.reports.find_one({
			"_id": ObjectId(report_id),
			"user_id": oid(uid),
			"report_type": "api_sanity"
		})
		if not report:
			return jsonify({"error": "report not found"}), 404
		
		# Create a temporary file with the report JSON
		import io
		report_json = json.dumps(report, indent=2, default=str)
		report_io = io.BytesIO(report_json.encode('utf-8'))
		report_io.seek(0)
		
		filename = f"api_sanity_report_{report_id}.json"
		return send_file(
			report_io,
			mimetype='application/json',
			as_attachment=True,
			download_name=filename
		)
	except Exception:
		return jsonify({"error": "invalid report id"}), 400


@sanity_bp.route('/deletions', methods=['DELETE'])
@sanity_bp.route('/deletions/<report_id>', methods=['DELETE'])
@jwt_required()
def delete_reports(report_id=None):
	"""Delete all reports for the user, or a specific report by id."""
	uid = get_jwt_identity()
	
	if report_id:
		# Delete specific report
		try:
			result = db.reports.delete_one({
				"_id": ObjectId(report_id),
				"user_id": oid(uid),
				"report_type": "api_sanity"
			})
			if result.deleted_count == 0:
				return jsonify({"error": "report not found"}), 404
			return jsonify({"message": "report deleted"})
		except Exception:
			return jsonify({"error": "invalid report id"}), 400
	else:
		# Delete all reports
		result = db.reports.delete_many({
			"user_id": oid(uid),
			"report_type": "api_sanity"
		})
		return jsonify({"message": f"{result.deleted_count} reports deleted"})