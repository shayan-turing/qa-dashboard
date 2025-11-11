import io
import pandas as pd
from .read_files import read_excel_tools, read_document
from .splitting import split_into_sops
from .embeddings import get_embedding
from .asking_llm_for_reasoning import ask_llm_for_reasoning
from .validator import validate_tools

__all__ = [
    "read_excel_tools",
    "read_document",
    "split_into_sops",
    "get_embedding",
    "ask_llm_for_reasoning",
    "validate_tools",
    "run_validation",
]


def run_validation(excel_input, doc_input, threshold: float = 0.5, use_llm_reasoning: bool = True):
    """
    Wrapper for validate_tools() that supports Flask file inputs.
    Returns a unified structure with summary + details.
    """

    if hasattr(excel_input, "read"):
        excel_data = io.BytesIO(excel_input.read())
    else:
        excel_data = excel_input

    if hasattr(doc_input, "read"):
        doc_data = io.BytesIO(doc_input.read())
    else:
        doc_data = doc_input

    results = validate_tools(excel_data, doc_data, threshold=threshold, use_llm_reasoning=use_llm_reasoning)

    # Ensure proper structure
    summary = results.get("summary", {})
    details = results.get("details", [])

    # For backward compatibility
    summary["details_count"] = len(details)

    return {"summary": summary, "details": details}
