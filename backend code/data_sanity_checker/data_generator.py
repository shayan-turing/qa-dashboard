import json
import os
import uuid
import random
from datetime import datetime, timedelta
from typing import Dict, List, Any
import re
from faker import Faker


class DataGenerator:
    def __init__(self, schema_text=None):
        self.fake = Faker()
        if schema_text:
            self.schema = self._parse_schema_from_text(schema_text)
        else:
            self.schema = {}

    def _parse_schema_from_text(self, schema_text: str) -> Dict[str, Dict]:
        schema = {}
        current_table = None
        in_relationships_section = False

        lines = schema_text.split('\n')

        for line in lines:
            line = line.strip()

            if line.lower().startswith('// relationships') or line.lower().startswith('relationships'):
                in_relationships_section = True
                continue

            if not line or (line.startswith('//') and not line.lower().startswith('// relationships')) or line.startswith('#') or line.startswith('--'):
                continue

            if (line.startswith('Table ') or line.startswith('CREATE TABLE ') or line.startswith('table ') or line.startswith('create table ')):
                if line.startswith('Table '):
                    table_name = line.split()[1].strip('{')
                elif line.startswith('CREATE TABLE ') or line.startswith('create table '):
                    table_name = line.split()[2].strip('(').strip('`').strip('"').strip("'")
                else:
                    table_name = line.split()[1].strip('{')

                schema[table_name] = {
                    'fields': {},
                    'primary_key': None,
                    'foreign_keys': []
                }
                current_table = table_name
                in_relationships_section = False

            elif current_table and (' ' in line or '\t' in line) and not line.startswith('}') and not in_relationships_section:
                if '\t' in line:
                    parts = line.split('\t')
                else:
                    parts = line.split()

                if len(parts) >= 2:
                    field_name = parts[0].strip('`').strip('"').strip("'")
                    field_type = parts[1].strip('`').strip('"').strip("'")
                    field_type = self._normalize_field_type(field_type)

                    if 'primary key' in line.lower() or 'PRIMARY KEY' in line:
                        schema[current_table]['primary_key'] = field_name

                    if 'ref:' in line or 'REFERENCES' in line.upper():
                        ref_match = re.search(r'ref:\s*>\s*(\w+)\.(\w+)', line)
                        if not ref_match:
                            ref_match = re.search(r'REFERENCES\s+(\w+)\s*\((\w+)\)', line, re.IGNORECASE)
                        if ref_match:
                            schema[current_table]['foreign_keys'].append({
                                'field': field_name,
                                'ref_table': ref_match.group(1),
                                'ref_field': ref_match.group(2)
                            })

                    schema[current_table]['fields'][field_name] = {
                        'type': field_type,
                        'nullable': 'not null' not in line.lower(),
                        'unique': 'unique' in line.lower(),
                        'default': self._extract_default(line)
                    }

            elif in_relationships_section and line.startswith('Ref:'):
                ref_match = re.search(r'Ref:\s*(\w+)\.(\w+)\s*>\s*(\w+)\.(\w+)', line)
                if ref_match:
                    source_table = ref_match.group(1)
                    source_field = ref_match.group(2)
                    target_table = ref_match.group(3)
                    target_field = ref_match.group(4)

                    if source_table in schema:
                        schema[source_table]['foreign_keys'].append({
                            'field': source_field,
                            'ref_table': target_table,
                            'ref_field': target_field
                        })
                    else:
                        print(f"Warning: Source table {source_table} not found in schema")

        return schema

    def _normalize_field_type(self, field_type: str) -> str:
        field_type = field_type.lower().strip()
        type_mapping = {
            'varchar': 'varchar', 'char': 'varchar', 'text': 'text', 'longtext': 'text', 'mediumtext': 'text', 'tinytext': 'text',
            'int': 'int', 'integer': 'int', 'bigint': 'int', 'smallint': 'int', 'tinyint': 'int',
            'decimal': 'decimal', 'float': 'decimal', 'double': 'decimal', 'numeric': 'decimal',
            'date': 'date', 'datetime': 'timestamp', 'timestamp': 'timestamp', 'time': 'timestamp', 'year': 'date',
            'boolean': 'boolean', 'bool': 'boolean', 'bit': 'boolean', 'enum': 'enum', 'set': 'enum', 'json': 'text',
            'blob': 'text', 'longblob': 'text', 'mediumblob': 'text', 'tinyblob': 'text'
        }
        base_type = field_type.split('(')[0]
        return type_mapping.get(base_type, 'varchar')

    def _extract_default(self, line: str) -> Any:
        if 'default:' in line:
            default_match = re.search(r'default:\s*([^,\]]+)', line)
            if default_match:
                default_val = default_match.group(1).strip()
                if default_val == '`NOW()`':
                    return 'NOW()'
                elif default_val.startswith("'") and default_val.endswith("'"):
                    return default_val[1:-1]
                else:
                    return default_val
        return None

    def generate_data(self, table_name: str, count: int, existing_data: Dict[str, List] = None) -> List[Dict]:
        if table_name not in self.schema:
            available_tables = list(self.schema.keys())
            raise ValueError(f"Table '{table_name}' not found in schema. Available tables: {available_tables}")

        table_schema = self.schema[table_name]
        table_schema['table_name'] = table_name
        records = []

        related_table = self._find_related_table(table_name, existing_data)

        if related_table and related_table in existing_data:
            records = self._generate_related_records(table_name, table_schema, count, existing_data, related_table)
        else:
            for i in range(count):
                record = self._generate_consistent_record(table_schema, existing_data)
                records.append(record)

        return records

    def _find_related_table(self, table_name: str, existing_data: Dict[str, List] = None) -> str:
        if not existing_data:
            return None
        table_schema = self.schema[table_name]
        for fk in table_schema['foreign_keys']:
            ref_table = fk['ref_table']
            if ref_table in existing_data:
                ref_table_schema = self.schema.get(ref_table, {})
                for ref_fk in ref_table_schema.get('foreign_keys', []):
                    if ref_fk['ref_table'] == table_name:
                        return ref_table
                return ref_table
        return None

    def _generate_related_records(self, table_name: str, table_schema: Dict, count: int, existing_data: Dict, related_table: str) -> List[Dict]:
        records = []
        related_records = existing_data[related_table]

        fk_to_related = None
        for fk in table_schema['foreign_keys']:
            if fk['ref_table'] == related_table:
                fk_to_related = fk
                break

        if not fk_to_related:
            for i in range(count):
                record = self._generate_consistent_record(table_schema, existing_data)
                records.append(record)
            return records

        actual_count = min(count, len(related_records))

        for i in range(actual_count):
            record = {}
            related_record = related_records[i]
            first_name = related_record.get('first_name', self.fake.first_name())
            last_name = related_record.get('last_name', self.fake.last_name())

            for field_name, field_info in table_schema['fields'].items():
                field_lower = field_name.lower()
                if field_name == table_schema['primary_key']:
                    record[field_name] = self._generate_realistic_id(table_schema.get('table_name', 'unknown'), field_name)
                elif field_name == fk_to_related['field']:
                    related_pk = self.schema[related_table]['primary_key']
                    record[field_name] = related_record[related_pk]
                elif any(fk['field'] == field_name for fk in table_schema['foreign_keys']):
                    fk_info = next(fk for fk in table_schema['foreign_keys'] if fk['field'] == field_name)
                    if existing_data and fk_info['ref_table'] in existing_data and existing_data[fk_info['ref_table']]:
                        ref_values = [r[fk_info['ref_field']] for r in existing_data[fk_info['ref_table']] if fk_info['ref_field'] in r]
                        if ref_values:
                            record[field_name] = random.choice(ref_values)
                        else:
                            record[field_name] = self._generate_realistic_id(fk_info['ref_table'], fk_info['ref_field'])
                    else:
                        record[field_name] = self._generate_realistic_id(fk_info['ref_table'], fk_info['ref_field'])
                elif 'first_name' in field_lower:
                    record[field_name] = first_name
                elif 'last_name' in field_lower:
                    record[field_name] = last_name
                elif 'email' in field_lower:
                    record[field_name] = f"{first_name.lower()}.{last_name.lower()}@{self.fake.domain_name()}"
                elif 'work_email' in field_lower:
                    record[field_name] = f"{first_name.lower()}.{last_name.lower()}@company.com"
                else:
                    record[field_name] = self._generate_field_value(field_name, field_info, table_schema, existing_data)

            records.append(record)

        return records

    def _generate_consistent_record(self, table_schema: Dict, existing_data: Dict = None) -> Dict:
        record = {}
        first_name = self.fake.first_name()
        last_name = self.fake.last_name()

        for field_name, field_info in table_schema['fields'].items():
            field_lower = field_name.lower()
            field_type = field_info['type']

            if field_name == table_schema['primary_key']:
                record[field_name] = self._generate_realistic_id(table_schema.get('table_name', 'unknown'), field_name)
            elif any(fk['field'] == field_name for fk in table_schema['foreign_keys']):
                fk_info = next(fk for fk in table_schema['foreign_keys'] if fk['field'] == field_name)
                if existing_data and fk_info['ref_table'] in existing_data and existing_data[fk_info['ref_table']]:
                    ref_values = [record[fk_info['ref_field']] for record in existing_data[fk_info['ref_table']] if fk_info['ref_field'] in record]
                    if ref_values:
                        record[field_name] = random.choice(ref_values)
                    else:
                        record[field_name] = self._generate_realistic_id(fk_info['ref_table'], fk_info['ref_field'])
                else:
                    record[field_name] = self._generate_realistic_id(fk_info['ref_table'], fk_info['ref_field'])
            elif 'first_name' in field_lower:
                record[field_name] = first_name
            elif 'last_name' in field_lower:
                record[field_name] = last_name
            elif 'email' in field_lower:
                record[field_name] = f"{first_name.lower()}.{last_name.lower()}@{self.fake.domain_name()}"
            elif 'work_email' in field_lower:
                record[field_name] = f"{first_name.lower()}.{last_name.lower()}@company.com"
            elif 'phone' in field_lower or 'contact' in field_lower:
                record[field_name] = self.fake.phone_number()
            elif 'address' in field_lower:
                record[field_name] = self.fake.street_address()
            elif 'city' in field_lower:
                record[field_name] = self.fake.city()
            elif 'country' in field_lower:
                record[field_name] = self.fake.country()
            elif 'description' in field_lower or 'desc' in field_lower:
                record[field_name] = self.fake.text(max_nb_chars=200)
            elif 'title' in field_lower or 'job_title' in field_lower:
                record[field_name] = self.fake.job()
            elif 'company' in field_lower:
                record[field_name] = self.fake.company()
            elif 'url' in field_lower or 'link' in field_lower:
                record[field_name] = self.fake.url()
            elif 'path' in field_lower:
                record[field_name] = f"/{self.fake.word()}/{field_lower.replace('_', '-') }"
            elif 'key' in field_lower and 'id' not in field_lower:
                record[field_name] = f"{random.choice(['KEY', 'REF', 'CODE', 'ID'])}{random.randint(1000, 9999)}"
            else:
                record[field_name] = self._generate_field_value(field_name, field_info, table_schema, existing_data)

        return record

    def _generate_field_value(self, field_name: str, field_info: Dict, table_schema: Dict, existing_data: Dict = None) -> Any:
        field_type = field_info['type']

        if field_name == table_schema['primary_key']:
            return self._generate_realistic_id(table_schema.get('table_name', 'unknown'), field_name)

        for fk in table_schema['foreign_keys']:
            if fk['field'] == field_name:
                if existing_data and fk['ref_table'] in existing_data and existing_data[fk['ref_table']]:
                    ref_values = [record[fk['ref_field']] for record in existing_data[fk['ref_table']] if fk['ref_field'] in record]
                    if ref_values:
                        return random.choice(ref_values)
                    else:
                        return self._generate_realistic_id(fk['ref_table'], fk['ref_field'])
                else:
                    return self._generate_realistic_id(fk['ref_table'], fk['ref_field'])

        if field_info['default']:
            if field_info['default'] == 'NOW()':
                return datetime.now().isoformat()
            return field_info['default']

        if field_type == 'string':
            return self._generate_realistic_id(table_schema.get('table_name', 'unknown'), field_name)
        elif field_type == 'varchar':
            return self._generate_varchar(field_name)
        elif field_type == 'int':
            return self._generate_int(field_name)
        elif field_type == 'decimal':
            return self._generate_decimal(field_name)
        elif field_type == 'text':
            return self._generate_text(field_name)
        elif field_type == 'date':
            return self._generate_date()
        elif field_type == 'timestamp':
            return datetime.now().isoformat()
        elif field_type == 'enum':
            return self._generate_enum(field_name, field_info)
        elif field_type == 'boolean':
            return random.choice([True, False])
        else:
            return f"sample_{field_name}_{random.randint(1, 100)}"

    def _generate_realistic_id(self, table_name: str, field_name: str) -> str:
        table_lower = table_name.lower()
        field_lower = field_name.lower()

        if 'user' in table_lower:
            return f"USR{random.randint(1000, 9999)}"
        elif 'employee' in table_lower:
            return f"EMP{random.randint(1000, 9999)}"
        elif 'product' in table_lower:
            return f"PRD{random.randint(1000, 9999)}"
        elif 'order' in table_lower:
            return f"ORD{random.randint(1000, 9999)}"
        elif 'customer' in table_lower:
            return f"CST{random.randint(1000, 9999)}"
        elif 'department' in table_lower:
            return f"DEPT{random.randint(100, 999)}"
        elif 'location' in table_lower:
            return f"LOC{random.randint(100, 999)}"
        elif 'job' in table_lower:
            return f"JOB{random.randint(1000, 9999)}"
        elif 'application' in table_lower:
            return f"APP{random.randint(1000, 9999)}"
        elif 'interview' in table_lower:
            return f"INT{random.randint(1000, 9999)}"
        elif 'offer' in table_lower:
            return f"OFF{random.randint(1000, 9999)}"
        elif 'benefit' in table_lower:
            return f"BEN{random.randint(1000, 9999)}"
        elif 'payroll' in table_lower:
            return f"PAY{random.randint(1000, 9999)}"
        elif 'document' in table_lower:
            return f"DOC{random.randint(1000, 9999)}"
        elif 'notification' in table_lower:
            return f"NOT{random.randint(1000, 9999)}"
        elif 'audit' in table_lower:
            return f"AUD{random.randint(1000, 9999)}"
        else:
            if 'id' in field_lower:
                prefix = field_lower.replace('_id', '').replace('id', '').upper()[:3]
                if not prefix:
                    prefix = 'ID'
                return f"{prefix}{random.randint(1000, 9999)}"
            else:
                return str(uuid.uuid4())

    def _generate_varchar(self, field_name: str) -> str:
        field_lower = field_name.lower()
        if 'name' in field_lower:
            if 'first' in field_lower:
                return self.fake.first_name()
            elif 'last' in field_lower:
                return self.fake.last_name()
            else:
                return self.fake.name()
        elif 'email' in field_lower:
            return self.fake.email()
        elif 'phone' in field_lower or 'contact' in field_lower:
            return self.fake.phone_number()
        elif 'address' in field_lower:
            return self.fake.street_address()
        elif 'city' in field_lower:
            return self.fake.city()
        elif 'country' in field_lower:
            return self.fake.country()
        elif 'description' in field_lower or 'desc' in field_lower:
            return self.fake.text(max_nb_chars=200)
        elif 'title' in field_lower:
            return self.fake.job()
        elif 'company' in field_lower:
            return self.fake.company()
        elif 'url' in field_lower or 'link' in field_lower:
            return self.fake.url()
        elif 'path' in field_lower:
            return f"/{self.fake.word()}/{field_lower.replace('_', '-')}"
        elif 'key' in field_lower and 'id' not in field_lower:
            return f"{random.choice(['KEY', 'REF', 'CODE', 'ID'])}{random.randint(1000, 9999)}"
        else:
            return self.fake.word()

    def _generate_int(self, field_name: str) -> int:
        field_lower = field_name.lower()
        if 'id' in field_lower and field_lower != 'id':
            return random.randint(1, 10000)
        elif 'count' in field_lower or 'quantity' in field_lower:
            return random.randint(0, 1000)
        elif 'age' in field_lower:
            return random.choices(range(18, 81), k=1)[0]
        elif 'year' in field_lower:
            return random.randint(2020, 2024)
        elif 'month' in field_lower:
            return random.randint(1, 12)
        elif 'day' in field_lower:
            return random.randint(1, 28)
        elif 'hour' in field_lower:
            return random.randint(0, 23)
        elif 'minute' in field_lower:
            return random.randint(0, 59)
        elif 'second' in field_lower:
            return random.randint(0, 59)
        elif 'score' in field_lower or 'rating' in field_lower:
            return random.randint(1, 10)
        elif 'level' in field_lower and 'id' not in field_lower:
            return random.randint(1, 5)
        elif 'salary' in field_lower or 'wage' in field_lower:
            return random.randint(30000, 200000)
        elif 'experience' in field_lower:
            return random.randint(0, 30)
        elif 'priority' in field_lower:
            return random.randint(1, 5)
        elif 'status' in field_lower:
            return random.randint(0, 3)
        else:
            return random.randint(1, 1000)

    def _generate_decimal(self, field_name: str) -> float:
        field_lower = field_name.lower()
        if 'price' in field_lower or 'cost' in field_lower or 'amount' in field_lower:
            return round(random.uniform(10.0, 5000.0), 2)
        elif 'salary' in field_lower or 'wage' in field_lower:
            return round(random.uniform(30000.0, 200000.0), 2)
        elif 'rate' in field_lower or 'percentage' in field_lower:
            return round(random.uniform(0.0, 100.0), 2)
        elif 'weight' in field_lower:
            return round(random.uniform(50.0, 200.0), 1)
        elif 'height' in field_lower:
            return round(random.uniform(150.0, 200.0), 1)
        elif 'temperature' in field_lower:
            return round(random.uniform(-10.0, 40.0), 1)
        elif 'score' in field_lower or 'rating' in field_lower:
            return round(random.uniform(0.0, 10.0), 1)
        elif 'bonus' in field_lower:
            return round(random.uniform(1000.0, 50000.0), 2)
        elif 'commission' in field_lower:
            return round(random.uniform(0.0, 15.0), 2)
        elif 'tax' in field_lower:
            return round(random.uniform(0.0, 50.0), 2)
        elif 'discount' in field_lower:
            return round(random.uniform(0.0, 50.0), 2)
        else:
            return round(random.uniform(1.0, 1000.0), 2)

    def _generate_text(self, field_name: str) -> str:
        field_lower = field_name.lower()
        if 'description' in field_lower or 'desc' in field_lower:
            return f"This is a detailed description for the {field_lower.replace('_', ' ')} field. It contains sample content to demonstrate the data generation capabilities."
        elif 'comment' in field_lower or 'note' in field_lower:
            return f"Sample comment for {field_lower.replace('_', ' ')} field."
        elif 'content' in field_lower:
            return f"Sample content for the {field_lower.replace('_', ' ')} field with some meaningful text."
        elif 'message' in field_lower:
            return f"Sample message content for {field_lower.replace('_', ' ')} field."
        elif 'details' in field_lower:
            return f"Detailed information for {field_lower.replace('_', ' ')} field."
        else:
            return f"This is a sample text field for {field_lower.replace('_', ' ')} with some content to demonstrate the data generation capabilities."

    def _generate_date(self) -> str:
        start_date = datetime.now() - timedelta(days=1825)
        random_date = start_date + timedelta(days=random.randint(0, 1825))
        return random_date.strftime('%Y-%m-%d')

    def _generate_enum(self, field_name: str, field_info: Dict) -> str:
        field_lower = field_name.lower()
        if 'status' in field_lower:
            return random.choice(['active', 'inactive', 'pending', 'completed', 'cancelled', 'draft', 'published', 'archived'])
        elif 'type' in field_lower:
            return random.choice(['full_time', 'part_time', 'contract', 'intern', 'consultant', 'standard', 'premium', 'basic'])
        elif 'role' in field_lower:
            return random.choice(['admin', 'user', 'manager', 'employee', 'hr', 'finance', 'it', 'sales', 'marketing', 'operations'])
        elif 'level' in field_lower:
            return random.choice(['junior', 'mid', 'senior', 'lead', 'principal', 'director', 'executive'])
        elif 'priority' in field_lower:
            return random.choice(['low', 'medium', 'high', 'urgent', 'critical'])
        elif 'category' in field_lower:
            return random.choice(['technology', 'finance', 'hr', 'operations', 'sales', 'marketing', 'customer_service', 'product'])
        elif 'state' in field_lower:
            return random.choice(['draft', 'active', 'inactive', 'archived', 'deleted'])
        elif 'mode' in field_lower:
            return random.choice(['manual', 'automatic', 'semi_automatic', 'scheduled'])
        elif 'size' in field_lower:
            return random.choice(['small', 'medium', 'large', 'enterprise'])
        elif 'grade' in field_lower:
            return random.choice(['A', 'B', 'C', 'D', 'F', 'excellent', 'good', 'satisfactory', 'needs_improvement'])
        elif 'gender' in field_lower:
            return random.choice(['male', 'female', 'other', 'prefer_not_to_say'])
        elif 'marital' in field_lower:
            return random.choice(['single', 'married', 'divorced', 'widowed', 'separated'])
        elif 'employment' in field_lower:
            return random.choice(['full_time', 'part_time', 'contract', 'intern', 'consultant', 'freelance'])
        else:
            return random.choice(['option_1', 'option_2', 'option_3', 'default', 'standard'])

    def generate_all_tables(self, output_folder: str, records_per_table: int = 50) -> Dict[str, str]:
        os.makedirs(output_folder, exist_ok=True)
        generated_files = {}
        existing_data = {}

        tables_to_process = list(self.schema.keys())
        processed_tables = set()

        while tables_to_process:
            for table_name in tables_to_process[:]:
                table_schema = self.schema[table_name]
                dependencies_satisfied = True
                for fk in table_schema['foreign_keys']:
                    if fk['ref_table'] not in processed_tables:
                        dependencies_satisfied = False
                        break

                if dependencies_satisfied:
                    data = self.generate_data(table_name, records_per_table, existing_data)
                    existing_data[table_name] = data
                    filename = f"{table_name}.json"
                    filepath = os.path.join(output_folder, filename)
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                    generated_files[table_name] = filepath
                    processed_tables.add(table_name)
                    tables_to_process.remove(table_name)

        return generated_files

    def get_available_tables(self) -> List[str]:
        return list(self.schema.keys())

    def debug_relationships(self) -> Dict:
        relationships = {}
        for table_name, table_schema in self.schema.items():
            if table_schema['foreign_keys']:
                relationships[table_name] = table_schema['foreign_keys']
        return relationships
