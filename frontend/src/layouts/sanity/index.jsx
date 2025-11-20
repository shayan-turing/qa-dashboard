import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Auth context
import { useAuth } from "../../lib/auth";

export default function Sanity() {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("Quick Sanity");
  const [reports, setReports] = useState([]);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadResp, setUploadResp] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Toast state
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.name.endsWith(".zip")) {
        setSelectedFile(file);
        setToast({
          open: true,
          message: `File selected: ${file.name}`,
          severity: "info",
        });
      } else {
        setToast({
          open: true,
          message: "Please select a .zip file",
          severity: "error",
        });
        event.target.value = null;
      }
    }
  };

  const handleRunSanityCheck = async (e) => {
    e.preventDefault();

    // Check if file is selected
    if (!selectedFile) {
      setToast({
        open: true,
        message: "Please select a zip file first",
        severity: "warning",
      });
      return;
    }

    setIsUploading(true);
    setUploadResp(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (title) {
        formData.append("title", title);
      }

      const res = await apiFetch("/sanity/run-upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadResp(data);
        setToast({
          open: true,
          message: "Sanity check completed successfully",
          severity: "success",
        });
        loadReports();
      } else {
        setToast({
          open: true,
          message: data.error || "Sanity check failed",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Network error during sanity check",
        severity: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const loadReports = async () => {
    try {
      const res = await apiFetch("/sanity/reports");
      const data = await res.json();
      setReports(Array.isArray(data) ? data : data.items || []);
    } catch {
      setToast({
        open: true,
        message: "Error loading reports",
        severity: "error",
      });
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3}>
          {/* Header */}
          <Grid item xs={12}>
            <MDBox
              display="flex"
              justifyContent="space-between"
              alignItems="center"
            >
              <MDTypography variant="h4" fontWeight="medium">
                <Icon sx={{ verticalAlign: "middle", mr: 1 }}>storage</Icon>
                DB Sanity
              </MDTypography>
            </MDBox>
          </Grid>

          {/* Sanity Check Form */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <Box component="form" onSubmit={handleRunSanityCheck}>
                  <MDTypography variant="h5" fontWeight="medium" mb={3}>
                    Run Sanity Check
                  </MDTypography>
                  <Grid container spacing={2}>
                    <Grid  item xs={12} lg={6}>
                      {/* Title Input */}
                      <TextField
                        fullWidth
                        label="Report Title"
                        variant="outlined"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        sx={{ mb: 3 }}
                      />
                    </Grid>
                    <Grid item xs={12} lg={6}>
                      {/* File Upload */}
                      <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        sx={{ mb: 3, justifyContent: "flex-start" }}
                      >
                        <Icon sx={{ mr: 1 }}>upload_file</Icon>
                        {selectedFile ? selectedFile.name : "Choose ZIP File"}
                        <input
                          type="file"
                          hidden
                          accept=".zip"
                          onChange={handleFileChange}
                        />
                      </Button>
                    </Grid>
                  </Grid>
                  {/* Progress Bar */}
                  {isUploading && (
                    <MDBox mb={3}>
                      <LinearProgress />
                      <MDTypography variant="caption" color="text" mt={1}>
                        Processing sanity check...
                      </MDTypography>
                    </MDBox>
                  )}

                  {/* Run Button */}
                  <MDButton
                    variant="gradient"
                    color="info"
                    type="submit"
                    disabled={isUploading}
                  >
                    <Icon sx={{ mr: 0.5 }}>play_arrow</Icon>
                    {isUploading ? "Processing..." : "Run Sanity Check"}
                  </MDButton>
                </Box>
              </MDBox>
            </Card>
          </Grid>

          {/* Upload Results Display */}
          {uploadResp && (
            <Grid item xs={12}>
              <Card>
                <MDBox p={3}>
                  <MDBox
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    mb={3}
                  >
                    <MDTypography variant="h5" fontWeight="medium">
                      Upload Results
                    </MDTypography>
                    <Chip
                      label={`Report Type: ${uploadResp.report_type || "N/A"}`}
                      color="info"
                      size="small"
                    />
                  </MDBox>

                  {/* Summary Cards */}
                  {uploadResp.results?.enum_tables &&
                    Object.keys(uploadResp.results.enum_tables).length > 0 && (
                      <Grid container spacing={2} mb={3}>
                        {Object.entries(uploadResp.results.enum_tables).map(
                          ([tableName, tableData]) => (
                            <Grid item xs={12} md={4} key={tableName}>
                              <Card
                                variant="outlined"
                                sx={{ backgroundColor: "action.hover" }}
                              >
                                <MDBox p={2} textAlign="center">
                                  <MDTypography
                                    variant="h6"
                                    fontWeight="medium"
                                  >
                                    {tableName}
                                  </MDTypography>
                                  <MDTypography variant="body2" color="text">
                                    {tableData.audit_trails?.length || 0} checks
                                  </MDTypography>
                                </MDBox>
                              </Card>
                            </Grid>
                          )
                        )}
                      </Grid>
                    )}

                  {/* Results Table */}
                  {uploadResp.results?.enum_tables && (
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
                          {Object.entries(uploadResp.results.enum_tables).map(
                            ([tableName, tableData]) =>
                              tableData.audit_trails?.map((check, idx) => (
                                <TableRow key={`${tableName}-${idx}`} hover>
                                  <TableCell>
                                    <Chip
                                      label={check.table || tableName}
                                      size="small"
                                      variant="outlined"
                                    />
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
                                          {check.result
                                            ? "check_circle"
                                            : "cancel"}
                                        </Icon>
                                      }
                                      label={check.result ? "PASS" : "FAIL"}
                                      color={check.result ? "success" : "error"}
                                      size="small"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <MDTypography
                                      variant="caption"
                                      color="text"
                                    >
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
                  )}
                </MDBox>
              </Card>
            </Grid>
          )}

          {/* Recent Reports */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Recent Reports
                </MDTypography>
                {reports.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No reports yet.
                  </MDTypography>
                ) : (
                  <Grid container spacing={2}>
                    {reports.map((r) => (
                      <Grid item xs={12} md={6} lg={4} key={r._id}>
                        <Card variant="outlined">
                          <MDBox p={2}>
                            <MDTypography
                              variant="h6"
                              fontWeight="medium"
                              mb={1}
                            >
                              {r.title}
                            </MDTypography>
                            <MDTypography variant="caption" color="text">
                              {r.created_at
                                ? new Date(r.created_at).toLocaleString()
                                : ""}
                            </MDTypography>
                          </MDBox>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
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
