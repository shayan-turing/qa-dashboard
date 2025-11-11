# openai_qa.py
import os
import json
from config import OPENAI_MODEL_SHORT, OPENAI_MODEL_LONG
from typing import Any, Dict
from openai import OpenAI
from dotenv import load_dotenv
load_dotenv()

class OpenAIQA:
    def __init__(self):
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise EnvironmentError("OPENAI_API_KEY not set in environment")
        self.client = OpenAI(api_key=api_key)
        self.short_model = OPENAI_MODEL_SHORT
        self.long_model = OPENAI_MODEL_LONG

    def run_extraction(self, prompt: str) -> Dict[str, Any]:
        """
        Use a deterministic low-temperature call to extract JSON.
        We expect the model to return a JSON object mapping tool_name->spec.
        """
        messages = [
            {"role":"system", "content": "You are a precise JSON extractor. Return ONLY valid JSON, nothing else."},
            {"role":"user", "content": prompt}
        ]
        resp = self.client.chat.completions.create(
            model=self.short_model,
            messages=messages,
            temperature=0.0,
            max_tokens=4000
        )
        text = resp.choices[0].message.content.strip()
        try:
            return json.loads(text)
        except Exception:
            # attempt to extract JSON substring
            import re
            m = re.search(r'\{[\s\S]*\}$', text)
            if m:
                return json.loads(m.group(0))
            raise

    def run_compliance_check(self, tool_name: str, policy_spec: dict, excel_tables: list, code_snippet: str) -> Dict[str, Any]:
        """
        Ask the model to compare policy_spec + excel mapping vs code implementation.
        Return an object with llm_verdict, llm_reason, suggestions, score (0-1)
        """
        prompt = self._build_compliance_prompt(tool_name, policy_spec, excel_tables, code_snippet)
        messages = [
            {"role":"system", "content": "You are a senior software compliance auditor. Provide concise JSON with keys: llm_verdict, llm_reason, suggestions, score"},
            {"role":"user", "content": prompt}
        ]
        resp = self.client.chat.completions.create(
            model=self.long_model,
            messages=messages,
            temperature=0.0,
            max_tokens=1500
        )
        text = resp.choices[0].message.content.strip()
        return self._safe_parse_json(text)

    def run_logical_qa(self, tool_name: str, code_snippet: str) -> Dict[str, Any]:
        prompt = f"""
    You are a senior engineer performing code review. For the tool '{tool_name}', analyze the following Python implementation.
    Return a JSON object with keys:
    - issues (list of strings): critical problems
    - recommendations (list of strings): concrete fixes
    - tests (list of suggested unit tests with inputs and expected outputs)
    - score (0-1)
    Code:
    ```python
    {code_snippet}
    """
        messages = [
        {"role":"system", "content": "You are a pragmatic code reviewer who produces JSON only."},
        {"role":"user", "content": prompt}
        ]
        resp = self.client.chat.completions.create(
        model=self.long_model,
        messages=messages,
        temperature=0.0,
        max_tokens=1500
        )
        text = resp.choices[0].message.content.strip()
        return self._safe_parse_json(text)
    def _safe_parse_json(self, text: str):
        try:
            return json.loads(text)
        except Exception:
            import re
            m = re.search(r'(\{[\s\S]*\})', text)
            if m:
                try:
                    return json.loads(m.group(1))
                except Exception:
                    pass
            # Last resort: return as message
            return {"raw": text}

    def _build_compliance_prompt(self, tool_name, policy_spec, excel_tables, code_snippet):
        return f"""
            Tool: {tool_name}

            Policy Specification (may be partial):
            {json.dumps(policy_spec, indent=2)}

            Excel-mapped tables: {excel_tables}

            Implementation (partial code):

            python
            Copy code
            {(code_snippet[:2500] + '...') if len(code_snippet) > 2500 else code_snippet}
            Task: Compare the Policy Spec and Excel tables vs the Implementation. Provide a JSON object with:

            llm_verdict: 'Compliant'|'Partially Compliant'|'Non-Compliant'

            llm_reason: string (concise but specific)

            suggestions: list of concrete fixes

            score: float between 0 and 1 (1=perfect compliance)

            Return only JSON.
            """
