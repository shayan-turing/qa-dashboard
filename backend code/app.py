import eventlet
eventlet.monkey_patch()

import os
import json
import asyncio
import tempfile
import datetime
from bson import ObjectId
from bson.errors import InvalidId
from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import (
    JWTManager, create_access_token, create_refresh_token,
    jwt_required, get_jwt, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient, ASCENDING, DESCENDING
from dotenv import load_dotenv
import logging
from flask_cors import CORS
import pandas as pd
import traceback

from bson import ObjectId
import io
import sys
import re
import shutil
import zipfile
import tempfile
from pathlib import Path
from google.cloud import storage
from flask_socketio import SocketIO, emit
import subprocess

# ---- Custom modules ----
from policy_validator import compare_documents
from tools_validator import run_validation
from rule_validator import validate_file
from tool_validator_engine import (
    create_task, list_tasks, get_task, delete_task, run_task, run_all_tasks
)
from db_sanity_engine import (
    run_sanity_check, list_sanity_reports, get_sanity_summary,run_sanity_from_zip,delete_sanity_report
)


# ---- Custom Modules ----
from policy_validator import compare_documents
from tools_validator import run_validation
from rule_validator import validate_file
from api_sanity_check import sanity_bp
from data_sanity_checker import data_bp
 
 
  
from testgen.testgen import generate_all_tests

# ---------------------------------------------------------------
# Setup
# ---------------------------------------------------------------
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
JWT_SECRET = os.getenv("JWT_SECRET", "this-is-jwt")

app = Flask(__name__)
app.secret_key = JWT_SECRET  # Required for Flask sessions
CORS(app, supports_credentials=True)
app.config["JWT_SECRET_KEY"] = JWT_SECRET
jwt = JWTManager(app)

# Register API sanity check blueprint
app.register_blueprint(sanity_bp)

# Register data sanity checker blueprint
app.register_blueprint(data_bp)

# Register API sanity check blueprint

mongo = MongoClient(MONGO_URI)
db = mongo["docdiff"]
list(db.users.find({}, {"email":1, "password_hash":1}))
# ---------------------------------------------------------------
# Logging Setup (stdout for GCP)
# ---------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------
# Indexing for Performance
# ---------------------------------------------------------------
db.reports.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
db.tasks.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
db.audit_logs.create_index([("actor_user_id", ASCENDING), ("at", DESCENDING)])


# ---------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------


def mongo_to_json(doc):
    """Recursively convert ObjectId and datetime to strings."""
    if isinstance(doc, list):
        return [mongo_to_json(x) for x in doc]
    if isinstance(doc, dict):
        new_doc = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):
                new_doc[k] = str(v)
            elif isinstance(v, datetime.datetime):
                new_doc[k] = v.isoformat()
            elif isinstance(v, (dict, list)):
                new_doc[k] = mongo_to_json(v)
            else:
                new_doc[k] = v
        return new_doc
    return doc


def oid(s):
    """Safely convert to ObjectId."""
    try:
        return ObjectId(str(s))
    except (InvalidId, TypeError):
        return None


def now():
    """Return current UTC datetime (timezone-aware)."""
    return datetime.datetime.now(datetime.timezone.utc)



def log_action(user_id, action, target_id=None, meta=None):
    """Audit log to MongoDB."""
    db.audit_logs.insert_one({
        "at": now(),
        "actor_user_id": oid(user_id) if user_id else None,
        "action": str(action).upper(),
        "target_id": oid(target_id) if target_id else None,
        "meta": meta or {}
    })


# ---------------------------------------------------------------
# Health & Error Handling
# ---------------------------------------------------------------
@app.get("/health")
def health_check():
    """Health check endpoint for GCP Load Balancer."""
    try:
        mongo.admin.command("ping")
        return jsonify({"status": "healthy", "mongo": "connected"}), 200
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500


@app.errorhandler(404)
def not_found_error(e):
    return jsonify({"error": "Endpoint not found"}), 404


@app.errorhandler(500)
def internal_error(e):
    logger.exception("Internal Server Error: %s", e)
    return jsonify({"error": "Internal server error"}), 500


@app.errorhandler(Exception)
def generic_error_handler(e):
    logger.exception("Unhandled Exception: %s", e)
    return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------
@app.post("/auth/register")
def register():
    data = request.get_json() or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    if db.users.find_one({"email": email}):
        return jsonify({"error": "email already registered"}), 400

    user = {
        "email": email,
        "password_hash": generate_password_hash(password),
        "role": "user",
        "created_at": now()
    }
    db.users.insert_one(user)
    return jsonify({"message": "registered"}), 201


@app.post("/auth/login")
def login():
    data = request.get_json() or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password") or ""

    user = db.users.find_one({"email": email})
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    claims = {"role": user["role"]}
    access = create_access_token(identity=str(user["_id"]), additional_claims=claims)
    refresh = create_refresh_token(identity=str(user["_id"]), additional_claims=claims)
    log_action(user["_id"], "LOGIN")

    return jsonify({
        "access_token": access,
        "refresh_token": refresh
    })


@app.post("/auth/refresh")
@jwt_required(refresh=True)
def refresh():
    claims = get_jwt()
    uid = get_jwt_identity()
    new_access = create_access_token(identity=uid, additional_claims={"role": claims["role"]})
    return jsonify({"access_token": new_access})


# ---------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------
@app.post("/sessions/start")
@jwt_required()
def session_start():
    uid = get_jwt_identity()
    doc = {
        "user_id": oid(uid),
        "started_at": now(),
        "ended_at": None,
        "user_agent": request.headers.get("User-Agent", ""),
        "ip": request.headers.get("X-Forwarded-For", request.remote_addr)
    }
    res = db.sessions.insert_one(doc)
    log_action(uid, "SESSION_START", res.inserted_id)
    return jsonify({"session_id": str(res.inserted_id)}), 201


@app.post("/sessions/end")
@jwt_required()
def end_session():
    uid = get_jwt_identity()
    sid = request.args.get("session_id")
    if not sid:
        return jsonify({"error": "session_id required"}), 400
    db.sessions.update_one(
        {"_id": oid(sid), "user_id": oid(uid)},
        {"$set": {"ended_at": now()}}
    )
    log_action(uid, "SESSION_END", sid)
    return jsonify({"message": "ended"})


# ---------------------------------------------------------------
# Reports (Document Comparison)
# ---------------------------------------------------------------
# @app.post("/reports")
# @jwt_required()
# def create_report():
#     uid = get_jwt_identity()
#     content_type = request.content_type or ""
#     title = None
#     tags = []
#     session_id = request.form.get("session_id") or None

#     if content_type.startswith("multipart/form-data"):
#         f1 = request.files.get("file1")
#         f2 = request.files.get("file2")
#         if not f1 or not f2:
#             return jsonify({"error": "file1 and file2 required"}), 400

#         doc1 = f1.read().decode(errors="ignore")
#         doc2 = f2.read().decode(errors="ignore")
#         title = request.form.get("title")
#         tags = (request.form.get("tags") or "").split(",") if request.form.get("tags") else []
#         in_meta = {
#             "source": "upload",
#             "doc1_name": f1.filename,
#             "doc2_name": f2.filename,
#             "doc1_chars": len(doc1),
#             "doc2_chars": len(doc2)
#         }
#     else:
#         data = request.get_json() or {}
#         doc1 = data.get("doc1") or ""
#         doc2 = data.get("doc2") or ""
#         title = data.get("title")
#         tags = data.get("tags") or []
#         session_id = data.get("session_id") or session_id
#         if not doc1 or not doc2:
#             return jsonify({"error": "doc1 and doc2 required"}), 400
#         in_meta = {"source": "text", "doc1_chars": len(doc1), "doc2_chars": len(doc2)}


#     results = asyncio.run(compare_documents(doc1, doc2))

#     doc = {
#         "user_id": oid(uid),
#         "session_id": oid(session_id) if session_id else None,
#         "title": title or "Untitled report",
#         "inputs": in_meta,
#         "results": {
#             "jaccard": results.get("Jaccard Similarity"),
#             "tfidf": results.get("TF-IDF Cosine Similarity"),
#             "semantic": results.get("Semantic Similarity"),
#             "llm": results.get("LLM Embedding Similarity")
#         },
#         "tags": tags,
#         "status": "completed",
#         "report_type": "comparison",
#         "created_at": now()
#     }

#     res = db.reports.insert_one(doc)
#     log_action(uid, "CREATE_REPORT", res.inserted_id, {"session_id": session_id})
#     doc["_id"] = str(res.inserted_id)
#     return jsonify(mongo_to_json(doc)), 201




#     next_cursor = str(docs[-1]["_id"]) if len(docs) == 20 else None
#     return jsonify({"items": mongo_to_json(docs), "next_cursor": next_cursor}), 200

@app.post("/reports")
@jwt_required()
def create_report():
    uid = get_jwt_identity()
    content_type = request.content_type or ""
    title = None
    tags = []
    session_id = request.form.get("session_id") or None

    if content_type.startswith("multipart/form-data"):
        f1 = request.files.get("file1")
        f2 = request.files.get("file2")
        if not f1 or not f2:
            return jsonify({"error": "file1 and file2 required"}), 400

        doc1 = f1.read().decode(errors="ignore")
        doc2 = f2.read().decode(errors="ignore")
        title = request.form.get("title")
        tags = (request.form.get("tags") or "").split(",") if request.form.get("tags") else []
        in_meta = {
            "source": "upload",
            "doc1_name": f1.filename,
            "doc2_name": f2.filename,
            "doc1_chars": len(doc1),
            "doc2_chars": len(doc2)
        }

    else:
        data = request.get_json() or {}
        doc1 = data.get("doc1") or ""
        doc2 = data.get("doc2") or ""
        title = data.get("title")
        tags = data.get("tags") or []
        session_id = data.get("session_id") or session_id

        if not doc1 or not doc2:
            return jsonify({"error": "doc1 and doc2 required"}), 400

        in_meta = {"source": "text", "doc1_chars": len(doc1), "doc2_chars": len(doc2)}

    # ✅ FIXED: remove asyncio.run()
    print("[REPORT] Starting comparison...")
    results = compare_documents(doc1, doc2)
    print("[REPORT] Comparison complete.")

    doc = {
        "user_id": oid(uid),
        "session_id": oid(session_id) if session_id else None,
        "title": title or "Untitled report",
        "inputs": in_meta,
        "results": {
            "jaccard": results.get("Jaccard Similarity"),
            "tfidf": results.get("TF-IDF Cosine Similarity"),
            "semantic": results.get("Semantic Similarity"),
            "llm": results.get("LLM Embedding Similarity")
        },
        "tags": tags,
        "status": "completed",
        "report_type": "comparison",
        "created_at": now()
    }

    res = db.reports.insert_one(doc)
    log_action(uid, "CREATE_REPORT", res.inserted_id, {"session_id": session_id})
    doc["_id"] = str(res.inserted_id)
    return jsonify(mongo_to_json(doc)), 201



@app.get("/reports/<rid>")
@jwt_required()
def get_report(rid):
    uid = get_jwt_identity()
    doc = db.reports.find_one({"_id": oid(rid), "user_id": oid(uid)})
    if not doc:
        return jsonify({"error": "Report not found"}), 404
    return jsonify(mongo_to_json(doc)), 200


@app.delete("/reports/<rid>")
@jwt_required()
def delete_report(rid):
    uid = get_jwt_identity()
    res = db.reports.delete_one({"_id": oid(rid), "user_id": oid(uid)})
    if res.deleted_count == 0:
        return jsonify({"error": "Report not found or unauthorized"}), 404
    log_action(uid, "DELETE_REPORT", rid)
    return jsonify({"message": "Report deleted"}), 200


def serialize_mongo_doc(doc):
    """Recursively converts ObjectId and datetime objects to strings."""
    if isinstance(doc, list):
        return [serialize_mongo_doc(d) for d in doc]
    elif isinstance(doc, dict):
        new_doc = {}
        for k, v in doc.items():
            if isinstance(v, ObjectId):
                new_doc[k] = str(v)
            elif hasattr(v, 'isoformat'):  # datetime
                new_doc[k] = v.isoformat()
            else:
                new_doc[k] = serialize_mongo_doc(v) if isinstance(v, (dict, list)) else v
        return new_doc
    else:
        return doc
@app.get("/reports")
@jwt_required()
def list_reports():
    uid = get_jwt_identity()
    cursor_id = request.args.get("cursor")

    query = {"user_id": oid(uid), "report_type": "comparison"}
    if cursor_id:
        query["_id"] = {"$lt": oid(cursor_id)}

    docs = list(db.reports.find(query).sort("_id", -1).limit(20))
    docs = [serialize_mongo_doc(d) for d in docs]

    next_cursor = str(docs[-1]["_id"]) if len(docs) == 20 else None
    return jsonify({"items": docs, "next_cursor": next_cursor}), 200


# ---------------------------------------------------------------
# Validation APIs (Tool / Rule / Sanity)
# ---------------------------------------------------------------

@app.post("/validate")
@jwt_required()
def validate_tools_api():
    uid = get_jwt_identity()
    logger.info(f"🧩 /validate triggered by user {uid}")

    # --- Step 1: Input checks ---
    if 'excel_file' not in request.files or 'doc_file' not in request.files:
        logger.warning("❗ Missing excel_file or doc_file in upload.")
        return jsonify({"error": "Both excel_file and doc_file are required"}), 400

    excel_file = request.files['excel_file']
    doc_file = request.files['doc_file']
    threshold = float(request.form.get("threshold", 0.5))
    use_llm_reasoning = request.form.get("use_llm_reasoning", "true").lower() == "true"
    title = request.form.get("title") or f"Validation Report - {datetime.datetime.now(datetime.timezone.utc).isoformat()}"
    tags = (request.form.get("tags") or "validation").split(",")
    session_id = request.form.get("session_id")

    logger.info(f"📥 Received files: {excel_file.filename}, {doc_file.filename}")
    logger.info(f"⚙️ Params => threshold={threshold}, LLM={use_llm_reasoning}, session={session_id}")

    try:
        # --- Step 2: Run Validation ---
        result = run_validation(excel_file, doc_file, threshold, use_llm_reasoning)
        summary = result["summary"]
        details = result["details"]

        # --- Step 3: Log metrics ---
        embedding_time = summary.get("embedding_time", {})
        logger.info(
            f" Validation Summary: {summary} | "
            f"Embedding timings: {embedding_time.get('total_sec', 0)}s total"
        )

        # --- Step 4: Store in MongoDB ---
        in_meta = {
            "source": "validation_upload",
            "excel_name": excel_file.filename,
            "doc_name": doc_file.filename,
            "threshold": threshold,
            "use_llm_reasoning": use_llm_reasoning,
            "chunk_count": summary.get("chunk_count"),
            "average_similarity": summary.get("average_similarity"),
            "embedding_time": embedding_time,
        }

        report_doc = {
            "user_id": oid(uid),
            "session_id": oid(session_id) if session_id else None,
            "title": title,
            "inputs": in_meta,
            "results": {
                "summary": summary,
                "details": details,
            },
            "tags": tags,
            "status": "completed",
            "report_type": "validation",
            "created_at": datetime.datetime.now(datetime.timezone.utc),
        }

        res = db.reports.insert_one(report_doc)
        logger.info(f"💾 Report saved successfully with ID {res.inserted_id}")

        # --- Step 5: Clean response for frontend ---
        return jsonify({
            "message": "Validation completed successfully",
            "summary": summary,
            "embedding_time": embedding_time,
            "report_id": str(res.inserted_id)
        }), 201

    except Exception as e:
        logger.error(f"❌ Validation pipeline failed: {str(e)}", exc_info=True)
        log_action(uid, "VALIDATION_ERROR", None, {"error": str(e), "trace": traceback.format_exc()})
        return jsonify({"error": f"Unexpected error during validation: {str(e)}"}), 500


@app.get("/validate")
@jwt_required()
def list_validation_reports():
    uid = get_jwt_identity()
    cursor_id = request.args.get("cursor")

    query = {"user_id": oid(uid), "report_type": "validation"}
    if cursor_id:
        query["_id"] = {"$lt": oid(cursor_id)}

    docs = list(db.reports.find(query).sort("_id", -1).limit(20))
    docs = [serialize_mongo_doc(d) for d in docs]

    next_cursor = str(docs[-1]["_id"]) if len(docs) == 20 else None
    return jsonify({"items": docs, "next_cursor": next_cursor}), 200


@app.post("/validate/columns")
@jwt_required()
def preview_excel_columns():
    """
    Reads Excel file, returns available sheet names and first-row headers.
    """
    import pandas as pd

    if 'excel_file' not in request.files:
        return jsonify({"error": "Excel file is required"}), 400

    excel_file = request.files['excel_file']
    excel_file.seek(0)

    try:
        xl = pd.ExcelFile(excel_file)
        sheets_info = {}

        for sheet in xl.sheet_names:
            df = xl.parse(sheet, nrows=1)
            sheets_info[sheet] = [str(c) for c in df.columns]

        return jsonify({
            "sheets": sheets_info,
            "message": "Excel loaded successfully",
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.delete("/validate/<report_id>")
@jwt_required()
def delete_validation_report(report_id):
    uid = get_jwt_identity()
    logger.info(f"DELETE /validate/{report_id} by user {uid}")
    try:
        rid = oid(report_id)
    except Exception:
        return jsonify({"error": "Invalid report_id"}), 400
    query = {
        "_id": rid,
        "user_id": oid(uid),
        "report_type": "validation"
    }
    result = db.reports.delete_one(query)
    if result.deleted_count == 0:
        logger.warning(f" Report {report_id} not found or not owned by user {uid}")
        return jsonify({"error": "Report not found"}), 404
    logger.info(f" Report {report_id} deleted successfully")
    return jsonify({"message": "Report deleted successfully"}), 200



# @app.post("/rule-validate")
# @jwt_required()
# def rule_validate_api():
#     uid = get_jwt_identity()
#     if 'doc_file' not in request.files:
#         return jsonify({"error": "doc_file is required"}), 400

#     doc_file = request.files['doc_file']
#     rule_key = request.form.get("rule_key", "default")
#     title = request.form.get("title") or f"Rule Validation - {datetime.utcnow().isoformat()}"
#     tags = (request.form.get("tags") or "rule_validation").split(",")
#     session_id = request.form.get("session_id")

#     try:
#         temp_dir = tempfile.gettempdir()
#         temp_path = os.path.join(temp_dir, doc_file.filename)
#         doc_file.save(temp_path)

#         results = validate_file(temp_path, rule_key=rule_key)
#         os.remove(temp_path)

#         total_rules = len(results)
#         passed = sum(1 for r in results if r["status"] == "pass")
#         failed = total_rules - passed

#         in_meta = {
#             "source": "rule_validation",
#             "doc_name": doc_file.filename,
#             "rule_key": rule_key,
#             "total_rules": total_rules
#         }

#         report_doc = {
#             "user_id": oid(uid),
#             "session_id": oid(session_id) if session_id else None,
#             "title": title,
#             "inputs": in_meta,
#             "results": {
#                 "summary": {"passed": passed, "failed": failed},
#                 "details": results
#             },
#             "tags": tags,
#             "status": "completed",
#             "report_type": "rule_validation",
#             "created_at": now()
#         }

#         res = db.reports.insert_one(report_doc)
#         log_action(uid, "CREATE_RULE_VALIDATION_REPORT", res.inserted_id)
#         report_doc["_id"] = str(res.inserted_id)
#         return jsonify({"message": "Rule validation completed", "report": report_doc}), 201
#     except Exception as e:
#         log_action(uid, "RULE_VALIDATION_ERROR", None, {"error": str(e)})
#         return jsonify({"error": str(e)}), 500
@app.post("/sanity/run-upload")
@jwt_required()
def api_run_sanity_zip():
    uid = get_jwt_identity()

    if "file" not in request.files:
        return jsonify({"error": "ZIP file is required"}), 400

    zip_file = request.files["file"]

    report = run_sanity_from_zip(uid, zip_file)
    log_action(uid, "RUN_DB_SANITY_ZIP", report.get("_id"))

    return jsonify(report), 201


@app.post("/sanity/run")
@jwt_required()
def api_run_sanity():
    uid = get_jwt_identity()
    data = request.get_json() or {}
    data_json_dict = data.get("data_json_dict")
    enum_yaml_str = data.get("enum_yaml_str", "")
    title = data.get("title")
    if not data_json_dict:
        return jsonify({"error": "data_json_dict is required"}), 400
    report = run_sanity_check(uid, data_json_dict, enum_yaml_str, title)
    log_action(uid, "RUN_DB_SANITY", report.get("_id"))
    return jsonify(report), 201


@app.get("/sanity/reports")
@jwt_required()
def api_list_sanity_reports():
    uid = get_jwt_identity()
    reports = list_sanity_reports(uid)
    log_action(uid, "LIST_DB_SANITY_REPORTS", None, {"count": len(reports)})
    return jsonify(reports)


@app.get("/sanity/summary")
@jwt_required()
def api_sanity_summary():
    uid = get_jwt_identity()
    summary = get_sanity_summary(uid)
    log_action(uid, "VIEW_DB_SANITY_SUMMARY", None, summary)
    return jsonify(summary)

@app.delete("/sanity/report/<report_id>")
@jwt_required()
def api_delete_sanity_report(report_id):
    uid = get_jwt_identity()

    result, status = delete_sanity_report(uid, report_id)

    log_action(uid, "DELETE_DB_SANITY_REPORT", report_id, result)

    return jsonify(result), status




# ---------------------------------------------------------------
# Task Engine APIs (create/list/run/summary)
# ---------------------------------------------------------------

# from concurrent.futures import ThreadPoolExecutor, as_completed
# from tool_validator_engine import (
#     create_task, list_tasks, get_task, delete_task,
#     run_task, run_all_tasks
# )

@app.post("/tasks")
@jwt_required()
def api_create_task():
    """Create a new task."""
    uid = get_jwt_identity()
    data = request.get_json() or {}
    env = (data.get("env") or "").strip()
    interface_num = str(data.get("interface_num", "1"))
    actions = data.get("actions", [])
    title = data.get("title")

    if not env:
        return jsonify({"error": "Environment name is required"}), 400

    try:
        task = create_task(uid, env, interface_num, actions, title)
        log_action(uid, "CREATE_TASK", task["_id"])
        return jsonify(task), 201
    except Exception as e:
        logger.exception("Error creating task: %s", e)
        return jsonify({"error": str(e)}), 500


@app.get("/tasks")
@jwt_required()
def api_list_tasks():
    """List all tasks for the user."""
    uid = get_jwt_identity()
    try:
        tasks_result = list_tasks(uid)
        tasks = tasks_result["items"] if isinstance(tasks_result, dict) else tasks_result
        log_action(uid, "LIST_TASKS", None, {"count": len(tasks)})
        return jsonify(tasks),200
    except Exception as e:
        logger.exception("Error listing tasks: %s", e)
        return jsonify({"error": str(e)}), 500


@app.post("/tasks/<tid>/run")
@jwt_required()
def api_run_task(tid):
    """Run a single stored task."""
    uid = get_jwt_identity()
    try:
        report = run_task(uid, tid)
        log_action(uid, "RUN_TASK", tid, {"status": report.get("status")})
        return jsonify(report), 200
    except Exception as e:
        logger.exception("Error running task: %s", e)
        return jsonify({"error": str(e)}), 500


@app.post("/tasks/run_all")
@jwt_required()
def api_run_all_tasks():
    """Run all tasks in parallel for the user (thread pool)."""
    uid = get_jwt_identity()
    try:
        # Parallel run_all_tasks
        reports = run_all_tasks(uid)
        log_action(uid, "RUN_ALL_TASKS", None, {"count": len(reports)})
        return jsonify({"message": "All tasks executed", "reports": reports}), 200
    except Exception as e:
        logger.exception("Error running all tasks: %s", e)
        return jsonify({"error": str(e)}), 500


@app.get("/tasks/summary")
@jwt_required()
def api_task_summary():
    """
    Return summary of all tasks (including those never run).
    Each task appears once, showing latest run or 'Not Run Yet'.
    """
    uid = get_jwt_identity()
    try:
        # Step 1: Fetch all user tasks
        all_tasks = list(db.tasks.find({"user_id": oid(uid)}))
        total_tasks = len(all_tasks)

        # Step 2: Get latest report per task (if exists)
        pipeline = [
            {"$match": {"user_id": oid(uid), "report_type": "task_run"}},
            {"$sort": {"task_id": 1, "created_at": -1}},
            {"$group": {
                "_id": "$task_id",
                "latest": {"$first": "$$ROOT"}
            }},
            {"$replaceRoot": {"newRoot": "$latest"}},
        ]
        latest_reports = list(db.reports.aggregate(pipeline))

        # Convert to dict for quick lookup by task_id
        latest_map = {str(r.get("task_id")): r for r in latest_reports}

        # Step 3: Merge tasks + reports
        summary_rows = []
        passed = failed = not_run = 0

        for t in all_tasks:
            tid = str(t["_id"])
            report = latest_map.get(tid)
            if report:
                status = report.get("status", "unknown").lower()
                if status == "passed":
                    passed += 1
                elif status == "failed":
                    failed += 1
                else:
                    not_run += 1
                summary_rows.append({
                    "id": tid,
                    "title": t.get("title", f"Task {tid[:6]}"),
                    "status": status,
                    "created_at": report.get("created_at"),
                    "task_id": tid,
                    "error": report.get("error", ""),
                })
            else:
                not_run += 1
                summary_rows.append({
                    "id": tid,
                    "title": t.get("title", f"Task {tid[:6]}"),
                    "status": "not_run",
                    "created_at": t.get("created_at"),
                    "task_id": tid,
                    "error": "",
                })

        # Step 4: Compute rates
        total_runs = passed + failed
        pass_rate = round((passed / total_runs * 100), 1) if total_runs else 0.0

        # Step 5: Final summary
        summary = {
            "total_tasks": total_tasks,
            "passed": passed,
            "failed": failed,
            "not_run": not_run,
            "pass_rate": f"{pass_rate}%",
            "recent_runs": sorted(summary_rows, key=lambda x: x["created_at"] or datetime.min, reverse=True)
        }

        log_action(uid, "VIEW_TASK_SUMMARY", None, summary)
        return jsonify(summary), 200

    except Exception as e:
        logger.exception("Error creating task summary: %s", e)
        return jsonify({"error": str(e)}), 500

    
@app.get("/tasks/<tid>/results")
@jwt_required()
def api_single_task_results(tid):
    """Fetch all recent run results and summary metrics for a specific task."""
    uid = get_jwt_identity()
    try:
        pipeline = [
            {"$match": {"user_id": oid(uid), "task_id": oid(tid), "report_type": "task_run"}},
            {"$sort": {"created_at": -1}},
            {"$limit": 50},
        ]
        reports = list(db.reports.aggregate(pipeline))

        if not reports:
            return jsonify({
                "task_id": tid,
                "summary": {
                    "total_runs": 0,
                    "passed": 0,
                    "failed": 0,
                    "pass_rate": "0.0%",
                },
                "results": [],
                "message": "No results found for this task"
            }), 200

        passed = sum(1 for r in reports if r.get("status") == "passed")
        failed = sum(1 for r in reports if r.get("status") == "failed")
        total_runs = passed + failed
        pass_rate = round((passed / total_runs) * 100, 1) if total_runs else 0.0

        # 🔧 Serialize results cleanly
        results = [mongo_to_json(r) for r in reports]

        summary = {
            "total_runs": total_runs,
            "passed": passed,
            "failed": failed,
            "pass_rate": f"{pass_rate}%",
        }

        log_action(uid, "VIEW_TASK_RESULTS", tid, summary)
        return jsonify({
            "task_id": tid,
            "summary": summary,
            "results": results
        }), 200

    except Exception as e:
        logger.exception("Error fetching task results: %s", e)
        return jsonify({"error": str(e)}), 500


@app.get("/envs")
@jwt_required()
def list_envs():
    """List available environments from the 'envs' folder."""
    try:
        path = "envs"
        if not os.path.exists(path):
            return jsonify({"envs": [], "warning": "envs folder not found"}), 200
        envs = [f for f in os.listdir(path) if os.path.isdir(os.path.join(path, f))]
        return jsonify({"envs": envs}), 200
    except Exception as e:
        logger.exception("Error listing environments: %s", e)
        return jsonify({"error": str(e)}), 500
    
@app.get("/tasks/<tid>")
@jwt_required()
def api_get_task(tid):
    """Fetch a single task's details."""
    uid = get_jwt_identity()
    try:
        task = get_task(uid, tid)
        if not task:
            return jsonify({"error": "Task not found"}), 404
        log_action(uid, "VIEW_TASK", tid)
        return jsonify(mongo_to_json(task)), 200  #  fix here
    except PermissionError:
        return jsonify({"error": "Unauthorized access"}), 403
    except Exception as e:
        logger.exception("Error getting task: %s", e)
        return jsonify({"error": str(e)}), 500
@app.put("/tasks/<tid>")
@jwt_required()
def api_update_task(tid):
    """Update a task's metadata or actions."""
    uid = get_jwt_identity()
    data = request.get_json() or {}

    updates = {}
    allowed_fields = ["title", "env", "interface_num", "actions"]

    for field in allowed_fields:
        if field in data:
            updates[field] = data[field]

    if not updates:
        return jsonify({"error": "No valid fields provided"}), 400

    try:
        res = db.tasks.update_one(
            {"_id": oid(tid), "user_id": oid(uid)},
            {"$set": updates}
        )
        if res.matched_count == 0:
            return jsonify({"error": "Task not found or unauthorized"}), 404

        log_action(uid, "UPDATE_TASK", tid, {"updates": updates})
        task = db.tasks.find_one({"_id": oid(tid)})
        return jsonify(mongo_to_json(task)), 200
    except Exception as e:
        logger.exception("Error updating task: %s", e)
        return jsonify({"error": str(e)}), 500



@app.delete("/tasks/<tid>")
@jwt_required()
def api_delete_task(tid):
    """Delete a single task."""
    uid = get_jwt_identity()
    try:
        delete_task(uid, tid)
        log_action(uid, "DELETE_TASK", tid)
        return jsonify({"message": "Task deleted successfully"}), 200
    except FileNotFoundError:
        return jsonify({"error": "Task not found"}), 404
    except PermissionError:
        return jsonify({"error": "Unauthorized access"}), 403
    except Exception as e:
        logger.exception("Error deleting task: %s", e)
        return jsonify({"error": str(e)}), 500


@app.get("/tasks/<tid>/results")
@jwt_required()
def api_task_results(tid):
    """Return all reports for a specific task ID."""
    uid = get_jwt_identity()
    try:
        pipeline = [
            {"$match": {"user_id": oid(uid), "task_id": oid(tid)}},
            {"$sort": {"created_at": -1}},
        ]
        reports = list(db.reports.aggregate(pipeline))

        if not reports:
            return jsonify({"message": "No reports found for this task"}), 200

        passed = sum(1 for r in reports if r.get("status") == "passed")
        failed = sum(1 for r in reports if r.get("status") == "failed")
        total = len(reports)
        pass_rate = round((passed / total * 100), 1) if total else 0.0

        result = {
            "task_id": tid,
            "total_runs": total,
            "passed": passed,
            "failed": failed,
            "pass_rate": pass_rate,
            "reports": mongo_to_json(reports),
        }

        return jsonify(result), 200
    except Exception as e:
        logger.exception("Error fetching task results: %s", e)
        return jsonify({"error": str(e)}), 500

# -------------------- Unit Test Generator -----------------------------------------

# ============================================================
#  SocketIO + Test Generation Orchestrator (Corrected)
# ============================================================

from typing import Tuple, List
import os, sys, io, re, shutil, zipfile, tempfile, datetime
from pathlib import Path
from flask import jsonify, request, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import SocketIO
# assume `app` and `db` already exist in this module

import logging
logging.getLogger('engineio.server').setLevel(logging.ERROR)
logging.getLogger('socketio.server').setLevel(logging.ERROR)

# ---------- Attach SocketIO (single instance) ----------
# NOTE: if you use eventlet/gevent, monkey_patch should occur at top-level main guard.
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="eventlet",
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25,
)

# ---------- Storage / Paths ----------
LOCAL_STORAGE_DIR = Path("local_storage")
LOGS_DIR = Path("logs")
for d in (LOCAL_STORAGE_DIR, LOGS_DIR):
    d.mkdir(parents=True, exist_ok=True)

BUCKET_NAME = os.getenv("BUCKET_NAME")

# Optional import of google cloud storage
try:
    from google.cloud import storage  # type: ignore
    _GCS_AVAILABLE = True
except Exception:
    storage = None  # type: ignore
    _GCS_AVAILABLE = False

# ---------- Helpers ----------

def log_action(uid, action, report_id=None, meta=None):
    db.activity.insert_one({
        "uid": uid,
        "action": action,
        "report_id": report_id,
        "meta": meta or {},
        "created_at": datetime.datetime.utcnow(),
    })

ANSI_RE = re.compile(r'\x1B\[[0-9;]*[A-Za-z]')

_DEF_ANSI_STYLES = {
    '0': 'color:inherit',     # reset
    '31': 'color:#ff5555',    # red
    '32': 'color:#50fa7b',    # green
    '33': 'color:#f1fa8c',    # yellow
    '34': 'color:#8be9fd',    # blue
    '35': 'color:#bd93f9',    # magenta
    '36': 'color:#8be9fd',    # cyan
    '90': 'color:#aaaaaa',    # gray
}

import re
import html

def ansi_to_html(line: str) -> str:
    """
    Converts ANSI-style log lines (or plain text) into safe HTML with
    color-coded spans based on log levels and markers.
    """
    # Escape any HTML-sensitive characters first
    safe_line = html.escape(line)

    # Color map for keywords or tags
    color_map = {
        r"\[INFO\]":  '<span style="color:#00bfff; font-weight:bold;">[INFO]</span>',     # Blue
        r"\[RUN\]":   '<span style="color:#32cd32; font-weight:bold;">[RUN]</span>',      # Green
        r"\[GEN\]":   '<span style="color:#ffa500; font-weight:bold;">[GEN]</span>',      # Orange
        r"\[WARN\]":  '<span style="color:#ffcc00; font-weight:bold;">[WARN]</span>',     # Yellow
        r"\[ERROR\]": '<span style="color:#ff4444; font-weight:bold;">[ERROR]</span>',    # Red
        r"\[FAIL\]":  '<span style="color:#ff0000; font-weight:bold;">[FAIL]</span>',     # Bright red
        r"\[PASS\]":  '<span style="color:#00ff7f; font-weight:bold;">[PASS]</span>',     # Greenish
        r"==+":       '<span style="color:#999;">========================================</span>',
    }

    # Apply colors using regex substitution
    for pattern, replacement in color_map.items():
        safe_line = re.sub(pattern, replacement, safe_line)

    # Replace newlines with <br> for HTML display
    safe_line = safe_line.replace("\n", "<br>")

    # Wrap in a span for consistent styling
    return f"<span style='font-family: monospace;'>{safe_line}</span>"


# ---------- GCS / Local upload helper ----------

def upload_or_store_results(local_dir: str, uid: str, prefix: str) -> Tuple[List[str], str | None, str]:
    """Upload a directory to GCS if configured, else store under local_storage.
    Returns: (list_of_file_urls, zip_url, mode['gcs'|'local'])
    """
    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # Try GCS if bucket and library available
    if BUCKET_NAME and _GCS_AVAILABLE:
        try:
            client = storage.Client()
            bucket = client.bucket(BUCKET_NAME)
            gcs_prefix = f"generated_tests/{uid}/{prefix}_{timestamp}"
            uploaded_urls: List[str] = []

            # Upload individual files
            for root, _, files in os.walk(local_dir):
                for f in files:
                    local_path = os.path.join(root, f)
                    rel = os.path.relpath(local_path, local_dir)
                    blob = bucket.blob(f"{gcs_prefix}/{rel}".replace("\\", "/"))
                    blob.upload_from_filename(local_path)
                    url = blob.generate_signed_url(expiration=datetime.timedelta(hours=24), method="GET")
                    uploaded_urls.append(url)

            # Upload ZIP of whole folder
            zip_path = os.path.join(tempfile.gettempdir(), f"{prefix}_{timestamp}.zip")
            with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                for root, _, files in os.walk(local_dir):
                    for file in files:
                        path = os.path.join(root, file)
                        zf.write(path, os.path.relpath(path, local_dir))
            zip_blob = bucket.blob(f"{gcs_prefix}/{prefix}.zip")
            zip_blob.upload_from_filename(zip_path)
            zip_url = zip_blob.generate_signed_url(expiration=datetime.timedelta(hours=24), method="GET")
            return uploaded_urls, zip_url, "gcs"
        except Exception as e:
            print(f"[WARN] GCS failed, falling back to local: {e}")

    # Local fallback
    dest_dir = LOCAL_STORAGE_DIR / uid / f"{prefix}_{timestamp}"
    dest_dir.mkdir(parents=True, exist_ok=True)

    # This copy is safe because dest_dir is under local_storage, not inside local_dir.
    shutil.copytree(local_dir, dest_dir, dirs_exist_ok=True)

    zip_path = dest_dir / f"{prefix}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(dest_dir):
            for file in files:
                abs_file = os.path.join(root, file)
                rel = os.path.relpath(abs_file, dest_dir)
                zf.write(abs_file, rel)
    # Served by /downloads route below
    return [], f"/downloads/{uid}/{prefix}_{timestamp}/{prefix}.zip", "local"

# ============================================================
#  SocketIO Log Streamer + Test Generation Orchestrator
# ============================================================

class SocketIOTee(io.TextIOBase):
    """A text stream that writes both to a file and to SocketIO in real-time."""
    def __init__(self, uid: str, file_handle):
        super().__init__()
        self.uid = uid
        self.file_handle = file_handle
        self._buffer = ""
        self._enc = "utf-8"  # keep our own field; don't touch TextIOBase.encoding

    def writable(self):
        return True

    def write(self, s: str):
        if not isinstance(s, str):
            try:
                s = s.decode(self._enc, errors="ignore")
            except Exception:
                s = str(s)

        # Write to file (ignore if already closed)
        try:
            self.file_handle.write(s)
            self.file_handle.flush()
        except Exception:
            pass

        # Stream line-by-line to SocketIO
        self._buffer += s
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            try:
                socketio.emit("log_line", {"uid": self.uid, "line": ansi_to_html(line + "\n")})
            except Exception:
                pass
        return len(s)

    def flush(self):
        try:
            if hasattr(self.file_handle, "flush") and not self.file_handle.closed:
                self.file_handle.flush()
        except Exception:
            pass

    def close(self):
        try:
            if hasattr(self.file_handle, "close") and not self.file_handle.closed:
                self.file_handle.flush()
                self.file_handle.close()
        except Exception:
            pass
        finally:
            try:
                socketio.emit("log_line", {"uid": self.uid, "line": ansi_to_html("<b>Log stream closed.</b>\n")})
            except Exception:
                pass

# ============================================================
#  Main Test Generation Worker (stream + save + upload)
# ============================================================

def stream_test_generation(folder_path: str, uid: str):
    """Run test generation using generate_all_tests(), save outputs, and stream logs."""
    try:
        # IMPORTANT: no self-import of 'app' here, to avoid recursion.
        from testgen.testgen import generate_all_tests  # your generator entrypoint

        # Per-run working directory
        work_dir = tempfile.mkdtemp(prefix=f"testgen_run_{uid}_")
        os.makedirs(work_dir, exist_ok=True)

        socketio.emit("log_line", {"uid": uid, "line": ansi_to_html("Starting test generation...\n")})
        log_action(uid, "testgen_started", meta={"folder_path": folder_path})

        # Redirect stdout/stderr to tee (log file + live stream)
        log_file_path = os.path.join(work_dir, "generation.log")
        with open(log_file_path, "w", encoding="utf-8", errors="ignore") as lf:
            old_stdout, old_stderr = sys.stdout, sys.stderr
            tee = SocketIOTee(uid, lf)
            sys.stdout = sys.stderr = tee
            try:
                result = generate_all_tests(
                    base_path=folder_path,
                    run_tests=True,
                    interactive=False
                )
            finally:
                # Always restore stdio, then close tee
                sys.stdout, sys.stderr = old_stdout, old_stderr
                try:
                    tee.close()
                except Exception:
                    pass

        # Collect outputs into work_dir
        for folder in ["generated_tests", "coverage_html_report", "logs"]:
            if os.path.exists(folder):
                shutil.copytree(folder, os.path.join(work_dir, folder), dirs_exist_ok=True)

        # Upload or local store
        prefix = f"testgen_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
        uploaded_urls, zip_url, storage_mode = upload_or_store_results(work_dir, uid, prefix)

        # Persist log
        log_action(uid, "testgen_completed", meta={
            "storage_mode": storage_mode,
            "zip_url": zip_url,
            "tools_processed": (result or {}).get("tools_processed", 0),
        })

        # Send summary
        socketio.emit("log_line", {"uid": uid, "line": ansi_to_html("\n--- TEST GENERATION SUMMARY ---\n")})
        socketio.emit("log_line", {"uid": uid, "line": ansi_to_html(json.dumps(result or {}, indent=2) + "\n")})
        socketio.emit("log_done", {
            "uid": uid,
            "zip_url": zip_url,
            "storage_mode": storage_mode,
            "message": "<span style='color:#50fa7b'>✅ Test generation completed successfully.</span>"
        })

    except Exception as e:
        error_msg = f"Error during test generation: {e}"
        try:
            socketio.emit("log_error", {"uid": uid, "error": error_msg})
        except Exception:
            pass
        try:
            log_action(uid, "testgen_error", meta={"error": error_msg})
        except Exception:
            pass

# ---------------------- Folder API ----------------------
# ============================================================
# /test-generator/folder — Upload ZIP and start generation
# ============================================================
@app.post("/test-generator/folder")
@jwt_required()
def api_generate_tests_folder():
    try:
        uid = str(ObjectId())  # unique ID for this run
        uploaded_file = request.files.get("file")
        if not uploaded_file:
            return jsonify({"error": "No file uploaded"}), 400

        # ------------------------------------------------------
        # ✅ Persistent upload directory setup
        # ------------------------------------------------------
        base_uploads_dir = Path("uploads")
        base_uploads_dir.mkdir(exist_ok=True)

        # Extract filename (without extension)
        project_name = Path(uploaded_file.filename).stem
        project_dir = base_uploads_dir / project_name

        # Clean up any old data from previous runs
        if project_dir.exists():
            shutil.rmtree(project_dir)
        project_dir.mkdir(parents=True, exist_ok=True)

        # ------------------------------------------------------
        # ✅ Save and extract ZIP
        # ------------------------------------------------------
        zip_path = project_dir / uploaded_file.filename
        uploaded_file.save(zip_path)

        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(project_dir)
        os.remove(zip_path)

        # ------------------------------------------------------
        # ✅ Logging clarity
        # ------------------------------------------------------
        print("=" * 80)
        print(f"[RUN] Extracted ZIP: {uploaded_file.filename}")
        print(f"[RUN] Base path for generation: {project_dir}")
        print("=" * 80)

        # ------------------------------------------------------
        # ✅ Start async generation (keeps SocketIO logic)
        # ------------------------------------------------------
        socketio.start_background_task(stream_test_generation, str(project_dir), uid)

        return jsonify({
            "message": f"✅ Test generation started for {project_name}",
            "uid": uid,
            "base_path": str(project_dir),
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---------------------- Reports Endpoint (stub) ----------------------
@app.get("/test-generator/folder/report-test")
@jwt_required()
def api_list_bulk_reports():
    uid = get_jwt_identity()
    docs = list(db.reports.find({"user_id": oid(uid)}).sort("created_at", -1).limit(10))
    for d in docs:
        d["_id"] = str(d["_id"])
    return jsonify({"items": docs})

# ---------------------- Serve Local Downloads ----------------------
@app.get("/downloads/<uid>/<path:filename>")
def serve_local_file(uid, filename):
    base_path = LOCAL_STORAGE_DIR / uid
    file_path = base_path / filename
    if not file_path.exists():
        return jsonify({"error": "File not found"}), 404
    return send_from_directory(base_path, filename, as_attachment=True)

# Optional: serve coverage HTML from latest run in local storage
@app.get("/coverage/<uid>/<path:subpath>")
def serve_local_coverage(uid, subpath):
    base_path = LOCAL_STORAGE_DIR / uid
    uid_dirs = sorted([p for p in base_path.glob("testgen_*") if p.is_dir()], reverse=True)
    if not uid_dirs:
        return jsonify({"error": "No coverage found"}), 404
    for run_dir in uid_dirs:
        cand = run_dir / "coverage_html_report" / subpath
        if cand.exists():
            return send_from_directory((run_dir / "coverage_html_report"), subpath)
    return jsonify({"error": "Coverage file not found"}), 404

# ---------------------- Run (only if this is your main) ----------------------
if __name__ == "__main__":
    print("Starting Flask + SocketIO server on http://localhost:8080 ...")
    socketio.run(app, host="0.0.0.0", port=8080, debug=True, allow_unsafe_werkzeug=True)
