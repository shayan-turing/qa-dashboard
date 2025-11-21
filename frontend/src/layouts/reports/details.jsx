import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Chip from "@mui/material/Chip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Box from "@mui/material/Box";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

// Chart.js
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

// PDF libraries
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Auth context
import { useAuth } from "../../lib/auth";

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

export default function ReportDetails() {
  const { id } = useParams();
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const reportRef = useRef(null);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 📥 Load report details
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/reports/${id}`);
        const data = await res.json();
        if (res.ok) {
          setReport(data);
        } else {
          setToast({
            open: true,
            message: data.error || "Failed to load report",
            severity: "error",
          });
        }
      } catch (err) {
        setToast({
          open: true,
          message: "Network error while loading report",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiFetch, id]);

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
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/reports/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setToast({ open: true, message: "Report deleted", severity: "success" });
        setTimeout(() => navigate("/reports"), 1000);
      } else {
        setToast({
          open: true,
          message: data.error || "Delete failed",
          severity: "error",
        });
      }
    } catch {
      setToast({
        open: true,
        message: "Network error while deleting report",
        severity: "error",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialog(false);
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

    pdf.save(`Report_${report.title || "Untitled"}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="text">
            Loading report...
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3} class="mb-0">
          <MDTypography variant="h6" color="error">
            Report not found
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3} ref={reportRef}>
        <Grid container spacing={3} justifyContent="center">
          {/* Back Button */}
          <Grid item xs={12} lg={10}>
            <MDButton
              variant="text"
              color="info"
              onClick={() => navigate("/reports")}
              sx={{ mb: 2 }}
            >
              <Icon sx={{ mr: 1 }}>arrow_back</Icon>
              Back to Reports
            </MDButton>
          </Grid>

          {/* Header Card */}
          <Grid item xs={12} lg={10}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h4" fontWeight="medium" mb={1}>
                  {report.title || "Untitled Report"}
                </MDTypography>
                <MDTypography variant="caption" color="text" display="block" mb={2}>
                  Created:{" "}
                  {report.created_at ? new Date(report.created_at).toLocaleString() : "Unknown"}
                </MDTypography>

                {report.tags?.length > 0 && (
                  <MDBox>
                    <MDTypography variant="caption" color="text" mr={1}>
                      Tags:
                    </MDTypography>
                    {report.tags.map((t, i) => (
                      <Chip key={i} label={t} size="small" color="info" sx={{ mr: 0.5, mb: 0.5 }} />
                    ))}
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>

          {/* Chart Visualization */}
          <Grid item xs={12} lg={10}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Visual Comparison
                </MDTypography>
                <Box sx={{ position: "relative", height: 300 }}>
                  <canvas ref={chartRef} height="150"></canvas>
                </Box>
              </MDBox>
            </Card>
          </Grid>

          {/* Results Summary */}
          <Grid item xs={12} lg={10}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Results
                </MDTypography>
                <Grid container spacing={2}>
                  {[
                    { label: "Jaccard", val: report.results?.jaccard, color: "#10B981" },
                    { label: "TF-IDF", val: report.results?.tfidf, color: "#3B82F6" },
                    { label: "Semantic", val: report.results?.semantic, color: "#F59E0B" },
                    { label: "LLM", val: report.results?.llm, color: "#8B5CF6" },
                  ].map((r, i) => (
                    <Grid item xs={6} md={3} key={i}>
                      <Card
                        variant="outlined"
                        sx={{
                          textAlign: "center",
                          p: 2,
                          backgroundColor: "background.paper",
                        }}
                      >
                        <MDTypography variant="caption" color="text">
                          {r.label}
                        </MDTypography>
                        <MDTypography variant="h4" fontWeight="bold" sx={{ color: r.color }}>
                          {((r.val || 0) * 100).toFixed(2)}%
                        </MDTypography>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          {/* Input Metadata */}
          <Grid item xs={12} lg={10}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={2}>
                  Input Details
                </MDTypography>
                <MDBox>
                  <MDTypography variant="body2" color="text" mb={1}>
                    <strong>Source:</strong> {report.inputs?.source || "-"}
                  </MDTypography>
                  <MDTypography variant="body2" color="text" mb={1}>
                    <strong>Doc1:</strong> {report.inputs?.doc1_name || "-"} (
                    {report.inputs?.doc1_chars || 0} chars)
                  </MDTypography>
                  <MDTypography variant="body2" color="text">
                    <strong>Doc2:</strong> {report.inputs?.doc2_name || "-"} (
                    {report.inputs?.doc2_chars || 0} chars)
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          {/* Metric Explanations */}
          <Grid item xs={12} lg={10}>
            <Card sx={{ backgroundColor: "action.hover" }}>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={2}>
                  Understanding the Metrics
                </MDTypography>
                <MDBox component="ul" sx={{ pl: 2, "& li": { mb: 1.5 } }}>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong> Jaccard Similarity:</strong> Measures how many words or phrases are
                      shared between two documents. Higher = more overlap in content.
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong> TF-IDF (Term Frequency-Inverse Document Frequency):</strong>{" "}
                      Measures how similar documents are based on important terms (not just common
                      words like &quot;the&quot;). Good for keyword-based similarity.
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong> Semantic Similarity:</strong> Uses word meanings to find similarity
                      — even if words differ but mean the same thing (like &quot;car&quot; and
                      &quot;automobile&quot;).
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong> LLM Embedding Similarity:</strong> Uses AI embeddings (like from
                      GPT or BERT) to compare the deeper conceptual meaning of both documents.
                    </MDTypography>
                  </li>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          {/* Action Buttons */}
          <Grid item xs={12} lg={10}>
            <MDBox display="flex" justifyContent="space-between" gap={2}>
              <MDButton
                variant="gradient"
                color="info"
                onClick={handleDownloadPDF}
                startIcon={<Icon>picture_as_pdf</Icon>}
              >
                Download PDF Report
              </MDButton>

              <MDButton
                variant="gradient"
                color="error"
                onClick={() => setDeleteDialog(true)}
                startIcon={<Icon>delete</Icon>}
              >
                Delete Report
              </MDButton>
            </MDBox>
          </Grid>
        </Grid>
      </MDBox>

      {/* Toast Notification */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast({ ...toast, open: false })}
          severity={toast.severity}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog}
        onClose={() => !isDeleting && setDeleteDialog(false)}
      >
        <DialogTitle color="primary">Delete Report</DialogTitle>
        <DialogContent>
          <MDTypography variant="h5" color="primary">
            Are you sure you want to delete this API Sanity report? This action
            cannot be undone.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton
            onClick={() => setDeleteDialog(false)}
            disabled={isDeleting}
          >
            Cancel
          </MDButton>
          <MDButton color="error" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
