# policy_reader.py
import os
from pathlib import Path
from docx import Document
import re
import json
from typing import List
from config import SOP_CACHE_FILE, POLICY_CHUNK_SIZE, POLICY_CHUNK_OVERLAP
from openai_qa import OpenAIQA
from tqdm import tqdm

def read_policy_text(policy_path: str) -> str:
    path = Path(policy_path)
    if not path.exists():
        raise FileNotFoundError(policy_path)
    if path.suffix.lower() == ".docx":
        doc = Document(policy_path)
        return "\n".join([p.text for p in doc.paragraphs])
    else:
        # txt or md
        return path.read_text(encoding='utf-8')

def chunk_text(text: str, size: int = POLICY_CHUNK_SIZE, overlap: int = POLICY_CHUNK_OVERLAP) -> List[str]:
    chunks = []
    i = 0
    while i < len(text):
        chunk = text[i:i+size]
        chunks.append(chunk)
        i += size - overlap
    return chunks

def extract_sop_requirements(policy_path: str, force_refresh: bool = False) -> dict:
    # Load from cache if present
    if SOP_CACHE_FILE.exists() and not force_refresh:
        try:
            data = json.loads(SOP_CACHE_FILE.read_text(encoding='utf-8'))
            print(f"📦 Loaded SOPs from cache: {SOP_CACHE_FILE}")
            return data
        except Exception:
            pass

    print("🔍 Reading policy file...")
    policy_text = read_policy_text(policy_path)
    chunks = chunk_text(policy_text)

    # Use OpenAIQA to extract structured SOPs chunk-by-chunk and then merge
    openai_client = OpenAIQA()
    extracted = {}
    print("🤖 Extracting SOPs from policy via OpenAI...")
    for idx, chunk in enumerate(tqdm(chunks, desc="policy-chunks")):
        prompt = _build_extraction_prompt(chunk, part=idx+1, total=len(chunks))
        response = openai_client.run_extraction(prompt)
        try:
            # Expect JSON mapping
            json_obj = response
            if isinstance(json_obj, dict):
                # merge: prefer existing keys -> keep first found
                for k, v in json_obj.items():
                    if k not in extracted:
                        extracted[k] = v
        except Exception as e:
            # ignore parsing issues: continue
            print(f"⚠️  Extraction chunk {idx} parse error: {e}")

    # Save cache
    try:
        SOP_CACHE_FILE.write_text(json.dumps(extracted, indent=2), encoding='utf-8')
    except Exception as e:
        print(f"⚠️  Failed to write SOP cache: {e}")

    print(f"✅ Extracted {len(extracted)} SOP entries.")
    return extracted

def _build_extraction_prompt(text_chunk: str, part: int, total: int) -> str:
    prompt = f"""
You are a documentation analyzer that must extract structured SOPs from a policy fragment.
This is part {part}/{total}. Each response must be valid JSON where keys are tool names (snake_case),
and each value contains fields (use empty list [] or null when not present):

For each tool found include:
- sop_name (string)
- operation_types (list of strings)
- entity_types (list of strings)
- valid_filters (object mapping entity_type -> list of filter keys)
- mandatory_fields (list)
- optional_fields (list)
- authorized_roles (list)
- database_tables (list)
- halt_conditions (list)
- validation_rules (list of human-readable rules)

Return only JSON. Do NOT include commentary.

Policy fragment:
\"\"\"{text_chunk}\"\"\"
"""
    return prompt
