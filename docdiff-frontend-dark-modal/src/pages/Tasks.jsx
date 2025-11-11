import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { useNavigate } from "react-router-dom";

export default function Tasks() {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    env: "",
    interface_num: "1",
    title: "",
    actions: [{ name: "ping", arguments: {} }],
  });

  const [interfaces] = useState(["1", "2", "3"]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load Tasks
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/tasks");
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items || [];
      setTasks(items);
    } catch {
      toast.show("Network error loading tasks", "error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  // Create Task
  const createTask = async (e) => {
    e.preventDefault();
    if (!form.env.trim()) {
      toast.show("Please enter environment path", "error");
      return;
    }
    try {
      const res = await apiFetch("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.show("✅ Task created", "success");
        setForm({ env: "", interface_num: "1", title: "", actions: [{ name: "ping", arguments: {} }] });
        loadTasks();
      } else toast.show(data.error || "Failed to create task", "error");
    } catch {
      toast.show("Network error creating task", "error");
    }
  };

  // Run Task
  const runTask = async (id) => {
    try {
      const res = await apiFetch(`/tasks/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (res.ok) toast.show(`🚀 Task run: ${data.status}`, "success");
      else toast.show(data.error || "Run failed", "error");
    } catch {
      toast.show("Network error running task", "error");
    }
  };

  // Delete Task
  const deleteTask = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      const res = await apiFetch(`/tasks/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.show("🗑️ Task deleted", "success");
        loadTasks();
      } else toast.show(data.error || "Delete failed", "error");
    } catch {
      toast.show("Network error deleting task", "error");
    }
  };

  // Run All
  const runAllTasks = async () => {
    try {
      const res = await apiFetch("/tasks/run_all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.show("🚀 All tasks executed", "success");
        navigate("/tasks/results");
      } else toast.show(data.error || "Run all failed", "error");
    } catch {
      toast.show("Network error running all tasks", "error");
    }
  };

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-2xl font-semibold">Task Checker</div>
        <div className="flex gap-2">
          <button onClick={runAllTasks} className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
            ▶️ Run All
          </button>
          <button
            onClick={() => navigate("/tasks/results")}
            className="bg-indigo-500 text-white px-3 py-1.5 rounded hover:bg-indigo-600"
          >
            📊 View All Results
          </button>
        </div>
      </div>

      {/* CREATE FORM */}
      <form onSubmit={createTask} className="p-4 border rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800 grid md:grid-cols-2 gap-3">
        <input
          type="text"
          placeholder="Enter environment path (e.g., envs/smart_home)"
          value={form.env}
          onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))}
          className="border p-2 rounded col-span-2 bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700"
        />
        <select
          value={form.interface_num}
          onChange={(e) => setForm((f) => ({ ...f, interface_num: e.target.value }))}
          className="border p-2 rounded bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700"
        >
          {interfaces.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Task title"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="border p-2 rounded bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700"
        />
        <textarea
          value={JSON.stringify(form.actions, null, 2)}
          onChange={(e) => {
            try {
              setForm((f) => ({ ...f, actions: JSON.parse(e.target.value) }));
            } catch {}
          }}
          className="col-span-2 border p-2 rounded text-xs h-24 bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700"
        />
        <button type="submit" className="col-span-2 bg-black text-white py-2 rounded hover:bg-slate-800 transition">
          ➕ Create Task
        </button>
      </form>

      {/* TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 overflow-hidden">
        <div className="bg-blue-600 text-white px-4 py-2 font-semibold">Available Tasks</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="p-2 text-left">Interface</th>
                <th className="p-2 text-left">File</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-slate-500">Loading tasks...</td>
                </tr>
              ) : Array.isArray(tasks) && tasks.length > 0 ? (
                tasks.map((t, i) => (
                  <tr key={t._id || i} className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2">
                      <span className="bg-cyan-600 text-white text-xs px-2 py-1 rounded">
                        INTERFACE_{t.interface_num}
                      </span>
                    </td>
                    <td className="p-2">{t.title || t._id}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 text-xs rounded ${
                        t.status === "passed"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {t.status === "passed" ? "✓ PASSED" : "✗ FAILED"}
                      </span>
                    </td>
                    <td className="p-2 flex gap-2">
                      <button
                        onClick={() => runTask(t._id)}
                        className="bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700"
                      >
                        ▶ Run
                      </button>
                      <button
                        onClick={() => navigate(`/tasks/${t._id}/view`)}
                        className="bg-indigo-500 text-white px-2 py-1 rounded text-xs hover:bg-indigo-600"
                      >
                        👁 View
                      </button>
                      <button
                        onClick={() => navigate(`/tasks/${t._id}/results`)}
                        className="bg-teal-500 text-white px-2 py-1 rounded text-xs hover:bg-teal-600"
                      >
                        📊 Results
                      </button>

                      <button
                        onClick={() => deleteTask(t._id)}
                        className="bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700"
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="4" className="p-4 text-center text-slate-500">No tasks found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
