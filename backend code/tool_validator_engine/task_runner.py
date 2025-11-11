import traceback
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from pymongo import MongoClient, ASCENDING, DESCENDING
from bson import ObjectId
from dotenv import load_dotenv
import os

from .running_tasks import env_interface, execute_api

load_dotenv()
mongo = MongoClient(os.getenv("MONGO_URI"))
db = mongo["docdiff"]

# Ensure indexes for speed
db.tasks.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
db.reports.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
db.reports.create_index([("task_id", ASCENDING), ("created_at", DESCENDING)])

def oid(x): return ObjectId(str(x))
def now(): return datetime.now(timezone.utc)


# ----------------------------- CRUD ----------------------------- #

def create_task(user_id, env, interface_num, actions, title=None):
    task = {
        "user_id": oid(user_id),
        "env": env,
        "interface_num": str(interface_num),
        "actions": actions or [],
        "title": title or f"Task - {datetime.utcnow().isoformat()}",
        "created_at": now(),
    }
    res = db.tasks.insert_one(task)
    task["_id"] = str(res.inserted_id)
    task["user_id"] = str(user_id)
    return task


def list_tasks(user_id, page=1, page_size=50):
    page = max(int(page or 1), 1)
    page_size = min(max(int(page_size or 50), 1), 200)

    cursor = (
        db.tasks.find({"user_id": oid(user_id)})
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    tasks = []
    for t in cursor:
        t["_id"] = str(t["_id"])
        t["user_id"] = str(user_id)
        tasks.append(t)

    total = db.tasks.count_documents({"user_id": oid(user_id)})
    return {"items": tasks, "page": page, "page_size": page_size, "total": total}


def get_task(user_id, task_id):
    t = db.tasks.find_one({"_id": oid(task_id)})
    if not t:
        raise FileNotFoundError("Task not found")
    if str(t["user_id"]) != str(user_id):
        raise PermissionError("Forbidden")
    t["_id"] = str(t["_id"])
    return t


def delete_task(user_id, task_id):
    get_task(user_id, task_id)  # raises on error
    db.tasks.delete_one({"_id": oid(task_id)})
    return True


# ----------------------------- EXECUTION ----------------------------- #

def _write_report(user_id, task_id, title, results, status):
    doc = {
        "user_id": oid(user_id),
        "task_id": oid(task_id),
        "title": title,
        "results": results,
        "status": status,
        "report_type": "task_run",
        "created_at": now(),
    }
    db.reports.insert_one(doc)
    doc["_id"] = str(doc["_id"])
    # normalize for client convenience (taskdetails.jsx expects top-level actions)
    return _normalize_report_for_client(doc)


def _normalize_report_for_client(report_doc):
    """Flatten results for frontend convenience: expose top-level `actions`."""
    doc = {
        "_id": str(report_doc.get("_id")),
        "title": report_doc.get("title"),
        "status": report_doc.get("status"),
        "created_at": report_doc.get("created_at"),
        "task_id": str(report_doc.get("task_id")) if report_doc.get("task_id") else None,
        "actions": [],
    }
    results = (report_doc.get("results") or {})
    actions = results.get("actions") or []
    # pass-through if error payload exists
    if "error" in results:
        doc["error"] = results.get("error")
        doc["trace"] = results.get("trace")
    # transform action record shape to what your taskdetails.jsx uses
    for a in actions:
        doc["actions"].append({
            "index": a.get("index"),
            "name": a.get("api_name"),
            "arguments": a.get("args"),
            "output": a.get("result") if a.get("status") == 200 else None,
            "error": None if a.get("status") == 200 else (a.get("result") or {}).get("error"),
            "traceback": None,  # we only store in report-level trace on fatal
            "success": bool(a.get("success")),
        })
    return doc


def run_task(user_id, task_id):
    """Run a single task."""
    try:
        task = get_task(user_id, task_id)
        env_data = env_interface(task["env"], task["interface_num"])
        actions_result, success = [], True

        for i, act in enumerate(task.get("actions", [])):
            api_name, args = act.get("name"), act.get("arguments", {})
            result, status = execute_api(api_name, args, env_data)
            actions_result.append({
                "index": i,
                "api_name": api_name,
                "args": args,
                "result": result,
                "status": status,
                "success": status == 200,
            })
            if status != 200:
                success = False

        title = f"Run - {task.get('title')}"
        return _write_report(
            user_id,
            task_id,
            title,
            {"actions": actions_result},
            "passed" if success else "failed",
        )

    except Exception as e:
        trace = traceback.format_exc()
        return _write_report(
            user_id,
            task_id,
            f"Run - (Error)",
            {"error": str(e), "trace": trace},
            "failed",
        )


def run_all_tasks(user_id, max_workers=4):
    """Run all tasks for a user in parallel (thread pool)."""
    tasks = list(db.tasks.find({"user_id": oid(user_id)}))
    if not tasks:
        return []

    workers = max(1, min(int(max_workers or 4), 16, len(tasks)))
    reports = []

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futures = {ex.submit(run_task, user_id, str(t["_id"])): str(t["_id"]) for t in tasks}
        for fut in as_completed(futures):
            try:
                reports.append(fut.result())
            except Exception as e:
                # unlikely thanks to run_task wrapping, but keep a guard
                reports.append({"status": "failed", "error": str(e)})

    return reports


# ----------------------------- REPORTS ----------------------------- #

def get_report(user_id, report_id):
    r = db.reports.find_one({"_id": oid(report_id), "user_id": oid(user_id)})
    if not r:
        raise FileNotFoundError("Report not found")
    return _normalize_report_for_client(r)


def delete_report(user_id, report_id):
    r = db.reports.find_one({"_id": oid(report_id)})
    if not r:
        raise FileNotFoundError("Report not found")
    if str(r["user_id"]) != str(user_id):
        raise PermissionError("Forbidden")
    db.reports.delete_one({"_id": oid(report_id)})
    return True


# ----------------------------- SUMMARY ----------------------------- #

def summary_for_user(user_id, limit=50):
    total_tasks = db.tasks.count_documents({"user_id": oid(user_id)})

    pipeline = [
        {"$match": {"user_id": oid(user_id), "report_type": "task_run"}},
        {"$sort": {"created_at": -1}},
        {"$limit": int(limit or 50)},
    ]
    reports = list(db.reports.aggregate(pipeline))
    passed = sum(1 for r in reports if r.get("status") == "passed")
    failed = sum(1 for r in reports if r.get("status") == "failed")
    total_runs = passed + failed
    pass_rate = round((passed / total_runs * 100), 1) if total_runs else 0.0

    return {
        "total_tasks": total_tasks,
        "total_runs": total_runs,
        "passed": passed,
        "failed": failed,
        "pass_rate": f"{pass_rate}%",
        "recent_runs": [{
            "id": str(r["_id"]),
            "title": r.get("title"),
            "status": r.get("status"),
            "created_at": r.get("created_at"),
            "task_id": str(r.get("task_id")) if r.get("task_id") else None,
        } for r in reports[:10]],
    }
