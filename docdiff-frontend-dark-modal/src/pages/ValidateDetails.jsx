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

export default function ValidateDetails() {
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
        if (res.ok) {
          setReport(data);
        } else toast.show(data.error || "Failed to load validation report", "error");
      } catch {
        toast.show("Network error while loading validation report", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiFetch, id, toast]);

  // 📊 Draw Chart
  useEffect(() => {
    if (!report?.results?.summary) return;

    const summary = report.results.summary;
    const ctx = chartRef.current?.getContext("2d");
    if (!ctx) return;

    const chartData = [
      summary.matched || 0,
      summary.partial || 0,
      summary.missing || 0,
    ];

    if (chartRef.current.chartInstance) {
      chartRef.current.chartInstance.destroy();
    }

    chartRef.current.chartInstance = new ChartJS(ctx, {
      type: "bar",
      data: {
        labels: ["Matched", "Partial", "Missing"],
        datasets: [
          {
            label: "Tools Count",
            data: chartData,
            backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.y} tools`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: "#94A3B8" },
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

  // 🗑 Delete Report
  const handleDelete = async () => {
    const ok = await modal.confirm({
      title: "Delete this validation report?",
      message: "This action cannot be undone.",
    });
    if (!ok) return;
    try {
      const res = await apiFetch(`/reports/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.show("Validation report deleted", "success");
        navigate("/validate");
      } else toast.show(data.error || "Delete failed", "error");
    } catch {
      toast.show("Network error while deleting report", "error");
    }
  };

  // 📄 PDF Download
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
      `Validation_Report_${report.title || "Untitled"}_${new Date()
        .toISOString()
        .split("T")[0]}.pdf`
    );
  };

  if (loading)
    return (
      <div className="text-slate-500 dark:text-slate-300">
        Loading validation report...
      </div>
    );

  if (!report)
    return (
      <div className="text-red-600 dark:text-red-400">
        Validation report not found
      </div>
    );

  const summary = report.results?.summary || {};
  const embed = summary.embedding_time || {};

  return (
    <div ref={reportRef} className="space-y-6 max-w-3xl mx-auto">
      <Link
        to="/validate"
        className="text-blue-600 dark:text-blue-400 underline text-sm"
      >
        ← Back to Validation Dashboard
      </Link>

      {/* Header */}
      <div className="border rounded-xl p-5 bg-white dark:bg-slate-900 dark:border-slate-800">
        <h2 className="text-2xl font-semibold mb-2 dark:text-white">
          {report.title || "Untitled Validation Report"}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Created:{" "}
          {report.created_at
            ? new Date(report.created_at).toLocaleString()
            : "Unknown"}
        </p>
      </div>

      {/* Chart */}
      <div className="border rounded-xl p-5 bg-white dark:bg-slate-900 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">
          Validation Summary
        </h3>
        <canvas ref={chartRef} height="150"></canvas>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Total Tools
            </div>
            <div className="text-xl font-bold dark:text-white">
              {summary.total_tools || 0}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Average Similarity
            </div>
            <div className="text-xl font-bold dark:text-white">
              {((summary.average_similarity || 0) * 100).toFixed(2)}%
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
            <div className="text-sm text-slate-600 dark:text-slate-300">
              Chunks Processed
            </div>
            <div className="text-xl font-bold dark:text-white">
              {summary.chunk_count || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Embedding Time */}
      <div className="border rounded-xl p-5 bg-white dark:bg-slate-900 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">
          Embedding Performance
        </h3>
        <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
          <li>
            <strong>Total Time:</strong> {embed.total_sec || 0}s
          </li>
          <li>
            <strong>Paragraphs:</strong> {embed.paragraphs_sec || 0}s
          </li>
          <li>
            <strong>Tools:</strong> {embed.tools_sec || 0}s
          </li>
          <li>
            <strong>Average per item:</strong> {embed.avg_per_item_sec || 0}s
          </li>
        </ul>
      </div>

      {/* Explanation */}
      <div className="border rounded-xl p-5 bg-slate-50 dark:bg-slate-900 dark:border-slate-800">
        <h3 className="text-lg font-semibold mb-3 dark:text-white">
          What This Report Means
        </h3>
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <li>
            <strong>✅ Matched:</strong> Tools that were clearly found or confirmed
            in the document.
          </li>
          <li>
            <strong>🟠 Partial:</strong> Tools with partial matches or weak
            references in the document.
          </li>
          <li>
            <strong>❌ Missing:</strong> Tools that couldn’t be validated against
            the provided document.
          </li>
          <li>
            <strong>💡 Average Similarity:</strong> Overall degree of how close
            the document content matched your tools (0–100%).
          </li>
          <li>
            <strong>⚙️ Embedding Time:</strong> How long the AI took to process
            and generate embeddings.
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
          🗑 Delete Validation
        </button>
      </div>
    </div>
  );
}
