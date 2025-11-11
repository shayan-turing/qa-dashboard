import json
import ast
import os
import re
import functools
from typing import Dict, Any, Tuple

# In-memory cache for parsed environments (safe to reuse)
_env_cache: Dict[str, Dict[str, Any]] = {}


########################## AST UTILITIES #######################################

def ast_to_python_value(node):
    """Convert AST node to Python value."""
    if isinstance(node, ast.Constant):
        return node.value
    elif isinstance(node, ast.Str):
        return node.s
    elif isinstance(node, ast.Num):
        return node.n
    elif isinstance(node, ast.List):
        return [ast_to_python_value(item) for item in node.elts]
    elif isinstance(node, ast.Dict):
        return {ast_to_python_value(k): ast_to_python_value(v)
                for k, v in zip(node.keys, node.values)}
    elif isinstance(node, ast.Name):
        return f"<variable: {node.id}>"
    return f"<{type(node).__name__}>"


def extract_file_info(file_path: str) -> Tuple[Dict, str, list]:
    """Extract info about functions and imports from a Tool class."""
    try:
        with open(file_path, "r") as f:
            content = f.read()

        imports = [
            line.strip()
            for line in re.findall(r'^(?:from|import)\s+[^\n]+', content, re.MULTILINE)
            if "tau_bench.envs.tool" not in line
        ]

        tree = ast.parse(content)
        invoke_method = None
        function_info = {}

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == "invoke":
                start, end = node.lineno - 1, node.end_lineno
                invoke_method = "\n".join(content.splitlines()[start:end])

        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef) and node.name == "get_info":
                for sub in ast.walk(node):
                    if isinstance(sub, ast.Return):
                        return_dict = ast_to_python_value(sub.value)
                        if isinstance(return_dict, dict) and "function" in return_dict:
                            f = return_dict["function"]
                            function_info = {
                                "name": f.get("name", ""),
                                "description": f.get("description", ""),
                                "parameters": f.get("parameters", {}).get("properties", {}),
                                "required": f.get("parameters", {}).get("required", []),
                            }
        return function_info, invoke_method, imports

    except Exception as e:
        return {"error": str(e)}, None, []


########################## ENVIRONMENT LOADING #################################

@functools.lru_cache(maxsize=20)
def load_environment(env_dir: str, interface: str) -> Dict[str, Any]:
    """Load environment & cache parsed tools for performance."""
    if not os.path.exists(env_dir):
        raise FileNotFoundError(f"Environment not found: {env_dir}")

    data_dir = os.path.join(env_dir, "data")
    tools_dir = os.path.join(env_dir, "tools", f"interface_{interface}")

    data = {}
    if os.path.exists(data_dir):
        for f in os.listdir(data_dir):
            if f.endswith(".json"):
                with open(os.path.join(data_dir, f), "r") as jf:
                    data[f.split(".")[0]] = json.load(jf)

    invoke_methods, functions_info, imports_set = [], [], set()

    if not os.path.exists(tools_dir):
        raise FileNotFoundError(f"Tools directory not found: {tools_dir}")

    for file in os.listdir(tools_dir):
        if not file.endswith(".py") or file.startswith("__"):
            continue
        info, invoke, imports = extract_file_info(os.path.join(tools_dir, file))
        if info and invoke:
            imports_set.update(imports)
            invoke_methods.append(invoke.replace("invoke", info["name"] + "_invoke"))
            functions_info.append(info)

    return {
        "data": data,
        "imports": list(imports_set),
        "invoke_methods": invoke_methods,
        "functions_info": functions_info
    }


def env_interface(environment: str, interface: str, envs_path="envs") -> Dict[str, Any]:
    """Normalize environment path and load environment."""
    env_dir = environment if os.path.isabs(environment) or environment.startswith(envs_path) \
        else os.path.join(envs_path, environment)

    cache_key = f"{env_dir}::{interface}"
    if cache_key in _env_cache:
        return _env_cache[cache_key]

    env_data = load_environment(env_dir, interface)
    _env_cache[cache_key] = env_data
    return env_data


########################## EXECUTION ###########################################

def create_tools_class(imports_set, invoke_methods):
    imports_code = "\n".join(imports_set)
    class_code = f"{imports_code}\n\nclass Tools:\n"
    for method in invoke_methods:
        class_code += f"    @staticmethod\n    {method}\n\n"

    ns = {}
    exec(class_code, ns)
    return ns["Tools"]


def execute_api(api_name: str, arguments: Dict[str, Any], env_data: Dict[str, Any]):
    """Execute API safely inside its environment."""
    api_name = api_name + "_invoke"
    tools_class = create_tools_class(env_data["imports"], env_data["invoke_methods"])

    if not hasattr(tools_class, api_name):
        return {"error": f"API '{api_name}' not found"}, 404

    try:
        result = getattr(tools_class, api_name)(data=env_data["data"], **arguments)
        return result if isinstance(result, dict) else json.loads(result), 200
    except Exception as e:
        return {"error": str(e)}, 500
