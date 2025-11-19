import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

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

export default function ValidateDetails() {
  const { id } = useParams();
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef(null);
  const reportRef = useRef(null);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  // Modal state
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

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
            message: data.error || "Failed to load validation report",
            severity: "error",
          });
        }
      } catch {
        setToast({
          open: true,
          message: "Network error while loading validation report",
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
    if (!report?.results?.summary) return;

    const summary = report.results.summary;
    const ctx = chartRef.current?.getContext("2d");
    if (!ctx) return;

    const chartData = [summary.matched || 0, summary.partial || 0, summary.missing || 0];

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
    setConfirmDialog({ open: false });
    try {
      const res = await apiFetch(`/reports/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setToast({ open: true, message: "Validation report deleted", severity: "success" });
        setTimeout(() => navigate("/validate"), 1000);
      } else {
        setToast({ open: true, message: data.error || "Delete failed", severity: "error" });
      }
    } catch {
      setToast({
        open: true,
        message: "Network error while deleting report",
        severity: "error",
      });
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
      `Validation_Report_${report.title || "Untitled"}_${
        new Date().toISOString().split("T")[0]
      }.pdf`
    );
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="text">
            Loading validation report...
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  if (!report) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="error">
            Validation report not found
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  const summary = report.results?.summary || {};
  const embed = summary.embedding_time || {};

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
              onClick={() => navigate("/validate")}
              sx={{ mb: 2 }}
            >
              <Icon sx={{ mr: 1 }}>arrow_back</Icon>
              Back to Validation Dashboard
            </MDButton>
          </Grid>

          {/* Header Card */}
          <Grid item xs={12} lg={10}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h4" fontWeight="medium" mb={1}>
                  {report.title || "Untitled Validation Report"}
                </MDTypography>
                <MDTypography variant="caption" color="text" display="block">
                  Created:{" "}
                  {report.created_at ? new Date(report.created_at).toLocaleString() : "Unknown"}
                </MDTypography>
              </MDBox>
            </Card>
          </Grid>

          {/* Chart & Summary Stats */}
          <Grid item xs={12} lg={10}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Validation Summary
                </MDTypography>
                <Box sx={{ position: "relative", height: 300, mb: 3 }}>
                  <canvas ref={chartRef} height="150"></canvas>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Card
                      variant="outlined"
                      sx={{ textAlign: "center", p: 2, backgroundColor: "action.hover" }}
                    >
                      <MDTypography variant="caption" color="text">
                        Total Tools
                      </MDTypography>
                      <MDTypography variant="h4" fontWeight="bold" color="dark">
                        {summary.total_tools || 0}
                      </MDTypography>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card
                      variant="outlined"
                      sx={{ textAlign: "center", p: 2, backgroundColor: "action.hover" }}
                    >
                      <MDTypography variant="caption" color="text">
                        Average Similarity
                      </MDTypography>
                      <MDTypography variant="h4" fontWeight="bold" color="dark">
                        {((summary.average_similarity || 0) * 100).toFixed(2)}%
                      </MDTypography>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Card
                      variant="outlined"
                      sx={{ textAlign: "center", p: 2, backgroundColor: "action.hover" }}
                    >
                      <MDTypography variant="caption" color="text">
                        Chunks Processed
                      </MDTypography>
                      <MDTypography variant="h4" fontWeight="bold" color="dark">
                        {summary.chunk_count || 0}
                      </MDTypography>
                    </Card>
                  </Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          {/* Embedding Performance */}
          <Grid item xs={12} lg={10}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={2}>
                  Embedding Performance
                </MDTypography>
                <MDBox component="ul" sx={{ pl: 2, "& li": { mb: 1 } }}>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong>Total Time:</strong> {embed.total_sec || 0}s
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong>Paragraphs:</strong> {embed.paragraphs_sec || 0}s
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong>Tools:</strong> {embed.tools_sec || 0}s
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong>Average per item:</strong> {embed.avg_per_item_sec || 0}s
                    </MDTypography>
                  </li>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          {/* Explanation */}
          <Grid item xs={12} lg={10}>
            <Card sx={{ backgroundColor: "action.hover" }}>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={2}>
                  What This Report Means
                </MDTypography>
                <MDBox component="ul" sx={{ pl: 2, "& li": { mb: 1.5 } }}>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong>✅ Matched:</strong> Tools that were clearly found or confirmed in the
                      document.
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong>🟠 Partial:</strong> Tools with partial matches or weak references in
                      the document.
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong>❌ Missing:</strong> Tools that couldn&apos;t be validated against the
                      provided document.
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong>💡 Average Similarity:</strong> Overall degree of how close the
                      document content matched your tools (0–100%).
                    </MDTypography>
                  </li>
                  <li>
                    <MDTypography variant="body2" color="text">
                      <strong>⚙️ Embedding Time:</strong> How long the AI took to process and
                      generate embeddings.
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
                onClick={() => setConfirmDialog({ open: true })}
                startIcon={<Icon>delete</Icon>}
              >
                Delete Validation
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

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false })}>
        <DialogTitle>Delete this validation report?</DialogTitle>
        <DialogContent>
          <DialogContentText>This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false })}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
