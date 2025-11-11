import json
from code_parser import find_python_tool_files, parse_python_tool
from excel_mapper import load_excel_mapping
from openai_qa import OpenAIQA
from policy_reader import extract_sop_requirements
from pathlib import Path
from config import OUTPUT_DIR
from typing import Dict, Any

class QAEngine:
    def __init__(self, policy_file: str, excel_file: str, python_dir: str,
                 excel_tool_col: str, excel_assoc_col: str, force_refresh_sop: bool=False):
        self.policy_file = policy_file
        self.excel_file = excel_file
        self.python_dir = python_dir
        self.excel_tool_col = excel_tool_col
        self.excel_assoc_col = excel_assoc_col
        self.openai = OpenAIQA()
        self.sops = extract_sop_requirements(policy_file, force_refresh=force_refresh_sop)
        self.mapping = load_excel_mapping(excel_file, excel_tool_col, excel_assoc_col)

    def run(self) -> Dict[str, Any]:
        results = {}
        py_files = find_python_tool_files(self.python_dir)
        for f in py_files:
            tool_name = f.stem
            parsed = parse_python_tool(str(f))
            code_text = Path(f).read_text(encoding='utf-8')
            policy_spec = self.sops.get(tool_name, {})
            expected_tables = self.mapping.get(tool_name, [])

            # 1) Compliance check (policy + excel)
            try:
                compliance = self.openai.run_compliance_check(tool_name, policy_spec, expected_tables, code_text)
            except Exception as e:
                compliance = {"error": str(e)}

            # 2) Logical QA
            try:
                logical = self.openai.run_logical_qa(tool_name, code_text)
            except Exception as e:
                logical = {"error": str(e)}

            results[tool_name] = {
                "parsed_static": parsed,
                "policy_spec": policy_spec,
                "expected_tables": expected_tables,
                "compliance": compliance,
                "logical_qa": logical
            }

        # Also check for missing/extra implementations
        results["_summary_checks"] = self._check_missing_and_extra(py_files)
        # Write outputs
        out_json = OUTPUT_DIR / "qa_report.json"
        out_md = OUTPUT_DIR / "qa_report.md"
        out_json.write_text(json.dumps(results, indent=2), encoding='utf-8')
        out_md.write_text(self._compose_markdown(results), encoding='utf-8')
        return results

    def _check_missing_and_extra(self, py_files):
        python_tools = {f.stem for f in py_files}
        excel_tools = set(self.mapping.keys())
        missing = excel_tools - python_tools
        extra = python_tools - excel_tools
        return {"missing": list(missing), "extra": list(extra)}

    def _compose_markdown(self, results: dict) -> str:
        parts = ["# QA Report\n"]
        checks = results.get("_summary_checks", {})
        parts.append(f"**Missing implementations (in Excel but not in code):** {len(checks.get('missing',[]))}\n")
        parts.append(f"**Extra implementations (in code but not in Excel):** {len(checks.get('extra',[]))}\n\n")
        for tool, item in results.items():
            if tool == "_summary_checks":
                continue
            parts.append(f"## Tool: `{tool}`\n")
            comp = item.get("compliance", {})
            if isinstance(comp, dict):
                v = comp.get("llm_verdict") or comp.get("verdict") or "Unknown"
                parts.append(f"- **Compliance verdict**: {v}\n")
                reason = comp.get("llm_reason") if isinstance(comp, dict) else None
                if reason:
                    parts.append(f"  - Reason: {reason}\n")
                suggestions = comp.get("suggestions") or []
                if suggestions:
                    parts.append("  - Suggestions:\n")
                    for s in suggestions:
                        parts.append(f"    - {s}\n")
            logical = item.get("logical_qa", {})
            if isinstance(logical, dict):
                parts.append(f"- **Logical QA score**: {logical.get('score', 'N/A')}\n")
                issues = logical.get("issues") or []
                if issues:
                    parts.append("  - Issues:\n")
                    for iss in issues:
                        parts.append(f"    - {iss}\n")
                if logical.get("recommendations"):
                    parts.append("  - Recommendations:\n")
                    for r in logical.get("recommendations"):
                        parts.append(f"    - {r}\n")
            parts.append("\n---\n")
        return "\n".join(parts)
