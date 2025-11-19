
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

load_dotenv()
mongo = MongoClient(os.getenv("MONGO_URI"))
db = mongo["docdiff"]

def oid(x): return ObjectId(str(x))
def now(): return datetime.now(timezone.utc)


def run_sanity_from_zip(user_id, zip_file_stream):

    temp_dir = tempfile.mkdtemp()

    try:
        z = zipfile.ZipFile(zip_file_stream)
        z.extractall(temp_dir)
        z.close()

        root = temp_dir
        items = os.listdir(temp_dir)

        # If ZIP has only one directory inside, go inside it
        if len(items) == 1 and os.path.isdir(os.path.join(temp_dir, items[0])):
            root = os.path.join(temp_dir, items[0])

        data_dir = os.path.join(root, "data")
        enum_file = os.path.join(root, "enums.yaml")
        rel_file = os.path.join(root, "relationships.yaml")

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

        # Build Report
        report = {
            "timestamp": now().isoformat(),
            "tables": {},
            "enum_tables": {},
            "relationships": [],
            "generic_relationships": [],
            "generic_fk_summary": {}
        }

        # Base checks
        for tname, df in dfs.items():
            tbl = {"row_count": len(df), "checks": []}
            enum_tbl = {"checks": []}

            sanity_check_keys_are_strings(tname, raw_json_data[tname], tbl)
            sanity_check_id_matches_key(tname, raw_json_data[tname], tbl)
            sanity_check_pk_from_json(tname, raw_json_data[tname], tbl)
            sanity_check_enums(tname, df, enum_defs, enum_tbl)

            report["tables"][tname] = tbl
            report["enum_tables"][tname] = enum_tbl["checks"]

        # FK checks
        if fk_rels:
            check_foreign_keys(fk_rels, dfs, report)

        # Generic FK checks
        if generic_rels:
            check_generic_foreign_keys(generic_rels, dfs, report)
            generic_entries = [r for r in report["relationships"] if r.get("kind") == "generic"]

            report["generic_relationships"] = generic_entries

            passes = sum(1 for r in generic_entries if isinstance(r.get("result"), bool) and r["result"])
            fails = sum(1 for r in generic_entries if isinstance(r.get("result"), bool) and not r["result"])

            report["generic_fk_summary"] = {
                "total": len(generic_entries),
                "passes": passes,
                "fails": fails
            }

        # Store In DB
        doc = {
            "user_id": oid(user_id),
            "title": f"ZIP Sanity Check - {datetime.utcnow().isoformat()}",
            "results": report,
            "status": "completed",
            "report_type": "db_sanity_zip",
            "created_at": now()
        }

        db.reports.insert_one(doc)
        doc["_id"] = str(doc["_id"])
        doc["user_id"] = user_id

        return doc

    finally:
        shutil.rmtree(temp_dir)
