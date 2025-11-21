import os
import json
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
    sanity_check_enums,
    generate_report_summary,
)

# -------------------------------------------------------------------
# Mongo Setup
# -------------------------------------------------------------------

load_dotenv()
mongo = MongoClient(os.getenv("MONGO_URI"))
db = mongo["docdiff"]


def now():
    """Return current UTC datetime (timezone-aware)."""
    return datetime.now(timezone.utc)


def try_parse_objectid(value):
    """
    Try to parse a string as an ObjectId.
    Returns ObjectId if valid, otherwise None.
    """
    if not isinstance(value, str):
        return None
    try:
        return ObjectId(value)
    except Exception:
        return None


# -------------------------------------------------------------------
# Core: Run sanity check from JSON + YAML
# -------------------------------------------------------------------

def run_sanity_check(user_id, data_json_dict, enum_yaml_str, title=None):
    """
    Runs sanity checks on a dict of JSON tables + YAML enum definitions.

    Example:
        data_json_dict = {
            "funds": json_data_of_funds,
            "investors": json_data_of_investors
        }
        enum_yaml_str = \"\"\"---
        enums:
          funds:
            status: ['active','closed']
        \"\"\"

    Persists a report into `docdiff.reports` with:
        - report_type = "db_sanity"
        - user_id    = <exactly whatever get_jwt_identity() returned (string)>
    """
    try:
        # Load enum definitions and fix YAML bool casts like "true"/"false"
        enum_defs = fix_yaml_boolean_conversion(load_enum_defs(enum_yaml_str))

        full_report = {
            "timestamp": now().isoformat(),
            "tables": {},
            "checks": [],
        }

        # Run table-wise checks
        for table_name, json_data in data_json_dict.items():
            df, data = load_json_as_df(json_data)

            report = {"table": table_name, "checks": []}

            sanity_check_keys_are_strings(table_name, data, report)
            sanity_check_id_matches_key(table_name, data, report)
            sanity_check_pk_from_json(table_name, data, report)
            sanity_check_enums(table_name, df, enum_defs, report)

            full_report["tables"][table_name] = report
            full_report["checks"].extend(report["checks"])

        # Summary over all checks
        summary = generate_report_summary(full_report["checks"])
        full_report["summary"] = summary

        # Build document for Mongo
        doc = {
            # IMPORTANT:
            # Store user_id exactly as received from JWT (string / email / UUID / etc.)
            "user_id": user_id,
            "title": title or f"Sanity Check - {datetime.utcnow().isoformat()}",
            "results": full_report,
            "status": "completed",
            "report_type": "db_sanity",
            "created_at": now(),
        }

        inserted = db.reports.insert_one(doc)
        doc["_id"] = str(inserted.inserted_id)
        doc["user_id"] = str(doc["user_id"])  # ensure JSON serializable

        return doc

    except Exception as e:
        # You can log this if you have a logger
        return {"error": str(e)}


# -------------------------------------------------------------------
# Helpers: Query filters for user_id and report_type
# -------------------------------------------------------------------

def _build_user_query(user_id):
    """
    Build a Mongo query filter for user_id that supports:
      - New style: user_id stored as plain string
      - Legacy style: user_id stored as ObjectId(user_id)

    This ensures that existing reports (if any) still show up.
    """
    oid = try_parse_objectid(user_id)
    if oid:
        # Match both styles
        return {"$in": [user_id, oid]}
    else:
        # Only match the string style
        return user_id


def _report_type_filter(include_zip=True):
    """
    Build a report_type filter:
      - If include_zip=True, includes both db_sanity and db_sanity_zip
      - Otherwise, only db_sanity
    """
    if include_zip:
        return {"$in": ["db_sanity", "db_sanity_zip"]}
    return "db_sanity"


# -------------------------------------------------------------------
# List reports
# -------------------------------------------------------------------

def list_sanity_reports(user_id):
    """
    Return a list of sanity reports for the given user.

    Includes both:
      - JSON-based sanity checks: report_type = "db_sanity"
      - ZIP-based sanity checks:  report_type = "db_sanity_zip" (if present)
    """
    query = {
        "user_id": _build_user_query(user_id),
        "report_type": _report_type_filter(include_zip=True),
    }

    reports = list(db.reports.find(query).sort("created_at", -1))

    for r in reports:
        r["_id"] = str(r["_id"])
        r["user_id"] = str(r.get("user_id", ""))

    return reports


# -------------------------------------------------------------------
# Get single report
# -------------------------------------------------------------------

def get_sanity_report(user_id, report_id):
    """
    Fetch a single sanity report by its ID, ensuring it belongs to the user.

    Works for both:
      - db_sanity
      - db_sanity_zip
    """
    # Validate report_id
    try:
        rid = ObjectId(report_id)
    except Exception:
        return None  # invalid ObjectId format

    query = {
        "_id": rid,
        "user_id": _build_user_query(user_id),
        # allow any sanity report type
        "report_type": _report_type_filter(include_zip=True),
    }

    report = db.reports.find_one(query)
    if not report:
        return None

    report["_id"] = str(report["_id"])
    report["user_id"] = str(report.get("user_id", ""))

    return report


# -------------------------------------------------------------------
# Summary
# -------------------------------------------------------------------

def get_sanity_summary(user_id):
    """
    Return a high-level summary of the user's sanity reports:
      - total_reports
      - passed (fails == 0)
      - failed
      - pass_rate
      - recent_reports (up to 10)
    """
    reports = list_sanity_reports(user_id)
    total = len(reports)

    def has_no_fails(r):
        try:
            summary = r["results"]["summary"]
            fails = summary.get("fails", 0)
            return fails == 0
        except Exception:
            return False

    passed = sum(1 for r in reports if has_no_fails(r))
    failed = total - passed

    return {
        "total_reports": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": f"{(passed / total * 100):.1f}%" if total else "0%",
        "recent_reports": [
            {
                "id": r["_id"],
                "title": r.get("title"),
                "summary": r.get("results", {}).get("summary", {}),
                "created_at": r.get("created_at"),
                "report_type": r.get("report_type"),
            }
            for r in reports[:10]
        ],
    }


# -------------------------------------------------------------------
# Delete report
# -------------------------------------------------------------------

def delete_sanity_report(user_id, report_id):
    """
    Delete a single sanity report that belongs to the user.
    """
    try:
        rid = ObjectId(report_id)
    except Exception:
        return {"error": "Invalid report id format"}, 400

    query = {
        "_id": rid,
        "user_id": _build_user_query(user_id),
    }

    try:
        result = db.reports.delete_one(query)

        if result.deleted_count == 0:
            return {"error": "Report not found or not authorized"}, 404

        return {"status": "deleted", "id": report_id}, 200

    except Exception as e:
        return {"error": str(e)}, 500
