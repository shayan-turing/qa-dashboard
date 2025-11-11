from .file_reader import read_file
from .lexical_similarity_validator import jaccard_similarity
from .tf_idf import tfidf_cosine_similarity
from .semantic_similarity import semantic_similarity_check
# from .report_generator import generate_similarity_report
from .llm_embeddings import llm_embedding_similarity
import asyncio
import os


# async def compare_documents(doc1: str, doc2: str) -> dict:
#     if os.path.exists(doc1):
#         doc1 = read_file(doc1)
#     if os.path.exists(doc2):
#         doc2 = read_file(doc2)


#     tfidf_task = asyncio.to_thread(tfidf_cosine_similarity, doc1, doc2)
#     semantic_task = asyncio.to_thread(semantic_similarity_check, doc1, doc2)
#     llm_task = asyncio.to_thread(llm_embedding_similarity, doc1, doc2)

#     jaccard_score = jaccard_similarity(doc1, doc2)
#     tfidf_score, semantic_score, llm_score = await asyncio.gather(tfidf_task, semantic_task, llm_task)

#     results = {
#         "Jaccard Similarity": jaccard_score,
#         "TF-IDF Cosine Similarity": tfidf_score,
#         "Semantic Similarity": semantic_score,
#         "LLM Embedding Similarity": llm_score
#     }

#     # if show_plot:
#     #     await asyncio.to_thread(visualize_similarity, results)

#     # if save_report:
#     #     await asyncio.to_thread(generate_similarity_report, results, filename or "similarity_report.json")

#     return results
def compare_documents(doc1: str, doc2: str) -> dict:
    """
    Compare two documents using multiple similarity metrics.
    Automatically reads file paths or raw text.
    Returns a dict of similarity scores.
    """
    # Read files if paths are provided
    if os.path.exists(doc1):
        doc1 = read_file(doc1)
    if os.path.exists(doc2):
        doc2 = read_file(doc2)

    # --- Run metrics sequentially (fast and stable) ---
    jaccard_score = jaccard_similarity(doc1, doc2)
    tfidf_score = tfidf_cosine_similarity(doc1, doc2)
    semantic_score = semantic_similarity_check(doc1, doc2)
    llm_score = llm_embedding_similarity(doc1, doc2)

    # --- Collate results ---
    results = {
        "Jaccard Similarity": jaccard_score,
        "TF-IDF Cosine Similarity": tfidf_score,
        "Semantic Similarity": semantic_score,
        "LLM Embedding Similarity": llm_score
    }

    return results