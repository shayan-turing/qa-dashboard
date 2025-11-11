import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";

export default function TaskDetails() {
  const { id } = useParams();
  const { apiFetch } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ title: "", env: "", interface_num: "", actions: [] });

  // Load task
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/tasks/${id}`);
        const data = await res.json();
        if (res.ok) {
          setTask(data);
          setForm({
            title: data.title || "",
            env: data.env || "",
            interface_num: data.interface_num || "",
            actions: data.actions || [],
          });
        } else toast.show(data.error || "Failed to load task", "error");
      } catch {
        toast.show("Network error while loading task", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiFetch, id, toast]);

  // Delete
  const handleDelete = async () => {
    if (!window.confirm("Delete this task?")) return;
    try {
      const res = await apiFetch(`/tasks/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.show("🗑️ Task deleted", "success");
        navigate("/tasks");
      } else toast.show(data.error || "Delete failed", "error");
    } catch {
      toast.show("Network error deleting task", "error");
    }
  };

  // Save edits
  const handleSave = async () => {
    try {
      const res = await apiFetch(`/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        toast.show("✅ Task updated", "success");
        setTask(data);
        setEditMode(false);
      } else toast.show(data.error || "Update failed", "error");
    } catch {
      toast.show("Network error updating task", "error");
    }
  };

  if (loading) return <div className="text-slate-500">Loading task details...</div>;
  if (!task) return <div className="text-red-500">Task not found.</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Link to="/tasks" className="text-blue-600 dark:text-blue-400 underline text-sm">
        ← Back to Tasks
      </Link>

      {/* Header */}
      <div className="border rounded-xl p-5 bg-white dark:bg-slate-900 dark:border-slate-800">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold mb-1 dark:text-white">
            📄 {editMode ? (
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="border rounded p-1 text-black dark:text-white bg-transparent"
              />
            ) : (
              task.title || "Untitled Task"
            )}
          </h2>
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
            >
              ✏️ Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                💾 Save
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
              >
                ❌ Cancel
              </button>
            </div>
          )}
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Interface:{" "}
          {editMode ? (
            <input
              type="text"
              value={form.interface_num}
              onChange={(e) => setForm((f) => ({ ...f, interface_num: e.target.value }))}
              className="border rounded p-1 w-20 bg-transparent text-black dark:text-white"
            />
          ) : (
            task.interface_num
          )}{" "}
          | Env:{" "}
          {editMode ? (
            <input
              type="text"
              value={form.env}
              onChange={(e) => setForm((f) => ({ ...f, env: e.target.value }))}
              className="border rounded p-1 bg-transparent text-black dark:text-white"
            />
          ) : (
            task.env || "—"
          )}
        </p>
      </div>

      {/* Actions */}
      <div className="border rounded-xl p-5 bg-slate-900/30 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-2 dark:text-white">🛠 Actions:</h3>
        {editMode ? (
          <textarea
            value={JSON.stringify(form.actions, null, 2)}
            onChange={(e) => {
              try {
                setForm((f) => ({ ...f, actions: JSON.parse(e.target.value) }));
              } catch {}
            }}
            className="w-full border rounded p-2 text-xs font-mono bg-slate-800 text-white h-40"
          />
        ) : (
          <pre className="bg-slate-800 text-white p-3 rounded text-xs overflow-x-auto">
            {JSON.stringify(task.actions, null, 2)}
          </pre>
        )}
      </div>

      {/* Delete */}
      <div className="flex justify-end">
        <button
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          🗑 Delete Task
        </button>
      </div>
    </div>
  );
}
