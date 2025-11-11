import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";

export default function TaskResults() {
  const { id } = useParams(); // task_id
  const { apiFetch } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await apiFetch(`/tasks/${id}/results`);
        const json = await res.json();
        if (res.ok) setData(json);
        else toast.show(json.error || "Failed to load results", "error");
      } catch {
        toast.show("Network error while loading results", "error");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [apiFetch, id, toast]);

  if (loading)
    return <div className="text-center text-slate-500">Loading results...</div>;

  if (!data || !data.results)
    return (
      <div className="text-center text-red-500">
        No results found for this task.
      </div>
    );

  const summary = data.summary || { total_runs: 0, passed: 0, failed: 0, pass_rate: "0%" };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back Link */}
      <div className="flex justify-start mb-2">
        <Link
          to="/tasks"
          className="text-blue-500 dark:text-blue-400 hover:underline text-sm"
        >
          ← Back to Tasks
        </Link>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-semibold text-center text-indigo-600">
        📋 Task Results Summary
      </h1>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <SummaryBox color="purple" label="Total Runs" value={summary.total_runs} />
        <SummaryBox color="green" label="Passed" value={summary.passed} />
        <SummaryBox color="red" label="Failed" value={summary.failed} />
        <SummaryBox color="orange" label="Pass Rate" value={summary.pass_rate} />
      </div>

      {/* Table of Results */}
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="bg-blue-600 text-white px-4 py-2 font-semibold">
          Recent Runs
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="p-2 text-left">Run ID</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Error</th>
                <th className="p-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.results.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-slate-500">
                    No runs yet for this task.
                  </td>
                </tr>
              ) : (
                data.results.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="p-2 text-xs text-slate-700 dark:text-slate-300">
                      {r._id}
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-2 py-1 text-xs rounded ${
                          r.status === "passed"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.status?.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-slate-600 dark:text-slate-400">
                      {r.error ? r.error.slice(0, 60) + "..." : "—"}
                    </td>
                    <td className="p-2 text-xs text-slate-600 dark:text-slate-400">
                      {r.created_at
                        ? new Date(r.created_at).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* Summary Box */
function SummaryBox({ color, label, value }) {
  const colors = {
    purple: "bg-purple-600",
    green: "bg-green-600",
    red: "bg-red-600",
    orange: "bg-orange-500",
  };
  return (
    <div className={`${colors[color]} text-white p-5 rounded-xl`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm mt-1">{label}</div>
    </div>
  );
}
