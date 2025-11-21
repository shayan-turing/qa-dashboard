import os
import io
import json
import yaml
import zipfile
import shutil
import tempfile
import pandas as pd
from datetime import datetime, timezone

from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

from .sanity_checks_core import (
    load_json_as_df,
    load_enum_defs,
    fix_yaml_boolean_conversion,
    sanity_check_keys_are_strings,
    sanity_check_id_matches_key,
    sanity_check_pk_from_json,
    sanity_check_enums
)

from .sanity_checks_core_full import (
    check_foreign_keys,
    check_generic_foreign_keys
)

# -------------------------------------------------------------------
# Mongo Setup
# -------------------------------------------------------------------
load_dotenv()
mongo = MongoClient(os.getenv("MONGO_URI"))
db = mongo["docdiff"]


# -------------------------------------------------------------------
# Utility
# -------------------------------------------------------------------
def now():
    """Return current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def try_parse_objectid(value):
    """Try to parse string → ObjectId. If invalid, return None."""
    if not isinstance(value, str):
        return None
    try:
        return ObjectId(value)
    except Exception:
        return None


def _build_user_query(user_id):
    """
    Match both:
      - New format: user_id saved as plain string
      - Legacy format: user_id saved as ObjectId
    """
    oid = try_parse_objectid(user_id)
    if oid:
        return {"$in": [user_id, oid]}
    else:
        return user_id


# -------------------------------------------------------------------
# Main ZIP Sanity Runner
# -------------------------------------------------------------------
def run_sanity_from_zip(user_id, zip_file_stream):
    """
    Runs a ZIP-based sanity check.

    ZIP format must contain:
      /data/*.json
      enums.yaml
      relationships.yaml

    Stores results under report_type="db_sanity_zip".
    user_id is saved exactly as JWT provides (string), with backward compatibility.
    """

    temp_dir = tempfile.mkdtemp()

    try:
        # Extract ZIP
        with zipfile.ZipFile(zip_file_stream) as z:
            z.extractall(temp_dir)

        # Handle optional root folder
        items = os.listdir(temp_dir)
        root = (
            os.path.join(temp_dir, items[0])
            if len(items) == 1 and os.path.isdir(os.path.join(temp_dir, items[0]))
            else temp_dir
        )

        data_dir = os.path.join(root, "data")
        enum_file = os.path.join(root, "enums.yaml")
        rel_file = os.path.join(root, "relationships.yaml")

        # Validate required files
        if not os.path.exists(data_dir):
            raise Exception("Missing folder /data inside ZIP")

        if not os.path.exists(enum_file):
            raise Exception("Missing enums.yaml in ZIP")

        if not os.path.exists(rel_file):
            raise Exception("Missing relationships.yaml in ZIP")

        # Load JSON tables
        dfs = {}
        raw_json_data = {}

        for f in os.listdir(data_dir):
            if f.endswith(".json"):
                path = os.path.join(data_dir, f)
                content = open(path, "r", encoding="utf-8").read()
                df, data = load_json_as_df(content)
                table = f.replace(".json", "")
                dfs[table] = df
                raw_json_data[table] = data

        # Load Enums
        enum_defs = fix_yaml_boolean_conversion(
            load_enum_defs(open(enum_file, "r", encoding="utf-8").read())
        )

        # Load Relationships
        rel_yaml = yaml.safe_load(open(rel_file, "r", encoding="utf-8")) or {}
        fk_rels = rel_yaml.get("foreign_keys", []) or []
        generic_rels = rel_yaml.get("generic_foreign_keys", []) or []

        # Final Report
        report = {
            "timestamp": now().isoformat(),
            "tables": {},
            "enum_tables": {},
            "relationships": [],
            "generic_relationships": [],
            "generic_fk_summary": {}
        }

        # Base Sanity Checks
        for tname, df in dfs.items():
            tbl = {"row_count": len(df), "checks": []}
            enum_tbl = {"checks": []}

            sanity_check_keys_are_strings(tname, raw_json_data[tname], tbl)
            sanity_check_id_matches_key(tname, raw_json_data[tname], tbl)
            sanity_check_pk_from_json(tname, raw_json_data[tname], tbl)
            sanity_check_enums(tname, df, enum_defs, enum_tbl)

            report["tables"][tname] = tbl
            report["enum_tables"][tname] = enum_tbl["checks"]

        # FK Checks
        if fk_rels:
            check_foreign_keys(fk_rels, dfs, report)

        # Generic FK Checks
        if generic_rels:
            check_generic_foreign_keys(generic_rels, dfs, report)

            # Extract generic FK entries
            generic_entries = [
                r for r in report["relationships"]
                if r.get("kind") == "generic"
            ]

            report["generic_relationships"] = generic_entries

            # Generic FK summary
            passes = sum(
                1 for r in generic_entries
                if isinstance(r.get("result"), bool) and r["result"]
            )
            fails = sum(
                1 for r in generic_entries
                if isinstance(r.get("result"), bool) and not r["result"]
            )

            report["generic_fk_summary"] = {
                "total": len(generic_entries),
                "passes": passes,
                "fails": fails
            }

        # -------------------------------------------------------------------
        # SAVE TO DB
        # -------------------------------------------------------------------
        doc = {
            # FIXED: Store user_id exactly as string (same as JSON sanity runner)
            "user_id": user_id,
            "title": f"ZIP Sanity Check - {datetime.utcnow().isoformat()}",
            "results": report,
            "status": "completed",
            "report_type": "db_sanity_zip",
            "created_at": now()
        }

        inserted = db.reports.insert_one(doc)
        doc["_id"] = str(inserted.inserted_id)
        doc["user_id"] = str(user_id)

        return doc

    finally:
        shutil.rmtree(temp_dir)
