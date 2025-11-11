import re
import os
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from dotenv import load_dotenv

load_dotenv()

# Automatically check for semantic capability
USE_SEMANTIC = bool(os.getenv("OPENAI_API_KEY"))
if USE_SEMANTIC:
    from .embeddings import get_embedding


def split_into_sops_fast(text, max_chunk_size=1200, overlap_ratio=0.1):
    """
    Fast heuristic chunking.
    Splits based on blank lines, numbered headers, and merges small paragraphs.
    Adds small overlaps between chunks for context preservation.
    """
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", text) if len(p.strip()) > 40]
    chunks, current_chunk = [], []
    char_count = 0

    for p in paragraphs:
        current_chunk.append(p)
        char_count += len(p)

        # Create a new chunk when reaching the limit or header
        if char_count > max_chunk_size or re.match(r"^\d+\.", p):
            chunk = "\n\n".join(current_chunk).strip()
            if len(chunk) > 100:
                chunks.append(chunk)

            # Add overlap: last N% of this chunk is kept for next chunk
            overlap_len = int(len(current_chunk) * overlap_ratio)
            current_chunk = current_chunk[-overlap_len:] if overlap_len > 0 else []
            char_count = sum(len(c) for c in current_chunk)

    # Add remaining chunk
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    print(f"⚡ Created {len(chunks)} heuristic chunks (with overlap)")
    return chunks


def split_into_sops_semantic(text, semantic_threshold=0.75, overlap_ratio=0.1):
    """
    Context-aware chunking using semantic similarity + heuristics + overlap.
    Requires OpenAI API key.
    """
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", text) if len(p.strip()) > 40]
    if not paragraphs:
        return [text]

    # Step 1: Heuristic section detection
    section_indices = []
    for i, p in enumerate(paragraphs):
        if re.match(r"^\d+\.", p):
            section_indices.append(i)
        elif re.search(r"(?i)\b(SOP|Step|Procedure|Policy|When to use|Responsibilities|Instructions)\b", p):
            section_indices.append(i)

    # Step 2: Compute paragraph embeddings
    embeddings = [get_embedding(p) for p in paragraphs]

    # Step 3: Detect semantic boundaries based on cosine similarity
    boundaries = set(section_indices)
    for i in range(1, len(paragraphs)):
        sim = cosine_similarity([embeddings[i - 1]], [embeddings[i]])[0][0]
        if sim < semantic_threshold:
            boundaries.add(i)

    # Step 4: Merge paragraphs into context-rich chunks
    chunks, current_chunk = [], []
    for i, p in enumerate(paragraphs):
        current_chunk.append(p)

        # When boundary is reached, form a chunk
        if i + 1 in boundaries or i == len(paragraphs) - 1:
            chunk = "\n\n".join(current_chunk).strip()
            if len(chunk) > 100:
                chunks.append(chunk)

            # Overlap: keep a portion of previous paragraphs
            overlap_len = max(1, int(len(current_chunk) * overlap_ratio))
            current_chunk = current_chunk[-overlap_len:] if overlap_len > 0 else []

    print(f"🧠 Created {len(chunks)} semantic chunks (with overlap)")
    return chunks


def split_into_sops(text):
    """
    Smart splitter — automatically chooses semantic or fast mode
    based on whether the OpenAI API key is available.
    """
    if USE_SEMANTIC:
        try:
            return split_into_sops_semantic(text)
        except Exception as e:
            print(f"⚠️ Semantic chunking failed ({e}), falling back to heuristic mode.")
            return split_into_sops_fast(text)
    else:
        return split_into_sops_fast(text)
