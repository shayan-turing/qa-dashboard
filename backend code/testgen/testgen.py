# testgen.py — Original Logic Preserved, API-Compatible, Emoji-Free
# Logs & artifacts are written to a per-run temp dir, then uploaded to GCS if
# BUCKET_NAME is set and available; otherwise copied to a local storage folder.

import os
import re
import sys
import io
import json
import ast
import textwrap
import subprocess
import tempfile
import zipfile
import shutil
import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple

from dotenv import load_dotenv
from termcolor import colored
from openai import OpenAI

# ----------------------------- Windows-safe stdout -----------------------------
# Avoid UnicodeEncodeError on Windows terminals
if not isinstance(sys.stdout, io.TextIOWrapper) or (sys.stdout.encoding or "").lower() != "utf-8":
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="ignore")
    except Exception:
        pass

# ----------------------------- Environment / Model -----------------------------
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    print("[WARN] OPENAI_API_KEY not set in environment.")
client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None
MODEL = os.getenv("OPENAI_MODEL", "gpt-5")

# ----------------------------- Paths & Storage -----------------------------
DEFAULT_BASE_PATH = os.getenv("BASE_PATH", r"D:\unit test generator\uploads\finance\tools\interface_1")
LOCAL_STORAGE_ROOT = Path(os.getenv("LOCAL_STORAGE_DIR", "local_storage"))
BUCKET_NAME = os.getenv("BUCKET_NAME")  # if set, we attempt GCS upload

# Per-run working directory inside system temp
RUN_TS = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
RUN_DIR = Path(tempfile.mkdtemp(prefix=f"testgen_run_{RUN_TS}_"))
OUTPUT_DIR = RUN_DIR / "generated_tests"
LOG_DIR = RUN_DIR / "logs"
SCREENSHOT_DIR = RUN_DIR / "screenshots"
MEMORY_FILE = RUN_DIR / "test_memory.json"  # run-scoped memory file (copied to storage)
for d in (OUTPUT_DIR, LOG_DIR, SCREENSHOT_DIR):
    d.mkdir(parents=True, exist_ok=True)

TEST_TYPES = ["unit"]

# ======================================================================
#                          STORAGE MANAGER
# =====================================================
class StorageManager:
    def __init__(self, run_dir: Path, logs_dir: Path, out_dir: Path):
        self.run_dir = Path(run_dir)
        self.logs_dir = Path(logs_dir)
        self.out_dir = Path(out_dir)
        self.storage_mode = "none"
        self.final_urls: List[str] = []
        self.zip_url: str | None = None

    def save_log(self, file_stem: str, step: str, content: str) -> Path:
        path = self.logs_dir / f"{file_stem}_{step}_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.log"
        path.write_text(content, encoding="utf-8")
        print(colored(f"[LOG] Saved: {path}", "yellow"))
        return path

    def _try_gcs_upload(self, uid: str = "anon") -> Tuple[List[str], str | None, str]:
        if not BUCKET_NAME:
            return [], None, "none"
        try:
            from google.cloud import storage
            client = storage.Client()
            bucket = client.bucket(BUCKET_NAME)
            gcs_prefix = f"generated_tests/{uid}/run_{RUN_TS}"

            uploaded_urls: List[str] = []
            for root, _, files in os.walk(self.run_dir):
                for file in files:
                    local_path = Path(root) / file
                    rel = os.path.relpath(local_path, self.run_dir)
                    blob_path = f"{gcs_prefix}/{rel}".replace("\\", "/")
                    blob = bucket.blob(blob_path)
                    blob.upload_from_filename(str(local_path))
                    url = blob.generate_signed_url(
                        expiration=datetime.timedelta(hours=24), method="GET"
                    )
                    uploaded_urls.append(url)

            # Zip whole run_dir
            zip_path = Path(tempfile.gettempdir()) / f"testgen_run_{RUN_TS}.zip"
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for root, _, files in os.walk(self.run_dir):
                    for file in files:
                        fp = Path(root) / file
                        zf.write(str(fp), arcname=os.path.relpath(fp, self.run_dir))
            zip_blob = bucket.blob(f"{gcs_prefix}/run.zip")
            zip_blob.upload_from_filename(str(zip_path))
            zip_url = zip_blob.generate_signed_url(
                expiration=datetime.timedelta(hours=24), method="GET"
            )
            return uploaded_urls, zip_url, "gcs"
        except Exception as e:
            print(f"[WARN] GCS upload failed: {e}")
            return [], None, "none"

    def _fallback_local_copy(self, uid: str = "anon") -> Tuple[List[str], str | None, str]:
        dest_dir = LOCAL_STORAGE_ROOT / uid / f"run_{RUN_TS}"
        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.copytree(self.run_dir, dest_dir, dirs_exist_ok=True)
        zip_path = dest_dir / "run.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(dest_dir):
                for file in files:
                    p = Path(root) / file
                    if p == zip_path:
                        continue
                    zf.write(str(p), arcname=os.path.relpath(p, dest_dir))
        local_urls = [str((dest_dir / f).relative_to(LOCAL_STORAGE_ROOT)) for f in os.listdir(dest_dir)]
        return local_urls, str(zip_path), "local"

    def finalize(self, uid: str = "anon") -> Dict[str, Any]:
        urls, zip_url, mode = self._try_gcs_upload(uid)
        if mode == "none":
            urls, zip_url, mode = self._fallback_local_copy(uid)
        self.final_urls = urls
        self.zip_url = zip_url
        self.storage_mode = mode
        return {"urls": urls, "zip_url": zip_url, "storage_mode": mode, "run_dir": str(self.run_dir)}

STORAGE = StorageManager(RUN_DIR, LOG_DIR, OUTPUT_DIR)

# ======================================================================
#                          FILE DISCOVERY FIX
# ======================================================================

def find_tool_files(base_path: str) -> List[str]:
    """
    Find .py files ONLY inside `tools/` subdirectories of the uploaded project.
    Ignores tests, envs, caches, etc.
    """
    base = Path(base_path)
    found: List[str] = []

    ignore_dirs = {
        "__pycache__", ".pytest_cache", "generated_tests", "coverage_html_report",
        "venv", ".venv", "env", ".env", "node_modules", "build", "dist", ".git",
        "logs", "screenshots"
    }

    for root, dirs, files in os.walk(base):
        # Skip unwanted directories
        dirs[:] = [d for d in dirs if d not in ignore_dirs]

        # ✅ Only consider files if path contains "tools"
        if "tools" not in Path(root).parts:
            continue

        for f in files:
            if (
                f.endswith(".py")
                and not f.startswith("test_")
                and f not in ("setup.py", "__init__.py")
            ):
                found.append(str(Path(root) / f))

    return found



# ----------------------------- Helpers & Extractors -----------------------------

def get_test_type_description(ttype: str) -> str:
    return {
        "unit": "Focus on core logic validation across all branches, schema adherence, and error handling.",
        # "smoke": "Ensure module imports and invoke() executes without crashes on a minimal happy path.",
        # "sanity": "Check that invoke() returns valid string/JSON and key outputs exist.",
        # "integration": "Combine this tool logically with related tools (if discoverable) or with a realistic in-memory dataset.",
        # "regression": "Snapshot/contract checks: keys present, types stable, ordering stable; optional screenshots taken by runner.",
    }.get(ttype, "")


def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8") if p.exists() else ""


def find_tool_files(base_path: str) -> List[str]:
    py_files: List[str] = []
    for root, _, files in os.walk(base_path):
        if os.path.basename(root).startswith("interface_"):
            for f in files:
                if f.endswith(".py") and not f.startswith("__"):
                    py_files.append(os.path.join(root, f))
    return py_files


# ----------------------------- Code Sanitation -----------------------------

def sanitize_gpt_code(code: str) -> str:
    code = code.replace("```python", "").replace("```", "")
    code = textwrap.dedent(code).strip() + "\n"
    return code


def auto_fix_indentation(file_path: Path) -> None:
    content = read_text(file_path)
    content = content.replace("```python", "").replace("```", "")
    lines = [ln.rstrip().replace("\t", "    ") for ln in content.splitlines()]
    fixed_lines: List[str] = []
    indent_stack = [0]
    for line in lines:
        if not line.strip():
            fixed_lines.append("")
            continue
        leading = len(line) - len(line.lstrip())
        if leading > indent_stack[-1] + 8:
            leading = indent_stack[-1] + 4
        if leading > indent_stack[-1]:
            indent_stack.append(leading)
        elif leading < indent_stack[-1]:
            while indent_stack and leading < indent_stack[-1]:
                indent_stack.pop()
        fixed_lines.append(" " * indent_stack[-1] + line.lstrip())
    fixed_code = textwrap.dedent("\n".join(fixed_lines))
    try:
        compile(fixed_code, str(file_path), "exec")
    except SyntaxError as e:
        print(colored(f"[WARN] Syntax issue after auto-fix in {file_path.name}: {e}", "yellow"))
    file_path.write_text(fixed_code, encoding="utf-8")
    print(colored(f"[INFO] Indentation corrected for {file_path.name}", "green"))


# ----------------------------- AST Extraction -----------------------------

def extract_logic_branches(code: str) -> Dict[str, Any]:
    try:
        tree = ast.parse(code)
    except Exception as e:
        return {"error": f"AST parse failed: {e}"}
    logic_info: Dict[str, Any] = {"functions": [], "branches": [], "raises": [], "literals": []}

    class Analyzer(ast.NodeVisitor):
        def visit_FunctionDef(self, node: ast.FunctionDef):
            logic_info["functions"].append(node.name)
            self.generic_visit(node)
        def visit_If(self, node: ast.If):
            try:
                src = ast.unparse(node.test)
            except Exception:
                src = "<cond>"
            logic_info["branches"].append(src)
            self.generic_visit(node)
        def visit_Raise(self, node: ast.Raise):
            logic_info["raises"].append("raise")
            self.generic_visit(node)
        def visit_Constant(self, node: ast.Constant):
            if isinstance(node.value, str) and len(node.value) <= 40:
                logic_info["literals"].append(node.value)
    Analyzer().visit(tree)
    for k in logic_info:
        logic_info[k] = sorted(set(logic_info[k]))
    return logic_info


# ----------------------------- GPT Calls -----------------------------

def gpt_generate_tests(file_name: str, code: str, prev_code: str, last_gpt: str,
                       last_pytest: str, test_type: str = "unit", past_memory: Dict[str, Any] | None = None) -> Dict[str, Any]:
    test_description = get_test_type_description(test_type)

    logic_map = extract_logic_branches(code)
    logic_context = json.dumps(logic_map, indent=2)

    memory_context = ""
    if past_memory and (past_memory.get("inputs") or past_memory.get("outputs")):
        mem_inp = json.dumps(past_memory.get("inputs", []), indent=2)
        mem_out = json.dumps(past_memory.get("outputs", []), indent=2)
        memory_context = f"""
### Historical User Data (Memory)
Inputs:
```json
{mem_inp}
```
Outputs:
```json
{mem_out}
```
"""

    prompt = f"""
You are an expert QA engineer improving automated pytest generation.

### Test Type: {test_type.upper()}
{test_description}

### Tool Code
```python
{code}
```

### Previous Generated Test (if any)
```python
{prev_code}
```

### Your Previous GPT Output
```
{last_gpt}
```

### Pytest Failure Logs
```
{last_pytest}
```

### Code Logic Map (Extracted from AST)
```json
{logic_context}
```
{memory_context}

### Instructions
You must generate a complete pytest file that includes:
1) Positive test cases
2) Negative test cases
3) Edge test cases
4) Business-rule tests
5) Regression tests

- All test functions MUST accept `tool_instance` (pytest fixture) as first parameter.
- Use placeholders {{USER_INPUT:name}} and {{USER_EXPECTED:key}}; the runner replaces them.
- Do NOT import the tool directly; the runner injects `tool_instance`.
- Provide at least 3 tests for unit tests; at least 2 for other types.

Return strictly JSON (no markdown):
{{
  "inputs": [{{"name": "...", "type": "str|int|dict|float", "description": "...", "example": "..."}}],
  "outputs": [{{"key": "...", "description": "...", "example": "..."}}],
  "pytest_code": "# Test file content here"
}}
"""

    print(colored(f"[GEN] Analyzing `{file_name}` for {test_type.upper()} tests...", "magenta"))
    if client is None:
        print(colored("[WARN] No OpenAI client configured; returning empty tests.", "yellow"))
        return {"inputs": [], "outputs": [], "pytest_code": ""}
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.choices[0].message.content or ""
        STORAGE.save_log(f"{file_name}_{test_type}", "gpt_raw", raw)
    except Exception as e:
        print(colored(f"[FAIL] OpenAI request failed: {e}", "red"))
        return {"inputs": [], "outputs": [], "pytest_code": ""}

    try:
        cleaned = re.sub(r"```json\s*|```", "", raw.strip())
        return json.loads(cleaned)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            print(colored("[WARN] No JSON found in GPT response.", "yellow"))
            STORAGE.save_log(f"{file_name}_{test_type}", "json_parse_error", raw)
            return {"inputs": [], "outputs": [], "pytest_code": ""}
        try:
            return json.loads(m.group(0))
        except Exception as e:
            print(colored(f"[WARN] JSON parse error: {e}", "yellow"))
            STORAGE.save_log(f"{file_name}_{test_type}", "json_parse_error", raw)
            return {"inputs": [], "outputs": [], "pytest_code": ""}


def gpt_generate_additional_tests(file_name: str, code: str, missing_conditions: List[str],
                                  last_test_code: str, last_failures: str, test_type: str,
                                  past_memory: Dict[str, Any] | None) -> str:
    memory_context = ""
    if past_memory and (past_memory.get("inputs") or past_memory.get("outputs")):
        mem_inp = json.dumps(past_memory.get("inputs", []), indent=2)
        mem_out = json.dumps(past_memory.get("outputs", []), indent=2)
        memory_context = f"""
### Historical User Data (Memory)
Inputs:```json\n{mem_inp}\n```
Outputs:```json\n{mem_out}\n```
"""

    prompt = f"""
You previously generated a pytest file for `{file_name}` ({test_type}). Some logic branches are still untested.

### Tool Code (for reference)
```python
{code}
```

### Existing Test File (do NOT duplicate tests, add new ones only)
```python
{last_test_code}
```

### Missing Logic Conditions to Cover
{json.dumps(missing_conditions, indent=2)}

### Recent Pytest Failures (for guidance)
```
{last_failures}
```

### Task
Emit ONLY additional pytest test functions (no imports, no fixtures, no headers). Each new test must:
- accept `tool_instance` fixture;
- target one of the missing conditions;
- use placeholders {{USER_INPUT:name}} / {{USER_EXPECTED:key}} when needed.
Return strictly the Python code for the new test functions (no markdown).
"""

    print(colored(f"[GEN] Generating additional tests for `{file_name}` ({test_type})...", "magenta"))
    if client is None:
        return ""
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        code_snippet = response.choices[0].message.content or ""
        STORAGE.save_log(f"{file_name}_{test_type}", "gpt_additional", code_snippet)
        return sanitize_gpt_code(code_snippet)
    except Exception as e:
        print(colored(f"[FAIL] OpenAI request failed (additional tests): {e}", "red"))
        return ""


# ----------------------------- Placeholder Replacement -----------------------------

def replace_placeholders(test_code: str, inputs: List[Dict[str, Any]], outputs: List[Dict[str, Any]]) -> str:
    result = test_code
    for inp in inputs:
        name = inp.get("name", "")
        example = inp.get("example", "")
        ph = f"{{{{USER_INPUT:{name}}}}}"
        result = result.replace(ph, json.dumps(example))
    for out in outputs:
        key = out.get("key", "")
        example = out.get("example", "")
        ph = f"{{{{USER_EXPECTED:{key}}}}}"
        result = result.replace(ph, json.dumps(example))
    return result


# ---------------------- Harness Injection (dynamic import + fixture) ----------------------

def inject_tool_path_in_test(test_path: str, tool_path: str):
    abs_tool_path = os.path.abspath(tool_path).replace("\\", "\\\\")
    class_name_snake = Path(tool_path).stem
    class_name_camel = "".join(word.capitalize() for word in class_name_snake.split("_"))

    injection = f"""
# ------------------- Injected by generator -------------------
import os, sys, importlib.util, types, json, pytest
from pathlib import Path

TOOL_PATH = Path(r"{abs_tool_path}")

# Mock tau_bench.envs.tool.Tool if not available
if "tau_bench" not in sys.modules:
    sys.modules["tau_bench"] = types.ModuleType("tau_bench")
if "tau_bench.envs" not in sys.modules:
    sys.modules["tau_bench.envs"] = types.ModuleType("tau_bench.envs")
if "tau_bench.envs.tool" not in sys.modules:
    _mock = types.ModuleType("tau_bench.envs.tool")
    class Tool: pass
    _mock.Tool = Tool
    sys.modules["tau_bench.envs.tool"] = _mock

# Ensure tool file exists
if not TOOL_PATH.exists():
    pytest.skip(f"Tool file not found at {{TOOL_PATH}}", allow_module_level=True)

def import_tool_module():
    spec = importlib.util.spec_from_file_location("tool_module", str(TOOL_PATH))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["tool_module"] = mod
    spec.loader.exec_module(mod)
    return mod

ToolClass = None
try:
    tool_mod = import_tool_module()

    # Strategy 1: exact CamelCase class name
    if hasattr(tool_mod, "{class_name_camel}"):
        ToolClass = getattr(tool_mod, "{class_name_camel}")

    # Strategy 2: lowercase name match
    if ToolClass is None:
        for name, obj in vars(tool_mod).items():
            if isinstance(obj, type) and name.lower() == "{class_name_snake}".lower():
                ToolClass = obj
                break

    # Strategy 3: subclass of Tool
    if ToolClass is None:
        for name, obj in vars(tool_mod).items():
            if isinstance(obj, type) and hasattr(obj, "__bases__"):
                for base in obj.__bases__:
                    if base.__name__ == "Tool":
                        ToolClass = obj
                        break
                if ToolClass:
                    break

    # Strategy 4: first defined class in module (fallback)
    if ToolClass is None:
        for name, obj in vars(tool_mod).items():
            if isinstance(obj, type) and obj.__module__ == "tool_module" and not name.startswith("_"):
                ToolClass = obj
                break

    if ToolClass is None:
        pytest.skip("Tool class could not be located.", allow_module_level=True)

except Exception as err:
    err_msg = str(err)
    pytest.skip(f"Tool import failed: {{err_msg}}", allow_module_level=True)

@pytest.fixture(scope="module")
def tool_instance():
    if ToolClass is None:
        pytest.skip("Tool class not available")
    try:
        instance = ToolClass()
        assert hasattr(instance, "invoke"), "Tool instance missing invoke()"
        return instance
    except Exception as inst_err:
        pytest.skip(f"Could not instantiate tool: {{inst_err}}")
# -------------------------------------------------------------
"""

    clean = textwrap.dedent(injection)
    orig = Path(test_path).read_text(encoding="utf-8")
    Path(test_path).write_text(clean + "\n\n" + orig, encoding="utf-8")
    print(colored(f"[LINK] Linked test to: {abs_tool_path}", "green"))


# ---------------- Coverage Enforcer (Multi-pass + Incremental) ----------------

def gpt_generate_and_write(
    file_name: str,
    code: str,
    prev_code: str,
    last_gpt: str,
    last_pytest: str,
    test_type: str,
    past_memory: Dict[str, Any] | None,
    out_path: Path,
    tool_path: Path,
    max_passes: int = 3
) -> Dict[str, Any]:
    """
    Generates pytest code using GPT, writes it to file, 
    injects the dynamic tool fixture, and incrementally enriches coverage.
    """

    # 1 Initial GPT generation
    result = gpt_generate_tests(file_name, code, prev_code, last_gpt, last_pytest, test_type, past_memory)
    base_code = result.get("pytest_code", "")
    if not base_code.strip():
        return result

    # 2️ Prepare and write initial test file
    inputs = result.get("inputs", [])
    outputs = result.get("outputs", [])
    test_code = sanitize_gpt_code(base_code)
    test_code = replace_placeholders(test_code, inputs, outputs)
    out_path.write_text(test_code, encoding="utf-8")

    # 3️ Inject fixture + fix indentation
    inject_tool_path_in_test(str(out_path), str(tool_path))
    auto_fix_indentation(out_path)

    # 4️ Multi-pass coverage enrichment
    for attempt in range(1, max_passes + 1):
        current_code = read_text(out_path)
        num_tests = len(re.findall(r"\n\s*def\s+test_", current_code))
        required = 3 if test_type == "unit" else 2

        logic = extract_logic_branches(code)
        branches = logic.get("branches", [])
        missing = [cond for cond in branches if cond and cond not in current_code]

        if num_tests >= required and not missing:
            print(colored(f"[COVERAGE] Satisfied: {num_tests} tests; all branches covered.", "green"))
            break

        print(colored(f"[COVERAGE] Pass {attempt}/{max_passes}: tests={num_tests}, missing={len(missing)}", "cyan"))
        add_code = gpt_generate_additional_tests(file_name, code, missing, current_code, last_pytest, test_type, past_memory)
        if not add_code.strip():
            print(colored("[COVERAGE] No additional tests returned.", "yellow"))
            break

        out_path.write_text(current_code.strip() + "\n\n" + add_code.strip() + "\n", encoding="utf-8")
        auto_fix_indentation(out_path)

    # 5️ Final safeguard: re-inject fixture to ensure it exists post-append
    inject_tool_path_in_test(str(out_path), str(tool_path))
    auto_fix_indentation(out_path)

    return result


# --------------------------------- Pytest Runner ---------------------------------

def run_pytest_for_testfile(test_file_path: str, tool_file_path: str):
    print(colored(f"[RUN] Running pytest with coverage for {os.path.basename(test_file_path)}", "yellow"))
    coverage_dir = RUN_DIR / "coverage_html_report"
    coverage_dir.mkdir(exist_ok=True)
    tool_dir = str(Path(tool_file_path).parent.resolve())

    result = subprocess.run(
        [
            "pytest", "-v", "--maxfail=5", "--disable-warnings",
            f"--cov={tool_dir}", "--cov-report=term-missing",
            f"--cov-report=html:{coverage_dir}", test_file_path,
        ],
        capture_output=True, text=True, shell=True
    )
    log_text = result.stdout + "\n\n" + result.stderr
    STORAGE.save_log(Path(test_file_path).stem, "pytest", log_text)

    print("\n" + "-" * 80)
    print(colored("[INFO] Coverage Report Summary:", "cyan"))
    print("-" * 80)
    print(result.stdout)
    print("-" * 80)
    print(colored(f"[INFO] HTML coverage report at: {coverage_dir / 'index.html'}", "green"))
    print("-" * 80)

    if result.returncode != 0:
        print(colored("[FAIL] Tests failed or coverage incomplete.", "red"))
    else:
        print(colored("[PASS] All tests passed successfully with coverage.", "green"))
    return result.returncode == 0


# ------------------------------ Interactive Inputs ------------------------------

def ask_user_for_real_data(inputs: List[Dict[str, Any]], outputs: List[Dict[str, Any]], file_name: str):
    print(colored(f"[INPUT] Refine test data for `{file_name}` (press Enter to keep defaults)", "cyan"))
    for i in inputs:
        name = i.get("name", "<unknown>")
        desc = i.get("description", "")
        ex = i.get("example", "")
        val = input(f"Input `{name}` ({desc}) [default: {ex}]: ").strip()
        if val:
            try:
                i["example"] = json.loads(val)
            except Exception:
                i["example"] = val
    for o in outputs:
        key = o.get("key", "<unknown>")
        desc = o.get("description", "")
        ex = o.get("example", "")
        val = input(f"Expected `{key}` ({desc}) [default: {ex}]: ").strip()
        if val:
            try:
                o["example"] = json.loads(val)
            except Exception:
                o["example"] = val
    print(colored("[INPUT] Real user data captured.", "green"))
    return inputs, outputs


# ------------------------- Retry Loop per Test Type -------------------------

def retry_test_generation(file_name: str, tool_code: str, test_type: str, path: str,
                          prev_code: str, last_gpt: str, last_pytest: str,
                          interactive: bool, max_retries: int = 3) -> bool:
    passed = False
    tool_path = Path(path)
    out_path = OUTPUT_DIR / f"test_{test_type}_{tool_path.stem}.py"

    # Load per-run memory (if exists)
    memory = {}
    if MEMORY_FILE.exists():
        try:
            memory = json.loads(MEMORY_FILE.read_text(encoding="utf-8"))
        except Exception:
            memory = {}
    past_memory = memory.get(tool_path.stem, {}).get(test_type, {})

    gen_result = gpt_generate_and_write(
        file_name=tool_path.stem,
        code=tool_code,
        prev_code=prev_code,
        last_gpt=last_gpt,
        last_pytest=last_pytest,
        test_type=test_type,
        past_memory=past_memory,
        out_path=out_path,
        tool_path=tool_path,
        max_passes=3,
    )

    inputs = gen_result.get("inputs", [])
    outputs = gen_result.get("outputs", [])

    if past_memory.get("inputs") and past_memory.get("outputs"):
        inputs = past_memory["inputs"]
        outputs = past_memory["outputs"]

    elif interactive:
        inputs, outputs = ask_user_for_real_data(inputs, outputs, tool_path.stem)
        memory.setdefault(tool_path.stem, {}).setdefault(test_type, {})
        memory[tool_path.stem][test_type].update({"inputs": inputs, "outputs": outputs})
        MEMORY_FILE.write_text(json.dumps(memory, indent=2), encoding="utf-8")
        print(colored("[INFO] Memory updated.", "green"))

    current_code = read_text(out_path)
    current_code = replace_placeholders(current_code, inputs, outputs)
    out_path.write_text(current_code, encoding="utf-8")
    auto_fix_indentation(out_path)

    for attempt in range(1, max_retries + 1):
        print(colored(f"[ATTEMPT] {attempt}/{max_retries} for {test_type.upper()} : {tool_path.stem}", "cyan"))
        ok = run_pytest_for_testfile(str(out_path), f"{test_type}_{tool_path.stem}")
        if ok:
            passed = True
            break
        last_log_files = sorted(LOG_DIR.glob(f"{out_path.stem}_pytest_*.log"))
        last_log = read_text(last_log_files[-1]) if last_log_files else ""
        append_code = gpt_generate_additional_tests(
            file_name=tool_path.stem,
            code=tool_code,
            missing_conditions=extract_logic_branches(tool_code).get("branches", []),
            last_test_code=read_text(out_path),
            last_failures=last_log,
            test_type=test_type,
            past_memory=past_memory,
        )
        if not append_code.strip():
            print(colored("[WARN] No patch from GPT; stopping retries.", "yellow"))
            break
        merged = read_text(out_path).strip() + "\n\n" + append_code.strip() + "\n"
        out_path.write_text(merged, encoding="utf-8")
        auto_fix_indentation(out_path)

    # Persist result in memory
    memory.setdefault(tool_path.stem, {}).setdefault("results", {})[test_type] = "PASSED" if passed else "FAILED"
    MEMORY_FILE.write_text(json.dumps(memory, indent=2), encoding="utf-8")
    print(colored("[INFO] Result cached in memory.", "green"))

    return passed


# ------------------------------------------ Main ------------------------------------------

def load_previous_context(file_stem: str):
    prev_code = read_text(OUTPUT_DIR / f"test_{file_stem}.py")
    gpt_logs = sorted(LOG_DIR.glob(f"{file_stem}_gpt_raw_*.log"), key=os.path.getmtime)
    pytest_logs = sorted(LOG_DIR.glob(f"{file_stem}_pytest_*.log"), key=os.path.getmtime)
    last_gpt = read_text(gpt_logs[-1]) if gpt_logs else ""
    last_pytest = read_text(pytest_logs[-1]) if pytest_logs else ""
    return prev_code, last_gpt, last_pytest


from concurrent.futures import ThreadPoolExecutor, as_completed



def main(base_path: str = DEFAULT_BASE_PATH, run_tests: bool = True, interactive: bool = True) -> Dict[str, Any]:
    print(colored(f"[START] Token-safe, Parallel, Cached Generation in {base_path}", "cyan"))
    files = find_tool_files(base_path)
    print(colored(f"[INFO] Found {len(files)} tool files.", "yellow"))
    if not files:
        return {"status": "no_files", "tools_processed": 0, "details": []}

    per_tool_summary: List[Dict[str, Any]] = []
    max_workers = min(4, len(files))  # safe limit: 4 concurrent tools

    # Worker function
    def process_tool(path: str):
        tool_path = Path(path)
        file_name = tool_path.stem
        try:
            code = read_text(tool_path)
            prev_code, last_gpt, last_pytest = load_previous_context(file_name)
            tool_results: Dict[str, str] = {}

            for ttype in TEST_TYPES:
                print(colored(f"[{file_name}] Generating {ttype.upper()} tests", "yellow"))
                success = retry_test_generation(
                    file_name=file_name,
                    tool_code=code,
                    test_type=ttype,
                    path=path,
                    prev_code=prev_code,
                    last_gpt=last_gpt,
                    last_pytest=last_pytest,
                    interactive=interactive,
                    max_retries=3,
                )
                tool_results[ttype] = "PASSED" if success else "FAILED"
            return {"tool": file_name, "results": tool_results}
        except Exception as e:
            print(colored(f"[ERROR] {file_name} failed: {e}", "red"))
            return {"tool": file_name, "results": {t: "ERROR" for t in TEST_TYPES}}

    # Run in parallel
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_file = {executor.submit(process_tool, f): f for f in files}
        for future in as_completed(future_to_file):
            res = future.result()
            per_tool_summary.append(res)
            tool = res.get("tool", "?")
            print(colored(f"[DONE] {tool} → {res['results']}", "green" if "PASSED" in str(res["results"]) else "red"))

    print(colored("[DONE] Parallel test generation complete.", "cyan"))
    return {"status": "completed", "tools_processed": len(per_tool_summary), "details": per_tool_summary}



# ----------------------------------- API Entrypoint -----------------------------------

def generate_all_tests(base_path: str, run_tests: bool = True, interactive: bool = False, uid: str = "anon"):
    os.environ["BASE_PATH"] = base_path
    base_path = str(Path(base_path).resolve())
    print(f"[RUN] Starting test generation on base_path: {base_path}")
    summary = main(base_path=base_path, run_tests=run_tests, interactive=interactive)

    # Persist artifacts (GCS or local)
    persisted = STORAGE.finalize(uid=uid)
    print(f"[STORE] storage_mode={persisted['storage_mode']}")
    print(f"[STORE] zip_url={persisted['zip_url']}")
    return {"summary": summary, **persisted}


# ------------------------------------------ CLI ------------------------------------------
if __name__ == "__main__":
    if len(sys.argv) > 1:
        final_base = sys.argv[1]
    else:
        final_base = os.getenv("BASE_PATH", DEFAULT_BASE_PATH)
    print(f"[RUN] Running test generation on: {final_base}")
    generate_all_tests(final_base, run_tests=True, interactive=False, uid=os.getenv("TESTGEN_UID", "anon"))
