import React, { useEffect, useState } from "react";

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
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

// Auth context
import { useAuth } from "../../lib/auth";

export default function TestReports() {
  const { apiFetch } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState({});

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  // ------------------ Fetch Reports ------------------
  async function loadReports() {
    try {
      setLoading(true);
      const res = await apiFetch("/test-generator/folder/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(data.items || []);
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: "Failed to fetch reports", severity: "error" });
    } finally {
      setLoading(false);
    }
  }

  // ------------------ Refresh ZIP Link ------------------
  async function handleRefreshZip(rid) {
    setRefreshing((r) => ({ ...r, [rid]: true }));
    try {
      const res = await apiFetch(`/test-generator/folder/download/${rid}`);
      const data = await res.json();
      if (res.ok && data.download_url) {
        setToast({ open: true, message: "Refreshed signed download link", severity: "success" });
        setReports((prev) =>
          prev.map((r) => (r._id === rid ? { ...r, zip_download_url: data.download_url } : r))
        );
      } else {
        setToast({ open: true, message: "Failed to refresh link", severity: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ open: true, message: "Error refreshing download link", severity: "error" });
    } finally {
      setRefreshing((r) => ({ ...r, [rid]: false }));
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  // Get status color
  const getStatusColor = (status) => {
    if (status === "completed") return "success";
    if (status === "failed") return "error";
    return "warning";
  };

  // ------------------ Render ------------------
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3}>
          {/* Header */}
          <Grid item xs={12}>
            <MDTypography variant="h4" fontWeight="medium">
              <Icon sx={{ verticalAlign: "middle", mr: 1 }}>description</Icon>
              Test Generation Reports
            </MDTypography>
          </Grid>

          {/* Reports Table */}
          <Grid item xs={12}>
            <Card>
              <MDBox
                p={3}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                bgColor="info"
                variant="gradient"
                borderRadius="lg"
                coloredShadow="info"
                mx={2}
                mt={-3}
              >
                <MDTypography variant="h6" color="white">
                  All Reports
                </MDTypography>
              </MDBox>
              <MDBox pt={3}>
                {loading ? (
                  <MDBox p={3} textAlign="center">
                    <CircularProgress color="info" />
                    <MDTypography variant="body2" color="text" mt={2}>
                      Loading reports...
                    </MDTypography>
                  </MDBox>
                ) : reports.length === 0 ? (
                  <MDBox p={3} textAlign="center">
                    <MDTypography variant="body2" color="text">
                      No reports found yet.
                    </MDTypography>
                  </MDBox>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>
                            <MDTypography variant="caption" fontWeight="bold">
                              Created
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="caption" fontWeight="bold">
                              Status
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="caption" fontWeight="bold">
                              Exit Code
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="caption" fontWeight="bold">
                              Source
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="caption" fontWeight="bold">
                              Actions
                            </MDTypography>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {reports.map((r) => (
                          <TableRow key={r._id} hover>
                            <TableCell>
                              <MDTypography variant="body2">
                                {new Date(r.created_at).toLocaleString()}
                              </MDTypography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={r.status}
                                color={getStatusColor(r.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              <MDTypography variant="body2" color="text">
                                {r.exit_code}
                              </MDTypography>
                            </TableCell>
                            <TableCell>
                              <MDTypography variant="body2" color="text">
                                {r.source_type || "N/A"}
                              </MDTypography>
                            </TableCell>
                            <TableCell>
                              {r.zip_download_url ? (
                                <MDBox display="flex" gap={1} flexWrap="wrap">
                                  <MDButton
                                    variant="gradient"
                                    color="info"
                                    size="small"
                                    component="a"
                                    href={r.zip_download_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    <Icon sx={{ mr: 0.5, fontSize: "1rem" }}>download</Icon>
                                    Download ZIP
                                  </MDButton>
                                  <MDButton
                                    variant="gradient"
                                    color="secondary"
                                    size="small"
                                    onClick={() => handleRefreshZip(r._id)}
                                    disabled={refreshing[r._id]}
                                  >
                                    {refreshing[r._id] ? (
                                      <>
                                        <CircularProgress
                                          size={14}
                                          color="inherit"
                                          sx={{ mr: 0.5 }}
                                        />
                                        Refreshing...
                                      </>
                                    ) : (
                                      <>
                                        <Icon sx={{ mr: 0.5, fontSize: "1rem" }}>refresh</Icon>
                                        Refresh Link
                                      </>
                                    )}
                                  </MDButton>
                                </MDBox>
                              ) : (
                                <MDTypography variant="caption" color="text" fontStyle="italic">
                                  No ZIP available
                                </MDTypography>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
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
