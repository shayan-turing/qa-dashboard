import time
import json
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

from .read_files import read_document, read_excel_tools
from .splitting import split_into_sops
from .embeddings import get_embedding, batch_get_embeddings
from .asking_llm_for_reasoning import ask_llm_for_reasoning


def validate_tools(excel_path, doc_path, threshold=0.70, use_llm_reasoning=True):
    """
    Validates tools listed in Excel against the given document.
    Returns validation results and metadata (chunk count, avg similarity, embedding performance, etc.)
    """

    # --- STEP 1: Read and Prepare ---
    tools = read_excel_tools(excel_path)
    text = read_document(doc_path)
    paragraphs = split_into_sops(text)

    print(f"📘 Document split into {len(paragraphs)} context-aware chunks")
    print(f"🧩 Total tools to validate: {len(tools)}")

    if len(tools) == 0 or len(paragraphs) == 0:
        raise ValueError("Empty Excel or document content. Ensure both have valid data.")

    # --- STEP 2: Embed Paragraphs ---
    print("\n🚀 Starting paragraph embedding...")
    start_time = time.time()
    para_embeddings = batch_get_embeddings(paragraphs, batch_size=10)
    para_time = time.time() - start_time
    print(f"✅ Document embeddings completed in {para_time:.2f}s for {len(paragraphs)} chunks")

    # --- STEP 3: Validation Loop ---
    print("\n⚙️ Starting tool-document validation...")
    results = []
    total_sim = []
    tool_embed_time = 0

    for idx, tool in enumerate(tools, start=1):
        tool_name = str(tool.get("tool_name", "")).strip() or str(tool.get("Tool Name", "")).strip()
        related_sop = str(tool.get("Related SOPs", ""))

        if not tool_name:
            continue

        # Embed tool query
        q_start = time.time()
        query_text = f"{tool_name}. Related SOPs: {related_sop}"
        query_embedding = get_embedding(query_text)
        tool_embed_time += (time.time() - q_start)

        # Compute cosine similarity
        sims = cosine_similarity([query_embedding], para_embeddings)[0]
        best_idx = int(np.argmax(sims))
        best_score = float(sims[best_idx])
        best_match = paragraphs[best_idx]

        total_sim.append(best_score)

        verdict = (
            "missing" if best_score < 0.35
            else "match" if best_score >= threshold
            else "partial"
        )

        reason_data = {}
        if use_llm_reasoning:
            reason_data = ask_llm_for_reasoning(tool_name, related_sop, best_match, best_score)

        results.append({
            "tool_name": tool_name,
            "related_sop": related_sop,
            "best_match_paragraph": best_match[:600] + ("..." if len(best_match) > 600 else ""),
            "similarity_score": round(best_score, 3),
            "status": verdict,
            "llm_verdict": reason_data.get("verdict"),
            "llm_reason": reason_data.get("match_reason")
        })

        print(f"🔹 [{idx}/{len(tools)}] {tool_name}: {verdict.upper()} (score={best_score:.3f})")

    # --- STEP 4: Summary ---
    df = pd.DataFrame(results)

    summary = {
        "total_tools": len(results),
        "matched": int((df["status"] == "match").sum()),
        "partial": int((df["status"] == "partial").sum()),
        "missing": int((df["status"] == "missing").sum()),
        "chunk_count": len(paragraphs),
        "average_similarity": round(float(np.mean(total_sim)) if total_sim else 0, 3),
        "embedding_time": {
            "paragraphs_sec": round(para_time, 2),
            "tools_sec": round(tool_embed_time, 2),
            "total_sec": round(para_time + tool_embed_time, 2),
            "avg_per_item_sec": round((para_time + tool_embed_time) / (len(tools) + len(paragraphs)), 3)
        }
    }

    print(f"\n✅ Validation complete: {summary}")
    return {"summary": summary, "details": results}
