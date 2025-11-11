# policy_validator/report_generator.py

import json
import matplotlib.pyplot as plt

# def visualize_similarity(results: dict):
#     names = list(results.keys())
#     scores = list(results.values())

#     plt.figure(figsize=(7, 4))
#     bars = plt.barh(names, scores)
#     plt.xlim(0, 1)
#     plt.title("Document Similarity Comparison", fontsize=14)
#     plt.xlabel("Similarity Score (0–1)")
#     plt.grid(axis='x', linestyle='--', alpha=0.5)

#     for bar, score in zip(bars, scores):
#         plt.text(score + 0.02, bar.get_y() + bar.get_height()/2, f"{score:.3f}")

#     plt.tight_layout()
#     plt.show()


# def generate_similarity_report(results: dict, filename: str = "similarity_report.json"):
#     with open(filename, "w") as f:
#         json.dump(results, f, indent=4)
#     print(f"Similarity report saved as {filename}")
