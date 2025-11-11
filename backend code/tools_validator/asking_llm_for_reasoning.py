import json
from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

openai_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=openai_key)

def ask_llm_for_reasoning(tool_name, related_sop, best_paragraph, similarity):
    confidence_label = (
        "strong match" if similarity > 0.65 else
        "partial match" if similarity > 0.35 else
        "weak match"
    )

    prompt = f"""
You are verifying if a documentation section describes the given tool.

Tool:
- Name: {tool_name}
- related_sop: {related_sop}


Document Excerpt:
\"\"\"{best_paragraph}\"\"\"

Similarity Score: {similarity:.3f} ({confidence_label})

Your job:
1. Assess if the excerpt semantically aligns with the tool's intent.
2. If the match is partial or weak, still give reasoning why.
3. Respond **only** in valid JSON with this format:

{{
  "match_reason": "concise explanation of how/why it matches or doesn't",
  "verdict": "match" or "partial" or "mismatch"
}}
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        response_text = response.choices[0].message.content.strip()

        # Try to extract valid JSON using regex fallback
        import re, json
        match = re.search(r"\{[\s\S]*\}", response_text)
        if match:
            json_str = match.group(0)
            return json.loads(json_str)
        else:
            return {
                "match_reason": f"Non-JSON response received: {response_text[:120]}...",
                "verdict": "unknown"
            }

    except Exception as e:
        print(f"⚠️ LLM reasoning error for {tool_name}: {e}")
        return {
            "match_reason": "LLM reasoning unavailable (API or parsing issue)",
            "verdict": "unknown"
        }