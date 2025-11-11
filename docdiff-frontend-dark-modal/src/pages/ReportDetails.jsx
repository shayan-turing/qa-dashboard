import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useToast } from "../components/Toast";
import { useModal } from "../components/Modal";
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from "chart.js";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

ChartJS.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title
);

export default function ReportDetails() {
  const { id } = useParams();
  const { apiFetch } = useAuth();
  const toast = useToast();
  const modal = useModal();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const reportRef = useRef(null);

  // 📥 Load report details
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/reports/${id}`);
        const data = await res.json();
        if (res.ok) setReport(data);
        else toast.show(data.error || "Failed to load report", "error");
      } catch (err) {
        toast.show("Network error while loading report", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiFetch, id, toast]);

  // 📊 Draw Chart
  useEffect(() => {
    if (!report?.results) return;

    const ctx = chartRef.current?.getContext("2d");
    if (!ctx) return;

    const chartData = [
      (report.results?.jaccard || 0) * 100,
      (report.results?.tfidf || 0) * 100,
      (report.results?.semantic || 0) * 100,
      (report.results?.llm || 0) * 100,
    ];

    if (chartRef.current.chartInstance) {
      chartRef.current.chartInstance.destroy();
    }

    chartRef.current.chartInstance = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels: ["Jaccard", "TF-IDF", "Semantic", "LLM"],
        datasets: [
          {
            label: "Similarity (%)",
            data: chartData,
            backgroundColor: ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6"],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: (val) => `${val}%`,
              color: "#94A3B8",
            },
            grid: { color: "#475569" },
          },
          x: {
            ticks: { color: "#94A3B8" },
            grid: { display: false },
          },
        },
      },
    });
  }, [report]);

  // 🗑 Delete report
  const handleDelete = async () => {
    const ok = await modal.confirm({
      title: "Delete this report?",
      message: "This action cannot be undone.",
    });
    if (!ok) return;
    try {
      const res = await apiFetch(`/reports/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.show("Report deleted", "success");
        navigate("/reports");
      } else {
        toast.show(data.error || "Delete failed", "error");
      }
    } catch {
      toast.show("Network error while deleting report", "error");
    }
  };

  // 🧾 Download full page as PDF
  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    const pdf = new jsPDF("p", "pt", "a4");
    const input = reportRef.current;

    const canvas = await html2canvas(input, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const imgWidth = 550;
    const pageHeight = 780;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 20;

    pdf.addImage(imgData, "PNG", 30, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 30, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(
      `Report_${report.title || "Untitled"}_${new Date()
        .toISOString()
        .split("T")[0]}.pdf`
    );
  };

  if (loading)
    return (
      <div className="text-slate-500 dark:text-slate-300">
        Loading report...
      </div>
    );

  if (!report)
    return (
      <div className="text-red-600 dark:text-red-400">Report not found</div>
    );

  return (
    <div ref={reportRef} className="space-y-6 max-w-3xl mx-auto">
      <Link
        to="/reports"
        className="text-blue-600 dark:text-blue-400 underline text-sm"
      >
        ← Back to Reports
      </Link>

      {/* Header */}
      <div className="border rounded-xl p-5 bg-white dark:bg-slate-900 dark:border-slate-800">
        <h2 className="text-2xl font-semibold mb-2 dark:text-white">
          {report.title || "Untitled Report"}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Created:{" "}
          {report.created_at
            ? new Date(report.created_at).toLocaleString()
            : "Unknown"}
        </p>

        {report.tags?.length > 0 && (
          <div className="mt-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Tags:{" "}
            </span>
            {report.tags.map((t, i) => (
              <span
                key={i}
                className="inline-block bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded text-xs mr-1"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Chart Visualization */}
      <div className="border rounded-xl p-5 bg-white dark:bg-slate-900 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">
          Visual Comparison
        </h3>
        <canvas ref={chartRef} height="150"></canvas>
      </div>

      {/* Results Summary */}
      <div className="border rounded-xl p-5 bg-white dark:bg-slate-900 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">Results</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Jaccard", val: report.results?.jaccard },
            { label: "TF-IDF", val: report.results?.tfidf },
            { label: "Semantic", val: report.results?.semantic },
            { label: "LLM", val: report.results?.llm },
          ].map((r, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-center"
            >
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {r.label}
              </div>
              <div className="text-xl font-bold dark:text-white">
                {(r.val * 100).toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input Metadata */}
      <div className="border rounded-xl p-5 bg-white dark:bg-slate-900 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">
          Input Details
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>Source:</strong> {report.inputs?.source}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>Doc1:</strong> {report.inputs?.doc1_name || "-"} (
          {report.inputs?.doc1_chars || 0} chars)
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <strong>Doc2:</strong> {report.inputs?.doc2_name || "-"} (
          {report.inputs?.doc2_chars || 0} chars)
        </p>
      </div>

      {/* 🧠 Metric Explanations */}
      <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">
          Understanding the Metrics
        </h3>
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <li>
            <strong>🔹 Jaccard Similarity:</strong> Measures how many words or
            phrases are shared between two documents. Higher = more overlap in
            content.
          </li>
          <li>
            <strong>🔹 TF-IDF (Term Frequency-Inverse Document Frequency):</strong>{" "}
            Measures how similar documents are based on important terms
            (not just common words like “the”). Good for keyword-based similarity.
          </li>
          <li>
            <strong>🔹 Semantic Similarity:</strong> Uses word meanings to find
            similarity — even if words differ but mean the same thing (like “car”
            and “automobile”).
          </li>
          <li>
            <strong>🔹 LLM Embedding Similarity:</strong> Uses AI embeddings
            (like from GPT or BERT) to compare the deeper conceptual meaning of
            both documents.
          </li>
        </ul>
      </div>

      {/* Buttons */}
      <div className="flex justify-between">
        <button
          onClick={handleDownloadPDF}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          📄 Download PDF Report
        </button>

        <button
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
        >
          🗑 Delete Report
        </button>
      </div>
    </div>
  );
}
