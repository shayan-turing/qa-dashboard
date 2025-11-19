import React, { useEffect, useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
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

export default function Sanity() {
  const { apiFetch } = useAuth();

  const [title, setTitle] = useState("Quick Sanity");
  const [enumsYaml, setEnumsYaml] = useState("enums:\n  funds:\n    status: ['active','closed']\n");
  const [tablesJson, setTablesJson] = useState(`{
  "funds": {"1": {"fund_id": "1", "status": "active"}},
  "investors": {"101": {"investor_id": "101", "status": "closed"}}
}`);
  const [resp, setResp] = useState(null);
  const [reports, setReports] = useState([]);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  const run = async (e) => {
    e.preventDefault();
    try {
      const data_json_dict = JSON.parse(tablesJson);
      const res = await apiFetch("/sanity/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, enum_yaml_str: enumsYaml, data_json_dict }),
      });
      const data = await res.json();
      setResp(data);
      if (res.ok) {
        setToast({ open: true, message: "Sanity check completed", severity: "success" });
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
        message: err.message || "Invalid JSON format",
        severity: "error",
      });
    }
  };

  const loadReports = async () => {
    try {
      const res = await apiFetch("/sanity/reports");
      const data = await res.json();
      setReports(Array.isArray(data) ? data : data.items || []);
    } catch {
      setToast({ open: true, message: "Error loading reports", severity: "error" });
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
            <MDTypography variant="h4" fontWeight="medium">
              <Icon sx={{ verticalAlign: "middle", mr: 1 }}>storage</Icon>
              DB Sanity
            </MDTypography>
          </Grid>

          {/* Sanity Check Form */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Run Sanity Check
                </MDTypography>
                <Box component="form" onSubmit={run}>
                  <Grid container spacing={2}>
                    {/* Title Input */}
                    <Grid item xs={12} md={8}>
                      <TextField
                        fullWidth
                        label="Report Title"
                        variant="outlined"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </Grid>

                    {/* Run Button */}
                    <Grid item xs={12} md={4}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        fullWidth
                        type="submit"
                        sx={{ height: "100%" }}
                      >
                        <Icon sx={{ mr: 0.5 }}>play_arrow</Icon>
                        Run Sanity Check
                      </MDButton>
                    </Grid>

                    {/* Enums YAML */}
                    <Grid item xs={12} md={6}>
                      <MDTypography variant="body2" fontWeight="medium" mb={1}>
                        Enums YAML
                      </MDTypography>
                      <TextField
                        fullWidth
                        multiline
                        rows={10}
                        variant="outlined"
                        value={enumsYaml}
                        onChange={(e) => setEnumsYaml(e.target.value)}
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          "& textarea": {
                            fontFamily: "monospace",
                          },
                        }}
                      />
                    </Grid>

                    {/* Tables JSON */}
                    <Grid item xs={12} md={6}>
                      <MDTypography variant="body2" fontWeight="medium" mb={1}>
                        Tables JSON
                      </MDTypography>
                      <TextField
                        fullWidth
                        multiline
                        rows={10}
                        variant="outlined"
                        value={tablesJson}
                        onChange={(e) => setTablesJson(e.target.value)}
                        sx={{
                          fontFamily: "monospace",
                          fontSize: "0.75rem",
                          "& textarea": {
                            fontFamily: "monospace",
                          },
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </MDBox>
            </Card>
          </Grid>

          {/* Results Display */}
          {resp && (
            <Grid item xs={12}>
              <Card>
                <MDBox p={3}>
                  <MDTypography variant="h5" fontWeight="medium" mb={3}>
                    Sanity Check Results
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
                      maxHeight: "600px",
                    }}
                  >
                    {JSON.stringify(resp, null, 2)}
                  </MDBox>
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
                            <MDTypography variant="h6" fontWeight="medium" mb={1}>
                              {r.title}
                            </MDTypography>
                            <MDTypography variant="caption" color="text">
                              {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
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
