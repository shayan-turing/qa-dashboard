import React, { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { Link, useNavigate } from "react-router-dom";

export default function ResultsSummary() {
  const { apiFetch } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const res = await apiFetch("/tasks/summary");
        const data = await res.json();
        if (res.ok) setSummary(data);
        else toast.show(data.error || "Failed to load summary", "error");
      } catch {
        toast.show("Network error loading summary", "error");
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, [apiFetch, toast]);

  if (loading)
    return <div className="text-center text-slate-500">Loading summary...</div>;

  if (!summary)
    return <div className="text-center text-red-500">No summary available.</div>;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex justify-start mb-2">
        <Link
          to="/tasks"
          className="text-blue-500 dark:text-blue-400 hover:underline text-sm"
        >
          ← Back to Tasks
        </Link>
      </div>

      {/* Title */}
      <div className="text-3xl font-semibold text-center text-indigo-600">
        📊 Test Run Summary
      </div>

      {/* Summary boxes */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
        <SummaryBox color="purple" label="Total Tasks" value={summary.total_tasks} />
        <SummaryBox color="green" label="Passed" value={summary.passed} />
        <SummaryBox color="red" label="Failed" value={summary.failed} />
        <SummaryBox color="yellow" label="Not Run" value={summary.not_run} />
        <SummaryBox color="orange" label="Pass Rate" value={summary.pass_rate} />
      </div>

      {/* Legend */}
      <div className="flex justify-center items-center gap-4 text-sm mt-4">
        <Legend color="bg-green-500" label="Passed" />
        <Legend color="bg-red-500" label="Failed" />
        <Legend color="bg-yellow-400" label="Not Run" />
      </div>

      {/* Results Table */}
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl overflow-hidden mt-2">
        <div className="bg-blue-600 text-white px-4 py-2 font-semibold">
          Test Results
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="p-2 text-left">Task</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {summary.recent_runs.map((r) => (
                <tr
                  key={r.id}
                  onClick={() =>
                    r.task_id && navigate(`/tasks/${r.task_id}/results`)
                  }
                  className="cursor-pointer border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                >
                  <td className="p-2">{r.title || r.id}</td>
                  <td className="p-2">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        r.status === "passed"
                          ? "bg-green-100 text-green-700"
                          : r.status === "failed"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {r.status === "not_run"
                        ? "NOT RUN"
                        : r.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-2">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* Reusable Summary Box */
function SummaryBox({ color, label, value }) {
  const colors = {
    purple: "bg-purple-600",
    green: "bg-green-600",
    red: "bg-red-600",
    yellow: "bg-yellow-500",
    orange: "bg-orange-500",
  };
  return (
    <div className={`${colors[color]} text-white p-5 rounded-xl`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );
}

/* Legend Component */
function Legend({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${color}`}></div>
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
    </div>
  );
}
