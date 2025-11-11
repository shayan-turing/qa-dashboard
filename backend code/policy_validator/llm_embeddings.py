from openai import OpenAI
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import tiktoken
import os
from dotenv import load_dotenv
import time

# -------------------------------------------------------
# Load environment + initialize OpenAI client
# -------------------------------------------------------
load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")

if not api_key:
    raise ValueError("❌ Missing OPENAI_API_KEY in .env file")

client = OpenAI(api_key=api_key)
tokenizer = tiktoken.get_encoding("cl100k_base")

# -------------------------------------------------------
# Text Chunking Helper
# -------------------------------------------------------
def chunk_text(text: str, max_tokens: int = 800):
    """
    Splits long text into chunks under max_tokens for embeddings.
    """
    tokens = tokenizer.encode(text)
    chunks = []
    for i in range(0, len(tokens), max_tokens):
        chunk = tokenizer.decode(tokens[i:i + max_tokens])
        chunks.append(chunk.strip())
    return [c for c in chunks if c]

# -------------------------------------------------------
# Embedding Similarity with OpenAI (LLM-based)
# -------------------------------------------------------
def llm_embedding_similarity(doc1: str, doc2: str) -> float:
    """
    Compute similarity between two documents using OpenAI embeddings.
    Handles long documents by averaging per-chunk embeddings.
    """

    model = "text-embedding-3-large"

    def get_embeddings(chunks):
        embeddings = []
        for idx, chunk in enumerate(chunks):
            for attempt in range(3):  # Retry on transient errors
                try:
                    response = client.embeddings.create(model=model, input=chunk)
                    emb = np.array(response.data[0].embedding, dtype=np.float32)
                    embeddings.append(emb)
                    break
                except Exception as e:
                    print(f"[WARN] Embedding failed (chunk {idx+1}/{len(chunks)}): {e}")
                    time.sleep(2 ** attempt)  # exponential backoff
            else:
                print(f"[FAIL] Skipping chunk {idx+1} after retries.")
        if not embeddings:
            return np.zeros(1536, dtype=np.float32)  # fallback vector
        return np.mean(embeddings, axis=0)

    chunks1 = chunk_text(doc1)
    chunks2 = chunk_text(doc2)

    emb1 = get_embeddings(chunks1)
    emb2 = get_embeddings(chunks2)

    # Handle zero vectors gracefully
    if not np.any(emb1) or not np.any(emb2):
        return 0.0

    sim = cosine_similarity([emb1], [emb2])[0][0]
    return float(sim)
