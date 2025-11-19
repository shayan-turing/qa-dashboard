import React, { useState, useEffect } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
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

export default function ApiSanityChecker() {
  const { apiFetch } = useAuth();

  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [lastReport, setLastReport] = useState(null);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  // Load last report on mount
  useEffect(() => {
    loadLastReport();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.name.endsWith('.zip')) {
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

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setToast({
        open: true,
        message: "Please select a zip file first",
        severity: "warning",
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('zip_file', selectedFile);

      const res = await apiFetch("/api_sanity_check/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadResult(data);
        setToast({
          open: true,
          message: "API Sanity Check completed successfully",
          severity: "success",
        });
        loadLastReport();
      } else {
        setToast({
          open: true,
          message: data.error || "Upload failed",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Network error during upload",
        severity: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const loadLastReport = async () => {
    try {
      const res = await apiFetch("/api_sanity_check/last");
      const data = await res.json();
      if (res.ok) {
        setLastReport(data);
      }
    } catch (err) {
      console.error("Error loading last report:", err);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3}>
          {/* Header */}
          <Grid item xs={12}>
            <MDTypography variant="h4" fontWeight="medium" textAlign="center">
              <Icon sx={{ verticalAlign: "middle", mr: 1 }}>api</Icon>
              API Sanity Check
            </MDTypography>
          </Grid>

          {/* Upload Form */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <Box component="form" onSubmit={handleUpload}>
                  <MDTypography variant="h5" fontWeight="medium" mb={3}>
                    Upload ZIP File
                  </MDTypography>
                  <MDTypography variant="body2" color="text" mb={2}>
                    Upload a ZIP file containing get_set_APIs.yaml and interface folders
                  </MDTypography>

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

                  {/* Progress Bar */}
                  {isUploading && (
                    <MDBox mb={3}>
                      <LinearProgress />
                      <MDTypography variant="caption" color="text" mt={1}>
                        Processing API sanity check...
                      </MDTypography>
                    </MDBox>
                  )}

                  {/* Upload Button */}
                  <MDButton
                    variant="gradient"
                    color="info"
                    fullWidth
                    type="submit"
                    disabled={isUploading}
                  >
                    <Icon sx={{ mr: 0.5 }}>play_arrow</Icon>
                    {isUploading ? "Processing..." : "Run API Sanity Check"}
                  </MDButton>
                </Box>
              </MDBox>
            </Card>
          </Grid>

          {/* Upload Results */}
          {uploadResult && (
            <Grid item xs={12}>
              <Card>
                <MDBox p={3}>
                  <MDTypography variant="h5" fontWeight="medium" mb={3}>
                    Check Results
                  </MDTypography>
                  <MDBox
                    component="pre"
                    sx={{
                      fontSize: "0.75rem",
                      backgroundColor: "grey.100",
                      p: 2,
                      borderRadius: 2,
                      overflow: "auto",
                      fontFamily: "monospace",
                      maxHeight: "400px",
                    }}
                  >
                    {JSON.stringify(uploadResult, null, 2)}
                  </MDBox>
                </MDBox>
              </Card>
            </Grid>
          )}

          {/* Last Report */}
          {lastReport && (
            <Grid item xs={12}>
              <Card>
                <MDBox p={3}>
                  <MDTypography variant="h5" fontWeight="medium" mb={3}>
                    Last Sanity Report
                  </MDTypography>
                  <MDBox
                    component="pre"
                    sx={{
                      fontSize: "0.75rem",
                      backgroundColor: "grey.100",
                      p: 2,
                      borderRadius: 2,
                      overflow: "auto",
                      fontFamily: "monospace",
                      maxHeight: "400px",
                    }}
                  >
                    {JSON.stringify(lastReport, null, 2)}
                  </MDBox>
                </MDBox>
              </Card>
            </Grid>
          )}
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

