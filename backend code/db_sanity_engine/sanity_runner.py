import json
from datetime import datetime, timezone
from pymongo import MongoClient
from bson import ObjectId
from .sanity_checks_core import (
    load_json_as_df, load_enum_defs, fix_yaml_boolean_conversion,
    sanity_check_keys_are_strings, sanity_check_id_matches_key,
    sanity_check_pk_from_json, sanity_check_enums,
    generate_report_summary
)

# Mongo Setup
from dotenv import load_dotenv
import os
load_dotenv()
mongo = MongoClient(os.getenv("MONGO_URI"))
db = mongo["docdiff"]

def oid(x): return ObjectId(str(x))
def now(): return datetime.now(timezone.utc)

def run_sanity_check(user_id, data_json_dict, enum_yaml_str, title=None):
    """
    Runs sanity checks on a dict of JSON tables + YAML enum definitions.
    Example:
      data_json_dict = {
        "funds": json_data_of_funds,
        "investors": json_data_of_investors
      }
      enum_yaml_str = "---\nenums:\n  funds:\n    status: ['active','closed']"
    """
    try:
        enum_defs = fix_yaml_boolean_conversion(load_enum_defs(enum_yaml_str))
        full_report = {"timestamp": now().isoformat(), "tables": {}, "checks": []}

        for table_name, json_data in data_json_dict.items():
            df, data = load_json_as_df(json_data)
            report = {"table": table_name, "checks": []}
            sanity_check_keys_are_strings(table_name, data, report)
            sanity_check_id_matches_key(table_name, data, report)
            sanity_check_pk_from_json(table_name, data, report)
            sanity_check_enums(table_name, df, enum_defs, report)
            full_report["tables"][table_name] = report
            full_report["checks"].extend(report["checks"])

        summary = generate_report_summary(full_report["checks"])
        full_report["summary"] = summary

        doc = {
            "user_id": oid(user_id),
            "title": title or f"Sanity Check - {datetime.utcnow().isoformat()}",
            "results": full_report,
            "status": "completed",
            "report_type": "db_sanity",
            "created_at": now()
        }

        db.reports.insert_one(doc)
        doc["_id"] = str(doc["_id"])
        doc["user_id"] = user_id
        return doc

    except Exception as e:
        return {"error": str(e)}

def list_sanity_reports(user_id):
    reports = list(db.reports.find({
        "user_id": oid(user_id),
        "report_type": "db_sanity"
    }).sort("created_at", -1))
    for r in reports:
        r["_id"] = str(r["_id"])
        r["user_id"] = user_id
    return reports

def get_sanity_summary(user_id):
    reports = list_sanity_reports(user_id)
    total = len(reports)
    passed = sum(1 for r in reports if r["results"]["summary"]["fails"] == 0)
    failed = total - passed
    return {
        "total_reports": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": f"{(passed / total * 100):.1f}%" if total else "0%",
        "recent_reports": [{
            "id": r["_id"],
            "title": r["title"],
            "summary": r["results"]["summary"],
            "created_at": r["created_at"]
        } for r in reports[:10]]
    }

def delete_sanity_report(user_id, report_id):
    try:
        result = db.reports.delete_one({
            "_id": ObjectId(report_id),
            "user_id": oid(user_id)
        })

        if result.deleted_count == 0:
            return {"error": "Report not found or not authorized"}, 404

        return {"status": "deleted", "id": report_id}, 200

    except Exception as e:
        return {"error": str(e)}, 500
