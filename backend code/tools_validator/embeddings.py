import os
import time
from openai import OpenAI
from dotenv import load_dotenv
import numpy as np

load_dotenv()
openai_key = os.getenv("OPENAI_API_KEY")

client = None
if openai_key:
    client = OpenAI(api_key=openai_key)
else:
    print("⚠️ Warning: OPENAI_API_KEY not set — using fallback pseudo-embeddings.")


def get_embedding(text):
    """
    Generate a single embedding for text using OpenAI API.
    Falls back to deterministic pseudo-embeddings if no key is found.
    """
    text = text.replace("\n", " ").strip()

    if not client:
        import hashlib
        h = hashlib.sha256(text.encode("utf-8")).digest()
        return np.frombuffer(h, dtype=np.uint8)[:768] / 255.0

    response = client.embeddings.create(
        model="text-embedding-3-large",
        input=text
    )
    return response.data[0].embedding


def batch_get_embeddings(items, model="text-embedding-3-large", batch_size=10):
    """
    Efficient batch embedding with progress display and timing.
    items → list of strings
    """
    if not items:
        print("⚠️ No items to embed.")
        return []

    if not client:
        # fallback: deterministic local embeddings
        print("⚠️ Using pseudo-embeddings (no OpenAI API key)")
        import hashlib
        return [
            np.frombuffer(hashlib.sha256(text.encode("utf-8")).digest(), dtype=np.uint8)[:768] / 255.0
            for text in items
        ]

    print(f"📊 Starting embedding process...")
    print(f"🧾 Total items to embed: {len(items)} | Model: {model} | Batch size: {batch_size}")

    all_embeddings = []
    total_batches = (len(items) + batch_size - 1) // batch_size

    for i in range(total_batches):
        start_time = time.time()
        batch = items[i * batch_size : (i + 1) * batch_size]
        print(f"⚙️ Processing batch {i+1}/{total_batches} ({len(batch)} items)...", end=" ")

        try:
            response = client.embeddings.create(
                model=model,
                input=batch
            )
            batch_embeddings = [d.embedding for d in response.data]
            all_embeddings.extend(batch_embeddings)
            duration = round(time.time() - start_time, 2)
            print(f"✅ Done in {duration}s")
        except Exception as e:
            print(f"❌ Failed batch {i+1}: {e}")
            all_embeddings.extend([[0]*1536 for _ in batch])  # placeholder

    print(f"🎉 All embeddings completed successfully ({len(all_embeddings)} vectors).")
    return all_embeddings
