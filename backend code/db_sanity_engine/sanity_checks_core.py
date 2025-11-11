import json
import yaml
import pandas as pd
from datetime import datetime

def load_json_as_df(content: str):
    """Load JSON content (string or dict) into DataFrame."""
    if isinstance(content, str):
        data = json.loads(content)
    else:
        data = content
    return pd.DataFrame.from_dict(data, orient="index"), data


def load_enum_defs(yaml_str: str):
    """Parse YAML enums."""
    try:
        data = yaml.safe_load(yaml_str)
        return data.get("enums", {}) if data else {}
    except Exception as e:
        return {"error": str(e)}


def fix_yaml_boolean_conversion(enum_defs):
    """Convert booleans back to string equivalents."""
    for table_name, table_enums in enum_defs.items():
        for col_name, values in table_enums.items():
            fixed = []
            for v in values:
                if v is True:
                    fixed.append("on")
                elif v is False:
                    fixed.append("off")
                else:
                    fixed.append(v)
            enum_defs[table_name][col_name] = fixed
    return enum_defs


def sanity_check_keys_are_strings(table_name, data, report):
    all_str = all(isinstance(k, str) for k in data.keys())
    report["checks"].append({
        "check": "Keys are strings",
        "result": all_str,
        "table": table_name
    })
    return all_str


def sanity_check_id_matches_key(table_name, data, report):
    first_record = next(iter(data.values()), None)
    if not first_record:
        report["checks"].append({
            "check": "File not empty",
            "result": False,
            "table": table_name
        })
        return False
    id_field = [c for c in first_record.keys() if c.endswith("_id")]
    if not id_field:
        report["checks"].append({
            "check": "Has *_id field",
            "result": False,
            "table": table_name
        })
        return False

    id_field = id_field[0]
    all_match = all(str(v.get(id_field)) == str(k) for k, v in data.items())
    report["checks"].append({
        "check": f"{id_field} matches key",
        "result": all_match,
        "table": table_name
    })
    return all_match


def sanity_check_pk_from_json(table_name, data, report):
    keys = list(data.keys())
    non_null = all(k not in (None, "") for k in keys)
    unique = len(keys) == len(set(keys))
    report["checks"].append({
        "check": "Primary keys non-null",
        "result": non_null,
        "table": table_name
    })
    report["checks"].append({
        "check": "Primary keys unique",
        "result": unique,
        "table": table_name
    })
    return non_null and unique


def sanity_check_enums(table_name, df, enum_defs, report):
    """Checks that enum values match definitions."""
    if table_name not in enum_defs:
        return True

    all_valid = True
    for col, allowed in enum_defs[table_name].items():
        if col not in df.columns:
            continue
        invalid = set(df[col].dropna().unique()) - set(allowed)
        valid = len(invalid) == 0
        all_valid &= valid
        report["checks"].append({
            "check": f"{col} enum values",
            "result": valid,
            "details": list(invalid)[:5],
            "table": table_name
        })
    return all_valid


def generate_report_summary(reports):
    """Compute pass/fail summary from checks."""
    total = len(reports)
    passes = sum(1 for c in reports if c["result"] is True)
    fails = sum(1 for c in reports if c["result"] is False)
    return {
        "total_checks": total,
        "passes": passes,
        "fails": fails,
        "pass_rate": f"{(passes / total * 100):.1f}%" if total else "0%"
    }
