from sentence_transformers import SentenceTransformer, util
import torch

# ✅ Load model ONCE when the module is imported
torch.set_num_threads(1)  # prevent CPU thread hang on Windows
print("[INIT] Loading SentenceTransformer model globally...")
model = SentenceTransformer("all-MiniLM-L6-v2")
_ = model.encode(["warmup"], convert_to_tensor=True)  # optional warmup
print("[INIT] Transformer model ready.")

def semantic_similarity_check(doc1: str, doc2: str) -> float:
    """Compute semantic similarity between two documents using MiniLM."""
    emb1 = model.encode(doc1, convert_to_tensor=True)
    emb2 = model.encode(doc2, convert_to_tensor=True)
    similarity = util.pytorch_cos_sim(emb1, emb2)
    return float(similarity.item())
