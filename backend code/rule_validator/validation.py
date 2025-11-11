import json
import os
import re
from dotenv import load_dotenv

# Import OpenAI and Gemini clients
from openai import OpenAI
from google import genai
from .prompt_template import build_validation_prompt

# Load environment variables
load_dotenv()

openai_key = os.getenv("OPENAI_API_KEY")
gemini_key = os.getenv("GEMINI_API_KEY")

if not openai_key and not gemini_key:
    raise ValueError("⚠️ Missing both OPENAI_API_KEY and GEMINI_API_KEY in .env file")

# Initialize available clients
openai_client = OpenAI(api_key=openai_key) if openai_key else None
gemini_client = genai.Client(api_key=gemini_key) if gemini_key else None


# ---------------------------
# 🔹 JSON Parser Utility
# ---------------------------
def safe_parse_json(content: str) -> dict:
    """
    Safely parse a model response into JSON.
    Removes Markdown code fences, trims text, and handles malformed outputs.
    """
    try:
        cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "valid": False,
            "violated_rules": [],
            "reasoning": "Model returned invalid JSON (after cleaning).",
            "raw_output": content,
        }


# ---------------------------
# 🔹 OpenAI Validation
# ---------------------------
def validate_with_openai(chunk: str, rules: str) -> dict:
    prompt = build_validation_prompt(rules, chunk, provider="openai")

    response = openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a strict JSON validator. Return only valid JSON, no markdown formatting or text outside JSON.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0,
    )
    content = response.choices[0].message.content.strip()
    return safe_parse_json(content)


# ---------------------------
# 🔹 Gemini Validation
# ---------------------------
def validate_with_gemini(chunk: str, rules: str) -> dict:
    prompt = build_validation_prompt(rules, chunk, provider="gemini")

    model = gemini_client.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt,
    )
    content = model.text.strip()
    return safe_parse_json(content)


# ---------------------------
# 🔹 Unified Fallback Validator
# ---------------------------
def validate_chunk(chunk: str, rules: str) -> dict:
    """
    Validate a single document chunk.
    Tries OpenAI first, falls back to Gemini if OpenAI fails or returns invalid JSON.
    """
    try:
        if openai_client:
            result = validate_with_openai(chunk, rules)
            if result.get("valid") is not None:
                return result
        if gemini_client:
            print("⚠️ Falling back to Gemini...")
            return validate_with_gemini(chunk, rules)
    except Exception as e:
        if gemini_client:
            print(f"⚠️ OpenAI failed ({e}), switching to Gemini...")
            try:
                return validate_with_gemini(chunk, rules)
            except Exception as e2:
                return {"valid": False, "reasoning": f"Both models failed: {e2}"}
        return {"valid": False, "reasoning": f"Validation failed: {str(e)}"}


# ---------------------------
# 🔹 Batch Validation
# ---------------------------
def validate_document(chunks: list, rules: str) -> list:
    """
    Validate all chunks in a document and return combined results.
    """
    all_results = []
    for i, chunk in enumerate(chunks, start=1):
        print(f"🧩 Validating chunk {i}/{len(chunks)}...")
        result = validate_chunk(chunk, rules)
        all_results.append(result)
    return all_results
