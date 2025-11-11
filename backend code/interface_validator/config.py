# config.py
from pathlib import Path
import os

# Default cache & output paths
BASE_DIR = Path(__file__).parent
CACHE_DIR = BASE_DIR / "cache"
CACHE_DIR.mkdir(exist_ok=True)
SOP_CACHE_FILE = CACHE_DIR / "sop_requirements.json"
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

# OpenAI configuration (the system reads OPENAI_API_KEY from env)
OPENAI_MODEL_SHORT = "gpt-4o-mini"  # change if you prefer other models
OPENAI_MODEL_LONG = "gpt-4o"        # fallback / longer reasoning if available

# Chunk size for policy text splitting (characters)
POLICY_CHUNK_SIZE = 3500
POLICY_CHUNK_OVERLAP = 200
