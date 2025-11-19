import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

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

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Auth context
import { useAuth } from "../../lib/auth";

export default function TaskResults() {
  const { id } = useParams(); // task_id
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await apiFetch(`/tasks/${id}/results`);
        const json = await res.json();
        if (res.ok) {
          setData(json);
        } else {
          setToast({ open: true, message: json.error || "Failed to load results", severity: "error" });
        }
      } catch {
        setToast({ open: true, message: "Network error while loading results", severity: "error" });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [apiFetch, id]);

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="text" textAlign="center">
            Loading results...
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  if (!data || !data.results) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="error" textAlign="center">
            No results found for this task.
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  const summary = data.summary || { total_runs: 0, passed: 0, failed: 0, pass_rate: "0%" };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3} justifyContent="center">
          {/* Back Link */}
          <Grid item xs={12} lg={11}>
            <MDButton variant="text" color="info" onClick={() => navigate("/tasks")} sx={{ mb: 2 }}>
              <Icon sx={{ mr: 1 }}>arrow_back</Icon>
              Back to Tasks
            </MDButton>
          </Grid>

          {/* Title */}
          <Grid item xs={12} lg={11}>
            <MDTypography variant="h3" fontWeight="medium" textAlign="center" color="info" mb={3}>
              📋 Task Results Summary
            </MDTypography>
          </Grid>

          {/* Summary Stats */}
          <Grid item xs={12} lg={11}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <SummaryBox color="purple" label="Total Runs" value={summary.total_runs} />
              </Grid>
              <Grid item xs={6} md={3}>
                <SummaryBox color="green" label="Passed" value={summary.passed} />
              </Grid>
              <Grid item xs={6} md={3}>
                <SummaryBox color="red" label="Failed" value={summary.failed} />
              </Grid>
              <Grid item xs={6} md={3}>
                <SummaryBox color="orange" label="Pass Rate" value={summary.pass_rate} />
              </Grid>
            </Grid>
          </Grid>

          {/* Table of Results */}
          <Grid item xs={12} lg={11}>
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
                  Recent Runs
                </MDTypography>
              </MDBox>
              <TableContainer>
                <Table>
                  <TableHead sx={{ backgroundColor: "action.hover" }}>
                    <TableRow>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Run ID
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Status
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Error
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
                    {data.results.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <MDTypography variant="body2" color="text">
                            No runs yet for this task.
                          </MDTypography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.results.map((r, i) => (
                        <TableRow key={i} hover>
                          <TableCell>
                            <MDTypography variant="caption" color="text">
                              {r._id}
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={r.status?.toUpperCase()}
                              color={r.status === "passed" ? "success" : "error"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="caption" color="text">
                              {r.error ? r.error.slice(0, 60) + "..." : "—"}
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="caption" color="text">
                              {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                            </MDTypography>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
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

/* Summary Box Component */
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

