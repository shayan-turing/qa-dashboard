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
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Divider from "@mui/material/Divider";

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

  // Tab state for results
  const [activeTab, setActiveTab] = useState(0);

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
          {uploadResp && uploadResp.results && (
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
                      Sanity Check Results
                    </MDTypography>
                    <Chip
                      label={`Report: ${uploadResp.report_type || "N/A"}`}
                      color="info"
                      size="small"
                    />
                  </MDBox>

                  {/* Overall Statistics */}
                  <Grid container spacing={2} mb={3}>
                    {/* FK Summary */}
                    {uploadResp.results.generic_fk_summary && (
                      <>
                        <Grid item xs={12} sm={4}>
                          <Card
                            variant="outlined"
                            sx={{
                              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                              color: "white",
                            }}
                          >
                            <MDBox p={2} textAlign="center">
                              <Icon fontSize="large">check_circle</Icon>
                              <MDTypography variant="h4" fontWeight="bold" color="white">
                                {uploadResp.results.generic_fk_summary.passes}
                              </MDTypography>
                              <MDTypography variant="body2" color="white">
                                FK Checks Passed
                              </MDTypography>
                            </MDBox>
                          </Card>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Card
                            variant="outlined"
                            sx={{
                              background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                              color: "white",
                            }}
                          >
                            <MDBox p={2} textAlign="center">
                              <Icon fontSize="large">error</Icon>
                              <MDTypography variant="h4" fontWeight="bold" color="white">
                                {uploadResp.results.generic_fk_summary.fails}
                              </MDTypography>
                              <MDTypography variant="body2" color="white">
                                FK Checks Failed
                              </MDTypography>
                            </MDBox>
                          </Card>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Card
                            variant="outlined"
                            sx={{
                              background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                              color: "white",
                            }}
                          >
                            <MDBox p={2} textAlign="center">
                              <Icon fontSize="large">list_alt</Icon>
                              <MDTypography variant="h4" fontWeight="bold" color="white">
                                {uploadResp.results.generic_fk_summary.total}
                              </MDTypography>
                              <MDTypography variant="body2" color="white">
                                Total FK Checks
                              </MDTypography>
                            </MDBox>
                          </Card>
                        </Grid>
                      </>
                    )}

                    {/* Tables Count */}
                    {uploadResp.results.tables && (
                      <Grid item xs={12} sm={4}>
                        <Card variant="outlined" sx={{ backgroundColor: "action.hover" }}>
                          <MDBox p={2} textAlign="center">
                            <Icon fontSize="large">table_chart</Icon>
                            <MDTypography variant="h4" fontWeight="bold">
                              {Object.keys(uploadResp.results.tables).length}
                            </MDTypography>
                            <MDTypography variant="body2" color="text">
                              Tables Analyzed
                            </MDTypography>
                          </MDBox>
                        </Card>
                      </Grid>
                    )}
                  </Grid>

                  {/* Tabs for different sections */}
                  <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                    <Tabs
                      value={activeTab}
                      onChange={(e, newValue) => setActiveTab(newValue)}
                      variant="scrollable"
                      scrollButtons="auto"
                    >
                      <Tab label="Enum Tables" icon={<Icon>list</Icon>} iconPosition="start" />
                      <Tab label="Relationships" icon={<Icon>hub</Icon>} iconPosition="start" />
                      <Tab
                        label="Generic Relationships"
                        icon={<Icon>account_tree</Icon>}
                        iconPosition="start"
                      />
                      <Tab label="Tables" icon={<Icon>table_chart</Icon>} iconPosition="start" />
                    </Tabs>
                  </Box>

                  {/* Tab Content */}
                  {/* Tab 0: Enum Tables */}
                  {activeTab === 0 && uploadResp.results.enum_tables && (
                    <Box>
                      {Object.entries(uploadResp.results.enum_tables).map(([tableName, checks]) => (
                        <Accordion key={tableName}>
                          <AccordionSummary expandIcon={<Icon>expand_more</Icon>}>
                            <MDBox display="flex" alignItems="center" width="100%">
                              <Chip label={tableName} color="primary" size="small" sx={{ mr: 2 }} />
                              <MDTypography variant="body2" color="text">
                                {checks.length || 0} checks
                              </MDTypography>
                              <MDBox ml="auto" mr={2}>
                                <Chip
                                  label={`${checks.filter((c) => c.result).length}/${checks.length} passed`}
                                  color={checks.every((c) => c.result) ? "success" : "warning"}
                                  size="small"
                                />
                              </MDBox>
                            </MDBox>
                          </AccordionSummary>
                          <AccordionDetails>
                            <TableContainer>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Check</TableCell>
                                    <TableCell>Result</TableCell>
                                    <TableCell>Details</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {checks.map((check, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{check.check}</TableCell>
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
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </Box>
                  )}

                  {/* Tab 1: Relationships */}
                  {activeTab === 1 && uploadResp.results.relationships && (
                    <Box>
                      {uploadResp.results.relationships.map((rel, idx) => (
                        <Accordion key={idx}>
                          <AccordionSummary expandIcon={<Icon>expand_more</Icon>}>
                            <MDBox display="flex" alignItems="center" width="100%">
                              <Icon sx={{ mr: 1 }}>link</Icon>
                              <MDTypography variant="body2" fontWeight="medium">
                                {rel.relationship}
                              </MDTypography>
                              <MDBox ml="auto" mr={2}>
                                <Chip
                                  label={rel.result ? "PASS" : "FAIL"}
                                  color={rel.result ? "success" : "error"}
                                  size="small"
                                />
                              </MDBox>
                            </MDBox>
                          </AccordionSummary>
                          <AccordionDetails>
                            <MDBox>
                              <MDTypography variant="body2" fontWeight="medium" mb={1}>
                                {rel.check}
                              </MDTypography>
                              {rel.details && (
                                <Box
                                  sx={{
                                    backgroundColor: "action.hover",
                                    p: 2,
                                    borderRadius: 1,
                                    fontFamily: "monospace",
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                                    {JSON.stringify(rel.details, null, 2)}
                                  </pre>
                                </Box>
                              )}
                            </MDBox>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </Box>
                  )}

                  {/* Tab 2: Generic Relationships */}
                  {activeTab === 2 && uploadResp.results.generic_relationships && (
                    <Box>
                      {uploadResp.results.generic_relationships.map((rel, idx) => (
                        <Accordion key={idx}>
                          <AccordionSummary expandIcon={<Icon>expand_more</Icon>}>
                            <MDBox display="flex" alignItems="center" width="100%">
                              <Icon sx={{ mr: 1 }}>device_hub</Icon>
                              <MDTypography variant="body2" fontWeight="medium">
                                {rel.relationship}
                              </MDTypography>
                              <MDBox ml="auto" mr={2}>
                                <Chip
                                  label={
                                    typeof rel.result === "boolean"
                                      ? rel.result
                                        ? "PASS"
                                        : "FAIL"
                                      : `${rel.result}`
                                  }
                                  color={
                                    typeof rel.result === "boolean"
                                      ? rel.result
                                        ? "success"
                                        : "error"
                                      : "info"
                                  }
                                  size="small"
                                />
                              </MDBox>
                            </MDBox>
                          </AccordionSummary>
                          <AccordionDetails>
                            <MDBox>
                              <MDTypography variant="body2" fontWeight="medium" mb={1}>
                                {rel.check}
                              </MDTypography>
                              {rel.kind && (
                                <Chip label={`Kind: ${rel.kind}`} size="small" sx={{ mb: 1 }} />
                              )}
                              {rel.details && (
                                <Box
                                  sx={{
                                    backgroundColor: "action.hover",
                                    p: 2,
                                    borderRadius: 1,
                                    fontFamily: "monospace",
                                    fontSize: "0.875rem",
                                    mt: 1,
                                  }}
                                >
                                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                                    {JSON.stringify(rel.details, null, 2)}
                                  </pre>
                                </Box>
                              )}
                            </MDBox>
                          </AccordionDetails>
                        </Accordion>
                      ))}
                    </Box>
                  )}

                  {/* Tab 3: Tables */}
                  {activeTab === 3 && uploadResp.results.tables && (
                    <Box>
                      <Grid container spacing={2} mb={2}>
                        {Object.entries(uploadResp.results.tables).map(([tableName, tableData]) => (
                          <Grid item xs={12} md={6} lg={4} key={tableName}>
                            <Card variant="outlined">
                              <MDBox p={2}>
                                <MDBox display="flex" alignItems="center" mb={1}>
                                  <Icon sx={{ mr: 1 }}>table_chart</Icon>
                                  <MDTypography variant="h6" fontWeight="medium">
                                    {tableName}
                                  </MDTypography>
                                </MDBox>
                                <Divider sx={{ my: 1 }} />
                                <MDTypography variant="body2" color="text" mb={1}>
                                  <strong>Row Count:</strong> {tableData.row_count || 0}
                                </MDTypography>
                                <MDTypography variant="caption" color="text" fontWeight="medium">
                                  Checks: {tableData.checks?.length || 0}
                                </MDTypography>
                                {tableData.checks && tableData.checks.length > 0 && (
                                  <Box mt={1}>
                                    {tableData.checks.map((check, idx) => (
                                      <MDBox key={idx} display="flex" alignItems="center" mt={0.5}>
                                        <Icon
                                          fontSize="small"
                                          color={check.result ? "success" : "error"}
                                          sx={{ mr: 0.5 }}
                                        >
                                          {check.result ? "check_circle" : "cancel"}
                                        </Icon>
                                        <MDTypography variant="caption" color="text">
                                          {check.check}
                                        </MDTypography>
                                      </MDBox>
                                    ))}
                                  </Box>
                                )}
                              </MDBox>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
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
