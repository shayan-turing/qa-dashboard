from .rules import RULE_SETS

def build_validation_prompt(rules: str, chunk: str, provider: str = "gemini") -> str:
    """
    Builds a validation prompt for document correction and compliance checking.

    Args:
        rules (str): Combined validation rules.
        chunk (str): The section or chunk of the document to validate.
        provider (str): Either 'openai' or 'gemini'. Determines the tone/structure of the prompt.

    Returns:
        str: The formatted prompt.
    """

    if provider.lower() == "gemini":
        prompt = f"""
You are an expert technical document reviewer. Your role is to carefully analyze the document below, 
identify any issues, and propose clear corrections while respecting the provided validation rules.

You must:
1. Detect grammar, factual, logical, or formatting issues.
2. Identify which rules are violated.
3. Suggest improved or corrected versions of the problematic sentences or sections.
4. Keep your response concise but complete.

Validation Rules:
{rules}

Document Section:
{chunk}

Respond strictly in JSON:
{{
  "valid": true or false,
  "violated_rules": [list of violated rules or []],
  "issues_detected": [list of specific problems found],
  "corrections": [list of corrected sentences/sections],
  "explanation": "brief explanation of reasoning"
}}

If everything is correct, respond with:
{{
  "valid": true,
  "violated_rules": [],
  "issues_detected": [],
  "corrections": [],
  "explanation": "The document complies fully with the rules."
}}
"""
    else:
        # OpenAI / GPT-style prompt
        prompt = f"""
You are a professional document validator and corrector.

Your tasks:
- Review the following document section.
- Identify and fix any grammatical, logical, or structural errors.
- Ensure compliance with the provided rules.
- Suggest precise improvements where necessary.

Rules to follow:
{rules}

Document Section:
{chunk}

Return output strictly in valid JSON:
{{
  "valid": true or false,
  "violated_rules": [list of violated rules],
  "issues_detected": [short list of issues],
  "corrections": [list of corrected or improved sentences],
  "explanation": "brief reasoning for your corrections"
}}

If no issues are found, respond with:
{{
  "valid": true,
  "violated_rules": [],
  "issues_detected": [],
  "corrections": [],
  "explanation": "The document fully satisfies the rules."
}}
"""

    return prompt
