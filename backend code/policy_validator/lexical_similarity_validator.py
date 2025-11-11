import re

def jaccard_similarity(doc1: str, doc2: str) -> float:
    """Compute Jaccard similarity between two text documents."""
    # Normalize and tokenize
    tokenize = lambda text: set(
        re.findall(r"\b\w+\b", text.lower())  # keep only word characters
    )

    words1, words2 = tokenize(doc1), tokenize(doc2)

    # Handle edge case where both documents are empty
    if not words1 and not words2:
        return 1.0  # both empty → identical
    if not words1 or not words2:
        return 0.0  # one empty → no similarity

    # Compute Jaccard
    intersection = len(words1 & words2)
    union = len(words1 | words2)
    return intersection / union if union else 0.0
