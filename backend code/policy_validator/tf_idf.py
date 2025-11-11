from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re

def tfidf_cosine_similarity(doc1: str, doc2: str) -> float:
    """
    Compute cosine similarity between two documents using TF-IDF.
    Cleans text, removes noise, and handles empty or short docs gracefully.
    """
    # Basic cleanup: lowercase + remove punctuation/numbers
    def clean_text(text: str) -> str:
        text = text.lower()
        text = re.sub(r"[^a-z\s]", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()

    doc1_clean = clean_text(doc1)
    doc2_clean = clean_text(doc2)

    # Handle empty inputs
    if not doc1_clean or not doc2_clean:
        return 0.0

    # Use sublinear TF scaling for better discrimination on long docs
    vectorizer = TfidfVectorizer(stop_words="english", sublinear_tf=True)
    tfidf = vectorizer.fit_transform([doc1_clean, doc2_clean])

    sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
    return float(sim)
