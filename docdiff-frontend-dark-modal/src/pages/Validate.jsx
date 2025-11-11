import React, { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { useModal } from "../components/Modal";

export default function Validate() {
  const { apiFetch, apiUpload } = useAuth();
  const toast = useToast();
  const modal = useModal();

  // Upload state
  const [excel, setExcel] = useState(null);
  const [doc, setDoc] = useState(null);
  const [sheets, setSheets] = useState({});
  const [selectedSheet, setSelectedSheet] = useState("");
  const [columns, setColumns] = useState([]);
  const [selectedCols, setSelectedCols] = useState([]);

  const [threshold, setThreshold] = useState(0.5);
  const [useLLM, setUseLLM] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Saved reports
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load Validation Reports
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/validate");
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
      } else toast.show(data.error || "Failed to load validations", "error");
    } catch {
      toast.show("Network error", "error");
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Load Excel sheet names and columns
  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcel(file);

    const fd = new FormData();
    fd.append("excel_file", file);
    try {
      const res = await apiUpload("/validate/columns", fd);
      if (res.ok && res.json?.sheets) {
        setSheets(res.json.sheets);
        const first = Object.keys(res.json.sheets)[0];
        setSelectedSheet(first);
        setColumns(res.json.sheets[first]);
        toast.show("Excel loaded successfully", "success");
      } else toast.show(res.json?.error || "Failed to load Excel", "error");
    } catch {
      toast.show("Error reading Excel file", "error");
    }
  };

  const handleSheetChange = (sheet) => {
    setSelectedSheet(sheet);
    setColumns(sheets[sheet] || []);
    setSelectedCols([]);
  };

  // Run Validation
  const submitValidation = async (e) => {
    e.preventDefault();
    if (!excel || !doc) return toast.show("Please upload both files", "error");
    if (!selectedSheet || selectedCols.length === 0)
      return toast.show("Please select a sheet and columns", "error");

    const fd = new FormData();
    fd.append("excel_file", excel);
    fd.append("doc_file", doc);
    fd.append("sheet_name", selectedSheet);
    fd.append("threshold", threshold);
    fd.append("use_llm_reasoning", useLLM);

    setIsUploading(true);
    setProgress(0);

    try {
      const res = await apiUpload("/validate", fd, { onProgress: setProgress });
      if (res.ok) {
        toast.show("Validation completed", "success");
        loadReports();
      } else toast.show(res.json?.error || "Validation failed", "error");
    } catch {
      toast.show("Upload failed", "error");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Report
  const remove = async (id) => {
    const ok = await modal.confirm({
      title: "Delete this validation report?",
      message: "This action cannot be undone.",
    });
    if (!ok) return;
    const res = await apiFetch(`/validate/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) {
      toast.show("Deleted", "success");
      setItems(items.filter((x) => (x._id || x.id) !== id));
    } else toast.show(data.error || "Delete failed", "error");
  };

  return (
    <div className="space-y-6">
      <div className="text-2xl font-semibold">🧪 Validation Dashboard</div>

      {/* Upload Form */}
      <form
        onSubmit={submitValidation}
        className="border p-4 rounded-xl bg-white dark:bg-slate-900 dark:border-slate-800 space-y-3 max-w-xl"
      >
        <div className="text-lg font-medium">Run New Validation</div>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleExcelUpload}
          className="border p-2 rounded w-full bg-white dark:bg-slate-900 dark:border-slate-700"
        />

        {/* Sheet */}
        {Object.keys(sheets).length > 0 && (
          <div>
            <label className="text-sm font-medium dark:text-white">
              Select Sheet
            </label>
            <select
              value={selectedSheet}
              onChange={(e) => handleSheetChange(e.target.value)}
              className="border p-2 rounded w-full mt-1 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            >
              {Object.keys(sheets).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Columns */}
        {columns.length > 0 && (
          <div>
            <label className="text-sm font-medium dark:text-white">
              Select Column(s)
            </label>
            <select
              multiple
              value={selectedCols}
              onChange={(e) =>
                setSelectedCols(Array.from(e.target.selectedOptions, (o) => o.value))
              }
              className="border p-2 rounded w-full h-32 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
            >
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        )}

        <input
          type="file"
          accept=".txt,.docx,.pdf"
          onChange={(e) => setDoc(e.target.files?.[0] || null)}
          className="border p-2 rounded w-full bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
        />

        <div className="flex gap-3 items-center">
          <label className="text-sm dark:text-white">Threshold</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="border p-2 rounded w-24 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-white"
          />
          <label className="flex items-center gap-2 text-sm dark:text-white">
            <input
              type="checkbox"
              checked={useLLM}
              onChange={(e) => setUseLLM(e.target.checked)}
            />
            Use LLM
          </label>
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
          {isUploading ? "Validating..." : "Run Validation"}
        </button>
      </form>

      {/* Saved Reports */}
      <div className="text-lg font-medium">Previous Validations</div>
      {loading ? (
        <div className="text-slate-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-slate-500">No validations found.</div>
      ) : (
        <div className="grid gap-3">
          {items.map((r) => {
            const id = r._id || r.id;
            return (
              <div
                key={id}
                className="border rounded-xl p-4 flex items-start justify-between gap-3 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <div className="font-medium text-lg truncate dark:text-white">
                    {r.title}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    {r.report_type || "validation"} ·{" "}
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString()
                      : ""}
                  </div>
                  <div className="mt-1 text-sm dark:text-slate-200">
                    <strong>Tools:</strong> {r.results?.summary?.total_tools || 0} ·{" "}
                    <strong>Matched:</strong> {r.results?.summary?.matched || 0}
                  </div>
                  <div className="mt-2 text-sm">
                    <Link
                      className="underline text-blue-600 dark:text-blue-400"
                      to={`/validate/${id}`}
                    >
                      Open details
                    </Link>
                  </div>
                </div>
                <button
                  onClick={() => remove(id)}
                  className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 transition"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
