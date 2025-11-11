# excel_mapper.py
import pandas as pd
from typing import Dict
from pathlib import Path

def load_excel_mapping(excel_path: str, tool_column: str, assoc_column: str) -> Dict[str, list]:
    path = Path(excel_path)
    if not path.exists():
        raise FileNotFoundError(excel_path)
    df = pd.read_excel(excel_path, dtype=str).fillna("")
    if tool_column not in df.columns or assoc_column not in df.columns:
        raise KeyError(f"Excel must contain columns: {tool_column}, {assoc_column}")
    mapping = {}
    for _, r in df.iterrows():
        tool = str(r[tool_column]).strip()
        assoc = str(r[assoc_column]).strip()
        if not tool:
            continue
        table_list = [t.strip() for t in assoc.split(",") if t.strip()]
        mapping[tool] = table_list
    return mapping
