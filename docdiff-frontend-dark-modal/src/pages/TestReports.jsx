import React, { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";

export default function TestReports() {
  const { apiFetch } = useAuth();
  const { show } = useToast();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState({});

  // ------------------ Fetch Reports ------------------
  async function loadReports() {
    try {
      setLoading(true);
      const res = await apiFetch("/test-generator/folder/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(data.items || []);
    } catch (err) {
      console.error(err);
      show("❌ Failed to fetch reports", "error");
    } finally {
      setLoading(false);
    }
  }

  // ------------------ Refresh ZIP Link ------------------
  async function handleRefreshZip(rid) {
    setRefreshing((r) => ({ ...r, [rid]: true }));
    try {
      const res = await apiFetch(`/test-generator/folder/download/${rid}`);
      const data = await res.json();
      if (res.ok && data.download_url) {
        show("✅ Refreshed signed download link", "success");
        setReports((prev) =>
          prev.map((r) =>
            r._id === rid ? { ...r, zip_download_url: data.download_url } : r
          )
        );
      } else {
        show("❌ Failed to refresh link", "error");
      }
    } catch (err) {
      console.error(err);
      show("Error refreshing download link", "error");
    } finally {
      setRefreshing((r) => ({ ...r, [rid]: false }));
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  // ------------------ Render ------------------
  return (
    <div className="p-6 text-gray-100">
      <h1 className="text-2xl font-semibold mb-6 text-white">
        📜 Test Generation Reports
      </h1>

      {loading ? (
        <div className="text-gray-400">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="text-gray-400">No reports found yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-neutral-800 rounded-lg overflow-hidden">
            <thead className="bg-neutral-800 text-gray-300">
              <tr>
                <th className="px-4 py-2 text-left">Created</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Exit Code</th>
                <th className="px-4 py-2 text-left">Source</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {reports.map((r) => (
                <tr key={r._id} className="hover:bg-neutral-900">
                  <td className="px-4 py-2 text-gray-300">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-2 font-medium ${
                      r.status === "completed"
                        ? "text-green-400"
                        : r.status === "failed"
                        ? "text-red-400"
                        : "text-yellow-400"
                    }`}
                  >
                    {r.status}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{r.exit_code}</td>
                  <td className="px-4 py-2 text-gray-400">
                    {r.source_type || "N/A"}
                  </td>
                  <td className="px-4 py-2 space-x-2">
                    {r.zip_download_url ? (
                      <>
                        <a
                          href={r.zip_download_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                        >
                          Download ZIP
                        </a>
                        <button
                          onClick={() => handleRefreshZip(r._id)}
                          disabled={refreshing[r._id]}
                          className={`px-3 py-1.5 rounded text-white text-sm ${
                            refreshing[r._id]
                              ? "bg-gray-600 cursor-not-allowed"
                              : "bg-purple-600 hover:bg-purple-700"
                          }`}
                        >
                          {refreshing[r._id] ? "Refreshing..." : "Refresh Link"}
                        </button>
                      </>
                    ) : (
                      <span className="text-gray-500 text-sm italic">
                        No ZIP available
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
