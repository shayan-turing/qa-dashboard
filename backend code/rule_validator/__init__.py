from .file_reader import read_file
from .chunking import chunk_document
from .validation import validate_document, validate_chunk
from .rules import RULE_SETS

__all__ = [
    "read_file",
    "chunk_document",
    "validate_chunk",
    "validate_document",
    "RULE_SETS",
    "validate_file",
]


def validate_file(file_path: str, rule_key: str = "default") -> list:
    # Step 1: Read file
    text = read_file(file_path)

    # Step 2: Chunk text into logical sections
    chunks = chunk_document(text)

    # Step 3: Load the corresponding rule set
    # if rule_key not in RULE_SETS:
    #     raise KeyError(f"❌ Rule key '{rule_key}' not found in RULE_SETS.")
    

    # Step 4: Validate all chunks using the fallback logic (OpenAI → Gemini)
    results = validate_document(chunks, RULE_SETS)

    return results
