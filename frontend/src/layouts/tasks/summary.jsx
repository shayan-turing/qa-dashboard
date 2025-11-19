import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Box from "@mui/material/Box";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Auth context
import { useAuth } from "../../lib/auth";

export default function ResultsSummary() {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const res = await apiFetch("/tasks/summary");
        const data = await res.json();
        if (res.ok) {
          setSummary(data);
        } else {
          setToast({ open: true, message: data.error || "Failed to load summary", severity: "error" });
        }
      } catch {
        setToast({ open: true, message: "Network error loading summary", severity: "error" });
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, [apiFetch]);

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="text" textAlign="center">
            Loading summary...
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  if (!summary) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="error" textAlign="center">
            No summary available.
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3}>
          {/* Back link */}
          <Grid item xs={12}>
            <MDButton variant="text" color="info" onClick={() => navigate("/tasks")} sx={{ mb: 2 }}>
              <Icon sx={{ mr: 1 }}>arrow_back</Icon>
              Back to Tasks
            </MDButton>
          </Grid>

          {/* Title */}
          <Grid item xs={12}>
            <MDTypography variant="h3" fontWeight="medium" textAlign="center" color="info" mb={3}>
              📊 Test Run Summary
            </MDTypography>
          </Grid>

          {/* Summary boxes */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={2.4}>
                <SummaryBox color="purple" label="Total Tasks" value={summary.total_tasks} />
              </Grid>
              <Grid item xs={6} md={2.4}>
                <SummaryBox color="green" label="Passed" value={summary.passed} />
              </Grid>
              <Grid item xs={6} md={2.4}>
                <SummaryBox color="red" label="Failed" value={summary.failed} />
              </Grid>
              <Grid item xs={6} md={2.4}>
                <SummaryBox color="yellow" label="Not Run" value={summary.not_run} />
              </Grid>
              <Grid item xs={12} md={2.4}>
                <SummaryBox color="orange" label="Pass Rate" value={summary.pass_rate} />
              </Grid>
            </Grid>
          </Grid>

          {/* Legend */}
          <Grid item xs={12}>
            <MDBox display="flex" justifyContent="center" alignItems="center" gap={3} mt={2}>
              <Legend color="#66bb6a" label="Passed" />
              <Legend color="#ef5350" label="Failed" />
              <Legend color="#fdd835" label="Not Run" />
            </MDBox>
          </Grid>

          {/* Results Table */}
          <Grid item xs={12}>
            <Card>
              <MDBox
                sx={{
                  backgroundColor: "#1976d2",
                  color: "#fff",
                  px: 2,
                  py: 1.5,
                }}
              >
                <MDTypography variant="h6" color="white" fontWeight="medium">
                  Test Results
                </MDTypography>
              </MDBox>
              <TableContainer>
                <Table>
                  <TableHead sx={{ backgroundColor: "action.hover" }}>
                    <TableRow>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Task
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Status
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Created
                        </MDTypography>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {summary.recent_runs.map((r) => (
                      <TableRow
                        key={r.id}
                        onClick={() => r.task_id && navigate(`/tasks/${r.task_id}/results`)}
                        hover
                        sx={{
                          cursor: "pointer",
                          transition: "background-color 0.2s",
                        }}
                      >
                        <TableCell>
                          <MDTypography variant="body2" color="text">
                            {r.title || r.id}
                          </MDTypography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={r.status === "not_run" ? "NOT RUN" : r.status.toUpperCase()}
                            color={
                              r.status === "passed"
                                ? "success"
                                : r.status === "failed"
                                ? "error"
                                : "warning"
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <MDTypography variant="body2" color="text">
                            {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                          </MDTypography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
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
    </DashboardLayout>
  );
}

/* Reusable Summary Box */
function SummaryBox({ color, label, value }) {
  const colors = {
    purple: {
      background: "linear-gradient(195deg, #7b1fa2, #6a1b9a)",
      color: "#fff",
    },
    green: {
      background: "linear-gradient(195deg, #66bb6a, #43a047)",
      color: "#fff",
    },
    red: {
      background: "linear-gradient(195deg, #ef5350, #e53935)",
      color: "#fff",
    },
    yellow: {
      background: "linear-gradient(195deg, #fdd835, #f9a825)",
      color: "#fff",
    },
    orange: {
      background: "linear-gradient(195deg, #fb8c00, #f57c00)",
      color: "#fff",
    },
  };

  return (
    <Card
      sx={{
        background: colors[color].background,
        color: colors[color].color,
        textAlign: "center",
        p: 3,
        borderRadius: 2,
      }}
    >
      <MDTypography variant="h2" fontWeight="bold" color="white">
        {value}
      </MDTypography>
      <MDTypography variant="body2" color="white" mt={1}>
        {label}
      </MDTypography>
    </Card>
  );
}

/* Legend Component */
function Legend({ color, label }) {
  return (
    <Box display="flex" alignItems="center" gap={1}>
      <Box
        sx={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      <MDTypography variant="body2" color="text">
        {label}
      </MDTypography>
    </Box>
  );
}

