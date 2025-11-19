import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
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

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Auth context
import { useAuth } from "../../lib/auth";

export default function SanitySummary() {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const res = await apiFetch("/sanity/summary");
        const data = await res.json();
        if (res.ok) {
          setSummary(data);
        } else {
          setToast({
            open: true,
            message: data.error || "Failed to load sanity summary",
            severity: "error",
          });
        }
      } catch {
        setToast({
          open: true,
          message: "Network error loading sanity summary",
          severity: "error",
        });
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
            Loading sanity summary...
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
            No sanity summary available.
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
          {/* Title */}
          <Grid item xs={12}>
            <MDTypography variant="h3" fontWeight="medium" textAlign="center" color="info" mb={3}>
              📊 Sanity Check Summary
            </MDTypography>
          </Grid>

          {/* Summary boxes */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <SummaryBox
                  color="purple"
                  label="Total Reports"
                  value={summary.total_reports || 0}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <SummaryBox color="green" label="Passed" value={summary.passed || 0} />
              </Grid>
              <Grid item xs={6} md={3}>
                <SummaryBox color="red" label="Failed" value={summary.failed || 0} />
              </Grid>
              <Grid item xs={6} md={3}>
                <SummaryBox color="orange" label="Pass Rate" value={summary.pass_rate || "0%"} />
              </Grid>
            </Grid>
          </Grid>

          {/* Legend */}
          <Grid item xs={12}>
            <MDBox display="flex" justifyContent="center" alignItems="center" gap={3} mt={2}>
              <Legend color="#66bb6a" label="Passed" />
              <Legend color="#ef5350" label="Failed" />
            </MDBox>
          </Grid>

          {/* Recent Reports Table */}
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
                  Recent Sanity Reports
                </MDTypography>
              </MDBox>
              <TableContainer>
                <Table>
                  <TableHead sx={{ backgroundColor: "action.hover" }}>
                    <TableRow>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Title
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Total Checks
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Passed
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Failed
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Pass Rate
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
                    {!summary.recent_reports || summary.recent_reports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <MDTypography variant="body2" color="text">
                            No recent reports available.
                          </MDTypography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      summary.recent_reports.map((report) => (
                        <TableRow
                          key={report.id}
                          hover
                          sx={{
                            cursor: "pointer",
                            transition: "background-color 0.2s",
                          }}
                          onClick={() => navigate("/sanity/report")}
                        >
                          <TableCell>
                            <MDTypography variant="body2" color="text" fontWeight="medium">
                              {report.title || "Untitled Report"}
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="body2" color="text">
                              {report.summary?.total_checks || 0}
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={report.summary?.passes || 0}
                              color="success"
                              size="small"
                              sx={{ minWidth: 50 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={report.summary?.fails || 0}
                              color={report.summary?.fails > 0 ? "error" : "default"}
                              size="small"
                              sx={{ minWidth: 50 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={report.summary?.pass_rate || "0%"}
                              color={
                                report.summary?.fails === 0
                                  ? "success"
                                  : report.summary?.fails > 0
                                  ? "error"
                                  : "default"
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="caption" color="text">
                              {report.created_at
                                ? new Date(report.created_at).toLocaleString()
                                : "—"}
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

          {/* Info Box */}
          <Grid item xs={12}>
            <Card sx={{ backgroundColor: "action.hover" }}>
              <MDBox p={2}>
                <MDTypography variant="h6" fontWeight="medium" mb={1}>
                  ℹ️ About Sanity Checks
                </MDTypography>
                <MDTypography variant="body2" color="text">
                  Database sanity checks verify data integrity, consistency, and adherence to
                  defined rules. Each report contains multiple checks across different tables to
                  ensure your database is healthy and reliable.
                </MDTypography>
              </MDBox>
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

