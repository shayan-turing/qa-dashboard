import React, { useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Chip from "@mui/material/Chip";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Auth context
import { useAuth } from "../../lib/auth";

export default function DataConsistencyChecker() {
  const { apiFetch } = useAuth();

  const [activeTab, setActiveTab] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileFields, setFileFields] = useState(null);
  const [selectedFilename, setSelectedFilename] = useState("");

  // Detect inconsistencies state
  const [file1, setFile1] = useState("");
  const [file2, setFile2] = useState("");
  const [file1Key, setFile1Key] = useState("");
  const [file2Key, setFile2Key] = useState("");
  const [sourceOfTruth, setSourceOfTruth] = useState("");
  const [inconsistencies, setInconsistencies] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Schema parsing state
  const [schemaText, setSchemaText] = useState("");
  const [parsedSchema, setParsedSchema] = useState(null);

  // Toast state
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
    setToast({
      open: true,
      message: `${files.length} file(s) selected`,
      severity: "info",
    });
  };

  const handleUploadFiles = async (e) => {
    e.preventDefault();

    if (selectedFiles.length === 0) {
      setToast({
        open: true,
        message: "Please select at least one JSON file",
        severity: "warning",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const res = await apiFetch("/data_sanity_checker/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setUploadedFiles(
          data.uploaded_files || selectedFiles.map((f) => f.name)
        );
        setToast({
          open: true,
          message: "Files uploaded successfully",
          severity: "success",
        });
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

  const handleGetFields = async () => {
    if (!selectedFilename) {
      setToast({
        open: true,
        message: "Please select a filename",
        severity: "warning",
      });
      return;
    }

    try {
      const res = await apiFetch(
        `/data_sanity_checker/get-fields/${selectedFilename}`
      );
      const data = await res.json();

      if (res.ok) {
        setFileFields(data);
        setToast({
          open: true,
          message: "Fields retrieved successfully",
          severity: "success",
        });
      } else {
        setToast({
          open: true,
          message: data.error || "Failed to get fields",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Network error",
        severity: "error",
      });
    }
  };

  const handleDetectInconsistencies = async (e) => {
    e.preventDefault();
    setIsDetecting(true);

    try {
      const body = {
        file1,
        file2,
        key_mapping: {
          file1_key: file1Key,
          file2_key: file2Key,
        },
        source_of_truth: sourceOfTruth,
        custom_field_mappings: [],
      };

      const res = await apiFetch("/data_sanity_checker/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setInconsistencies(data);
        setToast({
          open: true,
          message: "Inconsistencies detected successfully",
          severity: "success",
        });
      } else {
        setToast({
          open: true,
          message: data.error || "Detection failed",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Network error",
        severity: "error",
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleFixInconsistencies = async () => {
    if (!inconsistencies) {
      setToast({
        open: true,
        message: "Please detect inconsistencies first",
        severity: "warning",
      });
      return;
    }

    try {
      const body = {
        inconsistencies: inconsistencies.inconsistencies || [],
        source_of_truth: sourceOfTruth,
      };

      const res = await apiFetch("/data_sanity_checker/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setToast({
          open: true,
          message: "Inconsistencies fixed successfully",
          severity: "success",
        });
      } else {
        setToast({
          open: true,
          message: data.error || "Fix failed",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Network error",
        severity: "error",
      });
    }
  };

  const handleParseSchema = async (e) => {
    e.preventDefault();

    try {
      const res = await apiFetch("/data_sanity_checker/parse-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema_text: schemaText }),
      });

      const data = await res.json();

      if (res.ok) {
        setParsedSchema(data);
        setToast({
          open: true,
          message: "Schema parsed successfully",
          severity: "success",
        });
      } else {
        setToast({
          open: true,
          message: data.error || "Parsing failed",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Network error",
        severity: "error",
      });
    }
  };

  const handleClearSession = async () => {
    try {
      const res = await apiFetch("/data_sanity_checker/clear-session", {
        method: "POST",
      });

      if (res.ok) {
        setUploadedFiles([]);
        setFileFields(null);
        setInconsistencies(null);
        setParsedSchema(null);
        setToast({
          open: true,
          message: "Session cleared successfully",
          severity: "success",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: "Failed to clear session",
        severity: "error",
      });
    }
  };

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
                <Icon sx={{ verticalAlign: "middle", mr: 1 }}>fact_check</Icon>
                Data Consistency Checker
              </MDTypography>
            </MDBox>
          </Grid>

          {/* Tabs */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <Tabs
                  value={activeTab}
                  onChange={(e, newValue) => setActiveTab(newValue)}
                >
                  <Tab
                    label="Upload Files"
                    icon={<Icon>upload</Icon>}
                    iconPosition="start"
                  />
                  <Tab
                    label="Detect Issues"
                    icon={<Icon>search</Icon>}
                    iconPosition="start"
                  />
                  <Tab
                    label="Parse Schema"
                    icon={<Icon>schema</Icon>}
                    iconPosition="start"
                  />
                </Tabs>
              </MDBox>
            </Card>
          </Grid>

          {/* Tab 0: Upload Files */}
          {activeTab === 0 && (
            <>
              <Grid item xs={12}>
                <Card>
                  <MDBox p={3}>
                    <Box component="form" onSubmit={handleUploadFiles}>
                      <Grid xs={12} lg={6}>
                        <MDTypography variant="h5" fontWeight="medium" mb={3}>
                          Upload JSON Files
                        </MDTypography>

                        <Button
                          variant="outlined"
                          component="label"
                          fullWidth
                          sx={{ mb: 3, justifyContent: "flex-start" }}
                        >
                          <Icon sx={{ mr: 1 }}>upload_file</Icon>
                          {selectedFiles.length > 0
                            ? `${selectedFiles.length} file(s) selected`
                            : "Choose JSON Files"}
                          <input
                            type="file"
                            hidden
                            accept=".json"
                            multiple
                            onChange={handleFileChange}
                          />
                        </Button>
                      </Grid>

                      {isUploading && (
                        <MDBox mb={3}>
                          <LinearProgress />
                        </MDBox>
                      )}

                      <MDButton
                        variant="gradient"
                        color="info"
                        type="submit"
                        disabled={isUploading}
                      >
                        <Icon sx={{ mr: 0.5 }}>cloud_upload</Icon>
                        Upload Files
                      </MDButton>
                    </Box>

                    {uploadedFiles.length > 0 && (
                      <MDBox mt={3}>
                        <MDTypography variant="h6" mb={2}>
                          Uploaded Files:
                        </MDTypography>
                        <MDBox display="flex" flexWrap="wrap" gap={1}>
                          {uploadedFiles.map((filename, idx) => (
                            <Chip
                              key={idx}
                              label={filename}
                              color="success"
                              size="small"
                            />
                          ))}
                        </MDBox>
                      </MDBox>
                    )}
                  </MDBox>
                </Card>
              </Grid>

              {/* Get Fields Section */}
              <Grid item xs={12}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h5" fontWeight="medium" mb={3}>
                      Get File Fields
                    </MDTypography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={8}>
                        <FormControl fullWidth>
                          <InputLabel>Select File</InputLabel>
                          <Select
                            value={selectedFilename}
                            label="Select File"
                            onChange={(e) =>
                              setSelectedFilename(e.target.value)
                            }
                            sx={{ height: 45 }}
                          >
                            {uploadedFiles.map((filename, idx) => (
                              <MenuItem key={idx} value={filename}>
                                {filename}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <MDButton
                          variant="gradient"
                          color="info"
                          onClick={handleGetFields}
                          sx={{ height: "100%" }}
                        >
                          Get Fields
                        </MDButton>
                      </Grid>
                    </Grid>

                    {fileFields && (
                      <MDBox mt={3}>
                        <MDBox
                          component="pre"
                          sx={{
                            fontSize: "0.75rem",
                            backgroundColor: "grey.100",
                            p: 2,
                            borderRadius: 2,
                            overflow: "auto",
                            fontFamily: "monospace",
                            maxHeight: "300px",
                          }}
                        >
                          {JSON.stringify(fileFields, null, 2)}
                        </MDBox>
                      </MDBox>
                    )}
                  </MDBox>
                </Card>
              </Grid>
            </>
          )}

          {/* Tab 1: Detect Issues */}
          {activeTab === 1 && (
            <>
              <Grid item xs={12}>
                <Card>
                  <MDBox p={3}>
                    <Box
                      component="form"
                      onSubmit={handleDetectInconsistencies}
                    >
                      <MDTypography variant="h5" fontWeight="medium" mb={3}>
                        Detect Inconsistencies
                      </MDTypography>

                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>File 1</InputLabel>
                            <Select
                              value={file1}
                              label="File 1"
                              onChange={(e) => setFile1(e.target.value)}
                              sx={{ height: 45 }}
                            >
                              {uploadedFiles.map((filename, idx) => (
                                <MenuItem key={idx} value={filename}>
                                  {filename}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>File 2</InputLabel>
                            <Select
                              value={file2}
                              label="File 2"
                              onChange={(e) => setFile2(e.target.value)}
                              sx={{ height: 45 }}
                            >
                              {uploadedFiles.map((filename, idx) => (
                                <MenuItem key={idx} value={filename}>
                                  {filename}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="File 1 Key Field"
                            value={file1Key}
                            onChange={(e) => setFile1Key(e.target.value)}
                            sx={{ mb: 2 }}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="File 2 Key Field"
                            value={file2Key}
                            onChange={(e) => setFile2Key(e.target.value)}
                            sx={{ mb: 2 }}
                          />
                        </Grid>
                        <Grid item xs={12} lg={6}>
                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Source of Truth</InputLabel>
                            <Select
                              value={sourceOfTruth}
                              label="Source of Truth"
                              onChange={(e) => setSourceOfTruth(e.target.value)}
                              sx={{ height: 45 }}
                            >
                              {uploadedFiles.map((filename, idx) => (
                                <MenuItem key={idx} value={filename}>
                                  {filename}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      </Grid>

                      {isDetecting && (
                        <MDBox mb={3}>
                          <LinearProgress />
                        </MDBox>
                      )}

                      <MDButton
                        variant="gradient"
                        color="info"
                        type="submit"
                        disabled={isDetecting}
                      >
                        <Icon sx={{ mr: 0.5 }}>search</Icon>
                        Detect Inconsistencies
                      </MDButton>
                    </Box>

                    {inconsistencies && (
                      <MDBox mt={3}>
                        <MDTypography variant="h6" mb={2}>
                          Detection Results:
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
                          {JSON.stringify(inconsistencies, null, 2)}
                        </MDBox>
                        <MDButton
                          variant="gradient"
                          color="success"
                          fullWidth
                          onClick={handleFixInconsistencies}
                          sx={{ mt: 2 }}
                        >
                          <Icon sx={{ mr: 0.5 }}>build</Icon>
                          Fix Inconsistencies
                        </MDButton>
                      </MDBox>
                    )}
                  </MDBox>
                </Card>
              </Grid>
            </>
          )}

          {/* Tab 2: Parse Schema */}
          {activeTab === 2 && (
            <Grid item xs={12}>
              <Card>
                <MDBox p={3}>
                  <Box component="form" onSubmit={handleParseSchema}>
                    <MDTypography variant="h5" fontWeight="medium" mb={3}>
                      Parse Database Schema
                    </MDTypography>

                    <TextField
                      fullWidth
                      label="Database Schema (DBML format)"
                      multiline
                      rows={10}
                      value={schemaText}
                      onChange={(e) => setSchemaText(e.target.value)}
                      placeholder="Table users&#10;  id int primary key&#10;  name varchar&#10;&#10;Table orders&#10;  id int primary key&#10;  user_id int ref: > users.id"
                      sx={{ mb: 3 }}
                    />

                    <MDButton
                      variant="gradient"
                      color="info"
                      type="submit"
                    >
                      <Icon sx={{ mr: 0.5 }}>schema</Icon>
                      Parse Schema
                    </MDButton>
                  </Box>

                  {parsedSchema && (
                    <MDBox mt={3}>
                      <MDTypography variant="h6" mb={2}>
                        Parsed Schema:
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
                        {JSON.stringify(parsedSchema, null, 2)}
                      </MDBox>
                    </MDBox>
                  )}
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
