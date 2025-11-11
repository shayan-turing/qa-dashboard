RULE_SETS = {
    "SOP Rules": [
        "Every SOP must be concise, imperative, and tool-first. No internal tool workings.",
        "When to use: one-sentence trigger.",
        "Steps: sequence of 2+ tool calls; describe how each tool is used."
    ],

    "SOP Template Lookalike Rules": [
        "When to use: <one sentence>.",
        "Inputs: <list required/optional; include approval_code if required>.",
        """Steps:
        1. Obtain <inputs>.
        2. Call <tool_1(signature)> to <purpose>.
        3. Then call <tool_2(signature)> to <purpose>.
        4. Create an audit entry with create_new_audit_trail(...)."""
    ]
}
