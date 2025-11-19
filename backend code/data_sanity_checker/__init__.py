from flask import Blueprint, request, jsonify, session, send_file
import tempfile
import os
import json
import uuid
from .data_checker import DataConsistencyChecker
from .data_generator import DataGenerator

data_bp = Blueprint("data_sanity_checker", __name__, url_prefix="/data_sanity_checker")

# Global checker instance per-process (stateless between sessions)
checker = DataConsistencyChecker()


@data_bp.route('/upload', methods=['POST'])
def upload_files():
    try:
        if 'files' not in request.files:
            return jsonify({'error': 'No files uploaded'}), 400

        files = request.files.getlist('files')
        if not files or all(f.filename == '' for f in files):
            return jsonify({'error': 'No files selected'}), 400

        session_id = str(uuid.uuid4())
        temp_dir = os.path.join(tempfile.gettempdir(), f'data_checker_{session_id}')
        os.makedirs(temp_dir, exist_ok=True)

        uploaded_files = []
        for file in files:
            if file and file.filename.endswith('.json'):
                filename = file.filename
                file_path = os.path.join(temp_dir, filename)
                file.save(file_path)
                uploaded_files.append(file_path)

        if not uploaded_files:
            return jsonify({'error': 'No valid JSON files uploaded'}), 400

        checker.load_json_files(uploaded_files)

        session['temp_dir'] = temp_dir
        session['uploaded_files'] = [os.path.basename(f) for f in uploaded_files]

        # Auto-detect field mappings
        file_names = list(checker.files_data.keys())
        mappings = {}

        if len(file_names) >= 2:
            for i in range(len(file_names)):
                for j in range(i + 1, len(file_names)):
                    file1, file2 = file_names[i], file_names[j]
                    candidates = checker.detect_key_fields(
                        checker.files_data[file1],
                        checker.files_data[file2]
                    )

                    mapping_key = f"{file1}_vs_{file2}"
                    if candidates:
                        mappings[mapping_key] = {
                            'file1': file1,
                            'file2': file2,
                            'file1_key': candidates[0][0],
                            'file2_key': candidates[0][1],
                            'candidates': candidates[:3]
                        }

        return jsonify({'success': True, 'files': file_names, 'mappings': mappings})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@data_bp.route('/get-fields/<filename>')
def get_file_fields(filename):
    try:
        if filename not in checker.files_data:
            return jsonify({'error': 'File not found'}), 404

        data = checker.files_data[filename]
        fields = set()
        if isinstance(data, dict):
            for record in data.values():
                if isinstance(record, dict):
                    fields.update(record.keys())

        return jsonify({'success': True, 'fields': list(fields)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@data_bp.route('/detect', methods=['POST'])
def detect_inconsistencies():
    try:
        data = request.get_json() or {}
        file1 = data.get('file1')
        file2 = data.get('file2')
        key_mapping = data.get('key_mapping', {})
        source_of_truth = data.get('source_of_truth')
        custom_field_mappings = data.get('custom_field_mappings', [])

        if not file1 or not file2:
            return jsonify({'error': 'File selection required'}), 400

        if not key_mapping.get('file1_key') or not key_mapping.get('file2_key'):
            return jsonify({'error': 'Key field mapping required'}), 400

        inconsistencies = checker.detect_inconsistencies(
            file1, file2, key_mapping, source_of_truth, custom_field_mappings
        )

        stats = checker.get_summary_stats(inconsistencies)
        return jsonify({'success': True, 'inconsistencies': inconsistencies, 'stats': stats})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@data_bp.route('/fix', methods=['POST'])
def fix_data():
    try:
        data = request.get_json() or {}
        inconsistencies = data.get('inconsistencies', [])
        source_of_truth = data.get('source_of_truth')

        if not inconsistencies:
            return jsonify({'error': 'No inconsistencies to fix'}), 400

        if not source_of_truth:
            return jsonify({'error': 'Source of truth not specified'}), 400

        fixed_files = checker.fix_inconsistencies(inconsistencies, source_of_truth)

        temp_dir = session.get('temp_dir')
        if not temp_dir:
            return jsonify({'error': 'Session expired'}), 400

        fixed_file_paths = {}
        for filename, fixed_data in fixed_files.items():
            fixed_filename = f"fixed_{filename}"
            fixed_path = os.path.join(temp_dir, fixed_filename)
            with open(fixed_path, 'w', encoding='utf-8') as f:
                json.dump(fixed_data, f, indent=2, ensure_ascii=False)
            fixed_file_paths[filename] = fixed_filename

        return jsonify({'success': True, 'fixed_files': fixed_file_paths})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@data_bp.route('/download/<filename>')
def download_file(filename):
    try:
        temp_dir = session.get('temp_dir')
        if not temp_dir:
            return jsonify({'error': 'Session expired'}), 400

        file_path = os.path.join(temp_dir, filename)
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404

        return send_file(file_path, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@data_bp.route('/cleanup', methods=['POST'])
def cleanup():
    try:
        temp_dir = session.get('temp_dir')
        if temp_dir and os.path.exists(temp_dir):
            import shutil
            shutil.rmtree(temp_dir)
        session.pop('temp_dir', None)
        session.pop('uploaded_files', None)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@data_bp.route('/clear-session', methods=['POST'])
def clear_session():
    try:
        session.clear()
        return jsonify({'success': True, 'message': 'Session cleared'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@data_bp.route('/debug-session', methods=['GET'])
def debug_session():
    try:
        parsed_tables = session.get('parsed_tables', [])
        schema_text = session.get('current_generator_schema', '')
        current_tables = session.get('parsed_tables', [])
        relationships = session.get('relationships', {})

        if schema_text and not relationships:
            try:
                generator = DataGenerator(schema_text=schema_text)
                current_tables = list(generator.schema.keys())
                relationships = {}
                for table_name, table_info in generator.schema.items():
                    if 'foreign_keys' in table_info and table_info['foreign_keys']:
                        relationships[table_name] = table_info['foreign_keys']
            except Exception:
                current_tables = [f"Error parsing schema"]

        session_data = {
            'keys': list(session.keys()),
            'has_generator_schema': bool(session.get('current_generator_schema')),
            'generator_schema_length': len(session.get('current_generator_schema', '')),
            'parsed_tables': parsed_tables,
            'current_tables_from_schema': current_tables,
            'relationships': relationships,
            'temp_dir': session.get('temp_dir'),
            'uploaded_files': session.get('uploaded_files')
        }
        return jsonify({'success': True, 'session': session_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@data_bp.route('/test-session', methods=['POST'])
def test_session():
    try:
        data = request.get_json() or {}
        test_value = data.get('test_value', 'test')
        session['test_key'] = test_value
        session.permanent = True
        return jsonify({'success': True, 'stored_value': test_value, 'session_keys': list(session.keys())})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@data_bp.route('/get-session-test', methods=['GET'])
def get_session_test():
    try:
        test_value = session.get('test_key', 'No test value found')
        return jsonify({'success': True, 'test_value': test_value, 'session_keys': list(session.keys())})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Data Generator Routes
@data_bp.route('/parse-schema', methods=['POST'])
def parse_schema():
    try:
        data = request.get_json() or {}
        schema_text = data.get('schema_text', '')
        if not schema_text.strip():
            return jsonify({'error': 'Schema text is required'}), 400

        generator = DataGenerator(schema_text=schema_text)
        tables = generator.get_available_tables()

        relationships = {}
        for table_name, table_info in generator.schema.items():
            if 'foreign_keys' in table_info and table_info['foreign_keys']:
                relationships[table_name] = table_info['foreign_keys']

        session['current_generator_schema'] = schema_text
        session['parsed_tables'] = tables
        session['relationships'] = relationships
        session.permanent = True
        session.modified = True

        return jsonify({'success': True, 'tables': tables, 'table_count': len(tables), 'relationships': relationships})
    except Exception as e:
        return jsonify({'error': f'Failed to parse schema: {str(e)}'}), 500


@data_bp.route('/generate-data', methods=['POST'])
def generate_data():
    try:
        data = request.get_json() or {}
        output_folder = data.get('output_folder')
        records_per_table = data.get('records_per_table', 50)
        selected_tables = data.get('selected_tables', [])
        schema_text = data.get('schema_text')

        if not output_folder:
            return jsonify({'error': 'Output folder name is required'}), 400
        if not selected_tables:
            return jsonify({'error': 'Please select at least one table'}), 400

        if not schema_text:
            schema_text = session.get('current_generator_schema')

        if schema_text and len(schema_text) > 0:
            generator = DataGenerator(schema_text=schema_text)
        else:
            return jsonify({'error': 'No schema provided. Please paste your database schema in the textarea and try again.'}), 400

        output_path = os.path.join('generated_data', output_folder)
        os.makedirs(output_path, exist_ok=True)

        generated_files = {}
        existing_data = {}

        available_tables = list(generator.schema.keys())
        missing_tables = [t for t in selected_tables if t not in available_tables]
        if missing_tables:
            return jsonify({'error': f"Tables not found in schema: {missing_tables}. Available tables: {available_tables}"}), 400

        def get_dependency_order(tables):
            ordered = []
            remaining = set(tables)
            while remaining:
                ready = []
                for table in remaining:
                    table_schema = generator.schema[table]
                    foreign_keys = table_schema.get('foreign_keys', [])
                    if not foreign_keys or all(fk['ref_table'] in ordered for fk in foreign_keys):
                        ready.append(table)
                if not ready:
                    ready = list(remaining)
                ordered.extend(ready)
                remaining -= set(ready)
            return ordered

        ordered_tables = get_dependency_order(selected_tables)

        for table_name in ordered_tables:
            table_data = generator.generate_data(table_name, records_per_table, existing_data)
            existing_data[table_name] = table_data
            filename = f"{table_name}.json"
            filepath = os.path.join(output_path, filename)
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(table_data, f, indent=2, ensure_ascii=False)
            generated_files[table_name] = filename

        return jsonify({'success': True, 'generated_files': generated_files, 'output_folder': output_folder, 'total_records': sum(len(existing_data[table]) for table in selected_tables)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
