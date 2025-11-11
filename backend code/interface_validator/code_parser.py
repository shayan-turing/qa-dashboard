# code_parser.py
import ast
import re
from pathlib import Path
from typing import Dict, Any, List

def find_python_tool_files(py_dir: str) -> List[Path]:
    p = Path(py_dir)
    if not p.exists():
        raise FileNotFoundError(py_dir)
    return [f for f in p.glob("*.py") if not f.name.startswith("_")]

def parse_python_tool(file_path: str) -> Dict[str, Any]:
    """
    Return:
    {
      'file_path': str,
      'tool_name': str,
      'classes': [class names],
      'functions': [function names],
      'invoke_methods': [names],
      'entity_types': [...],
      'operation_types': [...],
      'validated_fields': [...],
      'database_tables': [...]
    }
    """
    txt = Path(file_path).read_text(encoding='utf-8')
    tree = ast.parse(txt)
    info = {
        'file_path': str(file_path),
        'tool_name': Path(file_path).stem,
        'classes': [],
        'functions': [],
        'invoke_methods': [],
        'entity_types': [],
        'operation_types': [],
        'validated_fields': [],
        'database_tables': []
    }

    # functions & classes
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            info['classes'].append(node.name)
            for item in node.body:
                if isinstance(item, ast.FunctionDef):
                    info['functions'].append(item.name)
                    if item.name == 'invoke':
                        info['invoke_methods'].append(item.name)
                        _extract_invoke_details(ast.get_source_segment(txt, item), info)
        elif isinstance(node, ast.FunctionDef):
            info['functions'].append(node.name)
            if node.name == 'invoke':
                info['invoke_methods'].append(node.name)
                _extract_invoke_details(ast.get_source_segment(txt, node), info)
    # fallback: parse top-level text heuristics
    _extract_tables_from_text(txt, info)
    return info

def _extract_invoke_details(code_str: str, info: dict):
    if not code_str:
        return
    # entity_type checks
    et_pat = r"entity_type\s*(?:==|in)\s*(?:\(?\[)?([^\]\)\n]+)"
    op_pat = r"operation_type\s*(?:==|in)\s*(?:\(?\[)?([^\]\)\n]+)"
    val_field_pat = r'if\s+not\s+data\.get\(["\']([a-zA-Z0-9_]+)["\']\)'
    # simple patterns
    for pat, key in [(et_pat, 'entity_types'), (op_pat, 'operation_types')]:
        for m in re.findall(pat, code_str):
            parts = re.split(r'[,|\]]+', m)
            parts = [p.strip().strip('\'" ') for p in parts if p.strip()]
            info[key].extend(parts)

    for m in re.findall(val_field_pat, code_str):
        info['validated_fields'].append(m)

    # database references
    _extract_tables_from_text(code_str, info)

def _extract_tables_from_text(text: str, info: dict):
    # heuristics
    # patterns: db.insert("table", ...), data.get('table_name', {}), f"FROM table", cursor.execute("SELECT ... FROM table")
    tables = set(info.get('database_tables', []))
    m1 = re.findall(r'insert\s*\(\s*["\']([a-zA-Z0-9_]+)["\']', text)
    m2 = re.findall(r'data\.get\(\s*["\']([a-zA-Z0-9_]+)["\']', text)
    m3 = re.findall(r'FROM\s+([a-zA-Z0-9_]+)', text, flags=re.IGNORECASE)
    m4 = re.findall(r'execute\s*\(\s*["\'](?:SELECT|INSERT|UPDATE|DELETE)[\s\S]*?\sFROM\s+([a-zA-Z0-9_]+)', text, flags=re.IGNORECASE)
    for l in (m1 + m2 + m3 + m4):
        if l and l.lower() not in ('data', 'entities', 'users', 'error', 'success'):
            tables.add(l)
    info['database_tables'] = list(tables)
