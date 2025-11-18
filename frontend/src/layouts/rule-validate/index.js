/**
=========================================================
* Material Dashboard 2 React - Rule Validate Page
=========================================================
*/

import React, { useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";

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

export default function RuleValidate() {
  const { apiUpload } = useAuth();

  const [doc, setDoc] = useState(null);
  const [ruleKey, setRuleKey] = useState("default");
  const [resp, setResp] = useState(null);
  const [progress, setProgress] = useState(0);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  const submit = async (e) => {
    e.preventDefault();
    setResp(null);
    setProgress(0);

    if (!doc) {
      setToast({ open: true, message: "Please upload a document", severity: "error" });
      return;
    }

    const fd = new FormData();
    fd.append("doc_file", doc);
    fd.append("rule_key", ruleKey);

    try {
      const res = await apiUpload("/rule-validate", fd, { onProgress: setProgress });
      setResp(res.json);
      if (res.ok) {
        setToast({ open: true, message: "Rule validation completed", severity: "success" });
      } else {
        setToast({
          open: true,
          message: res.json.error || "Validation failed",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.json?.error || "Upload error",
        severity: "error",
      });
    } finally {
      setProgress(0);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3}>
          {/* Header */}
          <Grid item xs={12}>
            <MDTypography variant="h4" fontWeight="medium">
              <Icon sx={{ verticalAlign: "middle", mr: 1 }}>rule</Icon>
              Rule Validation
            </MDTypography>
          </Grid>

          {/* Validation Form */}
          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Run Rule Validation
                </MDTypography>
                <Box component="form" onSubmit={submit}>
                  {/* Document Upload */}
                  <MDTypography variant="body2" fontWeight="medium" mb={1}>
                    Upload Document
                  </MDTypography>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    sx={{ mb: 2, justifyContent: "flex-start" }}
                  >
                    <Icon sx={{ mr: 1 }}>upload_file</Icon>
                    {doc ? doc.name : "Choose File (.txt, .md, .docx, .pdf)"}
                    <input
                      id="doc-input"
                      type="file"
                      hidden
                      accept=".txt,.md,.docx,.pdf"
                      onChange={(e) => setDoc(e.target.files?.[0] || null)}
                    />
                  </Button>

                  {/* Rule Key Input */}
                  <TextField
                    fullWidth
                    label="Rule Key"
                    variant="outlined"
                    value={ruleKey}
                    onChange={(e) => setRuleKey(e.target.value)}
                    placeholder="default"
                    sx={{ mb: 2 }}
                  />

                  {/* Progress Bar */}
                  {progress > 0 && progress < 100 && (
                    <MDBox mb={2}>
                      <LinearProgress variant="determinate" value={progress} />
                      <MDTypography variant="caption" color="text">
                        {progress}% completed
                      </MDTypography>
                    </MDBox>
                  )}

                  {/* Submit Button */}
                  <MDButton variant="gradient" color="info" fullWidth type="submit">
                    Run Validation
                  </MDButton>
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
                    Validation Results
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
        </Grid>
      </MDBox>
      <Footer />

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
