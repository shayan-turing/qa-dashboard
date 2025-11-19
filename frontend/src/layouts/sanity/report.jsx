import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Auth context
import { useAuth } from "../../lib/auth";

export default function SanityReport() {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState(null);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  useEffect(() => {
    const loadReports = async () => {
      try {
        const res = await apiFetch("/sanity/report");
        const data = await res.json();
        if (res.ok) {
          setReports(Array.isArray(data) ? data : [data]);
        } else {
          setToast({
            open: true,
            message: data.error || "Failed to load sanity reports",
            severity: "error",
          });
        }
      } catch {
        setToast({
          open: true,
          message: "Network error loading sanity reports",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, [apiFetch]);

  const handleAccordionChange = (reportId) => (event, isExpanded) => {
    setExpandedReport(isExpanded ? reportId : null);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="text" textAlign="center">
            Loading sanity reports...
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  if (reports.length === 0) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <MDTypography variant="h6" color="text" textAlign="center">
                No sanity reports available.
              </MDTypography>
            </Grid>
          </Grid>
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
              🔍 Database Sanity Reports
            </MDTypography>
          </Grid>

          {/* Reports List */}
          {reports.map((report) => {
            const summary = report.results?.summary || {};
            const checks = report.results?.checks || [];
            const tables = report.results?.tables || {};

            return (
              <Grid item xs={12} key={report._id}>
                <Accordion
                  expanded={expandedReport === report._id}
                  onChange={handleAccordionChange(report._id)}
                >
                  <AccordionSummary expandIcon={<Icon>expand_more</Icon>}>
                    <MDBox display="flex" justifyContent="space-between" alignItems="center" width="100%">
                      <MDBox>
                        <MDTypography variant="h5" fontWeight="medium">
                          {report.title || "Untitled Report"}
                        </MDTypography>
                        <MDTypography variant="caption" color="text">
                          {report.created_at ? new Date(report.created_at).toLocaleString() : "Unknown"}
                        </MDTypography>
                      </MDBox>
                      <MDBox display="flex" alignItems="center" gap={2} mr={2}>
                        <Chip
                          label={report.status?.toUpperCase() || "UNKNOWN"}
                          color={report.status === "completed" ? "success" : "default"}
                          size="small"
                        />
                        <Chip
                          label={`Pass Rate: ${summary.pass_rate || "N/A"}`}
                          color={
                            summary.fails === 0 ? "success" : summary.fails > 0 ? "error" : "default"
                          }
                          size="small"
                        />
                      </MDBox>
                    </MDBox>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={3}>
                      {/* Summary Statistics */}
                      <Grid item xs={12}>
                        <Card sx={{ backgroundColor: "action.hover" }}>
                          <MDBox p={3}>
                            <MDTypography variant="h6" fontWeight="medium" mb={2}>
                              Summary Statistics
                            </MDTypography>
                            <Grid container spacing={2}>
                              <Grid item xs={6} md={3}>
                                <SummaryBox
                                  color="info"
                                  label="Total Checks"
                                  value={summary.total_checks || 0}
                                />
                              </Grid>
                              <Grid item xs={6} md={3}>
                                <SummaryBox
                                  color="success"
                                  label="Passed"
                                  value={summary.passes || 0}
                                />
                              </Grid>
                              <Grid item xs={6} md={3}>
                                <SummaryBox color="error" label="Failed" value={summary.fails || 0} />
                              </Grid>
                              <Grid item xs={6} md={3}>
                                <SummaryBox
                                  color="primary"
                                  label="Pass Rate"
                                  value={summary.pass_rate || "0%"}
                                />
                              </Grid>
                            </Grid>
                          </MDBox>
                        </Card>
                      </Grid>

                      {/* All Checks Table */}
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
                              All Checks ({checks.length})
                            </MDTypography>
                          </MDBox>
                          <TableContainer>
                            <Table>
                              <TableHead sx={{ backgroundColor: "action.hover" }}>
                                <TableRow>
                                  <TableCell>
                                    <MDTypography variant="caption" fontWeight="bold">
                                      Table
                                    </MDTypography>
                                  </TableCell>
                                  <TableCell>
                                    <MDTypography variant="caption" fontWeight="bold">
                                      Check
                                    </MDTypography>
                                  </TableCell>
                                  <TableCell>
                                    <MDTypography variant="caption" fontWeight="bold">
                                      Result
                                    </MDTypography>
                                  </TableCell>
                                  <TableCell>
                                    <MDTypography variant="caption" fontWeight="bold">
                                      Details
                                    </MDTypography>
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {checks.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={4} align="center">
                                      <MDTypography variant="body2" color="text">
                                        No checks available
                                      </MDTypography>
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  checks.map((check, idx) => (
                                    <TableRow key={idx} hover>
                                      <TableCell>
                                        <Chip label={check.table} size="small" variant="outlined" />
                                      </TableCell>
                                      <TableCell>
                                        <MDTypography variant="body2" color="text">
                                          {check.check}
                                        </MDTypography>
                                      </TableCell>
                                      <TableCell>
                                        <Chip
                                          icon={
                                            <Icon fontSize="small">
                                              {check.result ? "check_circle" : "cancel"}
                                            </Icon>
                                          }
                                          label={check.result ? "PASS" : "FAIL"}
                                          color={check.result ? "success" : "error"}
                                          size="small"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <MDTypography variant="caption" color="text">
                                          {check.details && check.details.length > 0
                                            ? JSON.stringify(check.details)
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

                      {/* Tables Breakdown */}
                      {Object.keys(tables).length > 0 && (
                        <Grid item xs={12}>
                          <Card>
                            <MDBox p={3}>
                              <MDTypography variant="h6" fontWeight="medium" mb={2}>
                                Checks by Table
                              </MDTypography>
                              <Grid container spacing={2}>
                                {Object.entries(tables).map(([tableName, tableData]) => (
                                  <Grid item xs={12} md={6} key={tableName}>
                                    <Card variant="outlined">
                                      <MDBox p={2}>
                                        <MDTypography variant="h6" fontWeight="medium" mb={1}>
                                          📊 {tableName}
                                        </MDTypography>
                                        <MDTypography variant="caption" color="text" mb={2} display="block">
                                          {tableData.checks?.length || 0} checks
                                        </MDTypography>
                                        {tableData.checks?.map((check, idx) => (
                                          <MDBox
                                            key={idx}
                                            display="flex"
                                            justifyContent="space-between"
                                            alignItems="center"
                                            mb={1}
                                            p={1}
                                            sx={{
                                              backgroundColor: check.result
                                                ? "rgba(76, 175, 80, 0.1)"
                                                : "rgba(244, 67, 54, 0.1)",
                                              borderRadius: 1,
                                            }}
                                          >
                                            <MDTypography variant="caption" color="text">
                                              {check.check}
                                            </MDTypography>
                                            <Icon
                                              fontSize="small"
                                              color={check.result ? "success" : "error"}
                                            >
                                              {check.result ? "check_circle" : "cancel"}
                                            </Icon>
                                          </MDBox>
                                        ))}
                                      </MDBox>
                                    </Card>
                                  </Grid>
                                ))}
                              </Grid>
                            </MDBox>
                          </Card>
                        </Grid>
                      )}

                      {/* Metadata */}
                      <Grid item xs={12}>
                        <Card sx={{ backgroundColor: "action.hover" }}>
                          <MDBox p={2}>
                            <MDTypography variant="body2" color="text">
                              <strong>Report ID:</strong> {report._id}
                            </MDTypography>
                            <MDTypography variant="body2" color="text">
                              <strong>Report Type:</strong> {report.report_type}
                            </MDTypography>
                            <MDTypography variant="body2" color="text">
                              <strong>Timestamp:</strong>{" "}
                              {report.results?.timestamp
                                ? new Date(report.results.timestamp).toLocaleString()
                                : "N/A"}
                            </MDTypography>
                          </MDBox>
                        </Card>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              </Grid>
            );
          })}
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
  const colorMap = {
    info: "#1976d2",
    success: "#66bb6a",
    error: "#ef5350",
    primary: "#fb8c00",
  };

  return (
    <Card
      sx={{
        textAlign: "center",
        p: 2,
        backgroundColor: colorMap[color],
        color: "#fff",
        borderRadius: 2,
      }}
    >
      <MDTypography variant="h3" fontWeight="bold" color="white">
        {value}
      </MDTypography>
      <MDTypography variant="caption" color="white" mt={1}>
        {label}
      </MDTypography>
    </Card>
  );
}

