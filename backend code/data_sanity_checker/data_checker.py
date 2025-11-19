import json
import os
from typing import Dict, List, Tuple, Any, Optional
from difflib import SequenceMatcher
import re


class DataConsistencyChecker:
    def __init__(self):
        self.files_data = {}
        self.inconsistencies = []
        self.field_mappings = {}

    def load_json_files(self, file_paths: List[str]) -> Dict[str, Any]:
        """Load multiple JSON files and return their data."""
        self.files_data = {}

        for file_path in file_paths:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    filename = os.path.basename(file_path)
                    self.files_data[filename] = data
            except Exception as e:
                raise Exception(f"Error loading {file_path}: {str(e)}")

        return self.files_data

    def detect_key_fields(self, file1_data: Dict, file2_data: Dict) -> List[Tuple[str, str, float]]:
        """Auto-detect potential key field mappings between two files."""
        file1_fields = self._get_all_fields(file1_data)
        file2_fields = self._get_all_fields(file2_data)

        candidates = []

        # Look for ID fields
        for field1 in file1_fields:
            for field2 in file2_fields:
                if self._is_id_field(field1) and self._is_id_field(field2):
                    similarity = self._calculate_similarity(field1, field2)
                    if similarity > 0.3:  # Threshold for ID field matching
                        candidates.append((field1, field2, similarity))

        # Look for other common fields
        for field1 in file1_fields:
            for field2 in file2_fields:
                if not self._is_id_field(field1) and not self._is_id_field(field2):
                    similarity = self._calculate_similarity(field1, field2)
                    if similarity > 0.6:  # Higher threshold for non-ID fields
                        candidates.append((field1, field2, similarity))

        # Sort by similarity score
        candidates.sort(key=lambda x: x[2], reverse=True)
        return candidates[:5]  # Return top 5 candidates

    def _is_id_field(self, field_name: str) -> bool:
        """Check if a field is likely an ID field."""
        id_patterns = ['id', 'key', 'pk', 'primary']
        field_lower = field_name.lower()
        return any(pattern in field_lower for pattern in id_patterns)

    def _calculate_similarity(self, field1: str, field2: str) -> float:
        """Calculate similarity between two field names."""
        norm1 = re.sub(r'[_\s]+', '_', field1.lower())
        norm2 = re.sub(r'[_\s]+', '_', field2.lower())

        if norm1 == norm2:
            return 1.0
        if norm1 in norm2 or norm2 in norm1:
            return 0.8

        return SequenceMatcher(None, norm1, norm2).ratio()

    def _get_all_fields(self, data: Dict) -> List[str]:
        """Extract all field names from JSON data."""
        fields = set()

        if isinstance(data, dict):
            for key, value in data.items():
                fields.add(key)
                if isinstance(value, dict):
                    fields.update(self._get_all_fields(value))
                elif isinstance(value, list) and value and isinstance(value[0], dict):
                    fields.update(self._get_all_fields(value[0]))

        return list(fields)

    def set_field_mappings(self, mappings: Dict[str, Dict[str, str]]):
        """Set field mappings for file pairs."""
        self.field_mappings = mappings

    def detect_inconsistencies(self, file1_name: str, file2_name: str,
                             key_mapping: Dict[str, str],
                             source_of_truth: str = None,
                             custom_field_mappings: List[Dict] = None) -> List[Dict]:
        """Detect inconsistencies between two files."""
        if file1_name not in self.files_data or file2_name not in self.files_data:
            raise ValueError("Files not loaded")

        file1_data = self.files_data[file1_name]
        file2_data = self.files_data[file2_name]

        inconsistencies = []

        key_field1 = key_mapping.get('file1_key')
        key_field2 = key_mapping.get('file2_key')

        if not key_field1 or not key_field2:
            raise ValueError("Key fields not specified")

        if custom_field_mappings:
            fields_to_compare = []
            for mapping in custom_field_mappings:
                file1_field = mapping.get('file1_field')
                file2_field = mapping.get('file2_field')
                if file1_field and file2_field:
                    fields_to_compare.append({
                        'file1_field': file1_field,
                        'file2_field': file2_field,
                        'display_name': f"{file1_field} ↔ {file2_field}"
                    })
        else:
            common_fields = self._find_common_fields(file1_data, file2_data)
            fields_to_compare = [{'file1_field': field, 'file2_field': field, 'display_name': field}
                               for field in common_fields]

        matched_records = self._match_records(file1_data, file2_data, key_field1, key_field2)

        for record_id, (record1, record2) in matched_records.items():
            for field_mapping in fields_to_compare:
                file1_field = field_mapping['file1_field']
                file2_field = field_mapping['file2_field']
                display_name = field_mapping['display_name']

                if file1_field in record1 and file2_field in record2:
                    value1 = record1[file1_field]
                    value2 = record2[file2_field]

                    if not self._values_equal(value1, value2):
                        inconsistencies.append({
                            'file1_name': file1_name,
                            'file2_name': file2_name,
                            'record_id': record_id,
                            'field_name': display_name,
                            'file1_field': file1_field,
                            'file2_field': file2_field,
                            'value1': value1,
                            'value2': value2,
                            'source_of_truth': source_of_truth
                        })

        return inconsistencies

    def _find_common_fields(self, data1: Dict, data2: Dict) -> List[str]:
        fields1 = self._get_all_fields(data1)
        fields2 = self._get_all_fields(data2)

        common = set(fields1) & set(fields2)

        key_fields = set()
        for mapping in self.field_mappings.values():
            key_fields.add(mapping.get('file1_key', ''))
            key_fields.add(mapping.get('file2_key', ''))

        common = common - key_fields
        return list(common)

    def _match_records(self, data1: Dict, data2: Dict, key_field1: str, key_field2: str) -> Dict[str, Tuple[Dict, Dict]]:
        matched = {}

        data2_lookup = {}
        for key, record in data2.items():
            if isinstance(record, dict) and key_field2 in record:
                record_key = str(record[key_field2])
                data2_lookup[record_key] = record

        for key, record in data1.items():
            if isinstance(record, dict) and key_field1 in record:
                record_key = str(record[key_field1])
                if record_key in data2_lookup:
                    matched[record_key] = (record, data2_lookup[record_key])

        return matched

    def _values_equal(self, value1: Any, value2: Any) -> bool:
        if value1 is None and value2 is None:
            return True
        if value1 is None or value2 is None:
            return False

        str1 = str(value1).strip().lower()
        str2 = str(value2).strip().lower()

        return str1 == str2

    def fix_inconsistencies(self, inconsistencies: List[Dict],
                          source_of_truth: str) -> Dict[str, Dict]:
        fixed_files = {}

        # Group inconsistencies by file
        file_inconsistencies = {}
        for inc in inconsistencies:
            file_name = inc['file2_name'] if source_of_truth == inc['file1_name'] else inc['file1_name']
            if file_name not in file_inconsistencies:
                file_inconsistencies[file_name] = []
            file_inconsistencies[file_name].append(inc)

        for file_name, file_incs in file_inconsistencies.items():
            if file_name not in self.files_data:
                continue

            fixed_data = self.files_data[file_name].copy()

            for inc in file_incs:
                record_id = inc['record_id']
                field_name = inc['field_name']

                if source_of_truth == inc['file1_name']:
                    field_to_update = inc.get('file2_field', field_name)
                    value_to_use = inc['value1']
                else:
                    field_to_update = inc.get('file1_field', field_name)
                    value_to_use = inc['value2']

                for key, record in fixed_data.items():
                    if isinstance(record, dict):
                        key_field = None
                        for field in record.keys():
                            if 'id' in field.lower():
                                key_field = field
                                break

                        if key_field and str(record[key_field]) == record_id:
                            record[field_to_update] = value_to_use
                            break

            fixed_files[file_name] = fixed_data

        return fixed_files

    def get_summary_stats(self, inconsistencies: List[Dict]) -> Dict[str, Any]:
        total_inconsistencies = len(inconsistencies)
        affected_records = len(set(inc['record_id'] for inc in inconsistencies))

        field_counts = {}
        for inc in inconsistencies:
            field = inc['field_name']
            field_counts[field] = field_counts.get(field, 0) + 1

        return {
            'total_inconsistencies': total_inconsistencies,
            'affected_records': affected_records,
            'field_counts': field_counts,
            'files_involved': list(set(inc['file1_name'] for inc in inconsistencies) |
                                 set(inc['file2_name'] for inc in inconsistencies))
        }
