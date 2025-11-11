import pandas as pd
from docx import Document

def read_excel_tools(path):
    # Read from 'Tools' sheet
    df = pd.read_excel(path, sheet_name='Tools', header=0)
    
    # Debug: Print original column names
    print("Original columns:", df.columns.tolist())
    
    # Clean column names: strip whitespace, keep original case for now
    df.columns = [str(c).strip().replace('\n', '').replace('\r', '') for c in df.columns]
    
    # Debug: Print cleaned column names
    print("Cleaned columns:", df.columns.tolist())
    
    # Create a case-insensitive mapping to find the right columns
    col_lower_map = {col.lower(): col for col in df.columns}
    
    # Find the actual column names (case-insensitive)
    tool_name_col = None
    related_sops_col = None
    
    for lower_col, actual_col in col_lower_map.items():
        if 'tool' in lower_col and 'name' in lower_col:
            tool_name_col = actual_col
        elif 'related' in lower_col and 'sop' in lower_col:
            related_sops_col = actual_col
    
    # Check if we found the required columns
    if not tool_name_col:
        raise ValueError(f"Could not find 'Tool Name' column. Available: {df.columns.tolist()}")
    if not related_sops_col:
        raise ValueError(f"Could not find 'Related SOPs' column. Available: {df.columns.tolist()}")
    
    # Rename to standardized names
    df.rename(columns={
        tool_name_col: 'tool_name',
        related_sops_col: 'description'  # Using 'description' to match your validator
    }, inplace=True)
    
    # Add a default category if not present (since your validator expects it)
    if 'category' not in df.columns:
        df['category'] = 'API Tool'  # Default category
    
    print("Final columns:", df.columns.tolist())
    
    return df.to_dict(orient="records")

def read_document(path):
    if path.endswith(".txt") or path.endswith(".md"):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    elif path.endswith(".docx"):
        doc = Document(path)
        return "\n".join([p.text for p in doc.paragraphs])
    else:
        raise ValueError("Unsupported file type")