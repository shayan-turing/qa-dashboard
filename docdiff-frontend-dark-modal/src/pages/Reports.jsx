import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { useModal } from "../components/Modal";

export default function Reports() {
  const { apiFetch, apiUpload } = useAuth();
  const toast = useToast();
  const modal = useModal();

  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // 📥 Load reports
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const url = "/reports" + (cursor ? `?cursor=${cursor}` : "");
      const res = await apiFetch(url);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setCursor(data.next_cursor);
      } else {
        toast.show(data.error || "Failed to load reports", "error");
      }
    } catch (e) {
      toast.show("Network error loading reports", "error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, cursor, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // 🧩 Upload documents to create a report
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file1 || !file2) {
      toast.show("Please upload both files", "error");
      return;
    }

    const fd = new FormData();
    fd.append("file1", file1);
    fd.append("file2", file2);
    if (title) fd.append("title", title);
    if (tags) fd.append("tags", tags);

    setIsUploading(true);
    setProgress(0);

    try {
      const res = await apiUpload("/reports", fd, { onProgress: setProgress });
      if (res.ok) {
        toast.show("Report created successfully", "success");
        setFile1(null);
        setFile2(null);
        setTitle("");
        setTags("");
        loadReports();
      } else {
        toast.show(res.json?.error || "Failed to create report", "error");
      }
    } catch (err) {
      toast.show("Upload error", "error");
    } finally {
      setIsUploading(false);
    }
  };

  // 🗑️ Delete report
  const remove = async (id) => {
    const ok = await modal.confirm({
      title: "Delete report?",
      message: "This action cannot be undone.",
    });
    if (!ok) return;

    try {
      const res = await apiFetch(`/reports/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.show("Report deleted", "success");
        setItems(items.filter((x) => (x._id || x.id) !== id));
      } else {
        toast.show(data.error || "Delete failed", "error");
      }
    } catch {
      toast.show("Network error deleting report", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-2xl font-semibold dark:text-white">📊 Reports Dashboard</div>

      {/* Upload Form */}
      <form
        onSubmit={handleUpload}
        className="border p-4 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800 space-y-3 max-w-xl"
      >
        <div className="text-lg font-medium dark:text-white">Create New Report</div>

        <input
          type="text"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border p-2 w-full rounded bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700"
        />

        <input
          type="text"
          placeholder="Tags (comma separated)"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="border p-2 w-full rounded bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700"
        />

        <div className="grid gap-2">
          <label className="text-sm font-medium dark:text-slate-300">
            Upload Document 1
          </label>
          <input
            type="file"
            accept=".txt,.docx,.pdf,.md"
            onChange={(e) => setFile1(e.target.files?.[0] || null)}
            className="border p-2 rounded bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700"
          />

          <label className="text-sm font-medium dark:text-slate-300">
            Upload Document 2
          </label>
          <input
            type="file"
            accept=".txt,.docx,.pdf,.md"
            onChange={(e) => setFile2(e.target.files?.[0] || null)}
            className="border p-2 rounded bg-white dark:bg-slate-900 dark:text-white dark:border-slate-700"
          />
        </div>

        {progress > 0 && progress < 100 && (
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded">
            <div
              className="h-2 bg-black dark:bg-white rounded"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        )}

        <button
          type="submit"
          disabled={isUploading}
          className="bg-black text-white rounded-lg py-2 px-4 hover:bg-slate-800 transition disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Create Report"}
        </button>
      </form>

      {/* Reports List */}
      <div className="text-lg font-medium dark:text-white">Saved Reports</div>

      {loading ? (
        <div className="text-slate-500 dark:text-slate-400">Loading reports...</div>
      ) : items.length === 0 ? (
        <div className="text-slate-500 dark:text-slate-400">No reports yet.</div>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => {
            const id = r._id || r.id;
            return (
              <div
                key={id}
                className="border rounded-xl p-4 flex items-start justify-between gap-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="min-w-0">
                  <div className="font-medium text-lg truncate dark:text-white">
                    {r.title}
                  </div>

                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {r.report_type || "comparison"} ·{" "}
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString()
                      : ""}
                  </div>

                  <div className="mt-2 text-sm dark:text-slate-200">
                    <strong>Jaccard:</strong> {r.results?.jaccard?.toFixed(3)} ·{" "}
                    <strong>TF-IDF:</strong> {r.results?.tfidf?.toFixed(3)} ·{" "}
                    <strong>Semantic:</strong> {r.results?.semantic?.toFixed(3)} ·{" "}
                    <strong>LLM:</strong> {r.results?.llm?.toFixed(3)}
                  </div>

                  {/* Navigation Link */}
                  <div className="mt-3 flex gap-3">
                    <Link
                      to={`/reports/${id}`}
                      className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition text-sm"
                    >
                      🔍 View Details
                    </Link>

                    <button
                      onClick={() => remove(id)}
                      className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition text-sm"
                    >
                      🗑 Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
