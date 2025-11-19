/**
=========================================================
* Material Dashboard 2 React - Reports Page
=========================================================
*/

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
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

export default function Reports() {
  const { apiFetch, apiUpload } = useAuth();
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Upload form state
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  // Modal state
  const [confirmDialog, setConfirmDialog] = useState({ open: false, onConfirm: null });

  // 📥 Load reports
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const url = "/reports" + (cursor ? `?cursor=${cursor}` : "");
      const res = await apiFetch(url);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
        setCursor(data.next_cursor);
      } else {
        setToast({
          open: true,
          message: data.error || "Failed to load reports",
          severity: "error",
        });
      }
    } catch (e) {
      setToast({ open: true, message: "Network error loading reports", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [apiFetch, cursor]);

  useEffect(() => {
    loadReports();
  }, []);

  // 🧩 Upload documents to create a report
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file1 || !file2) {
      setToast({ open: true, message: "Please upload both files", severity: "error" });
      return;
    }

    const fd = new FormData();
    fd.append("file1", file1);
    fd.append("file2", file2);
    if (title) fd.append("title", title);
    if (tags) fd.append("tags", tags);

    setIsUploading(true);
    setProgress(0);

    try {
      const res = await apiUpload("/reports", fd, { onProgress: setProgress });
      if (res.ok) {
        setToast({ open: true, message: "Report created successfully", severity: "success" });
        setFile1(null);
        setFile2(null);
        setTitle("");
        setTags("");
        // Reset file inputs
        document.getElementById("file1-input").value = "";
        document.getElementById("file2-input").value = "";
        loadReports();
      } else {
        setToast({
          open: true,
          message: res.json?.error || "Failed to create report",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({ open: true, message: "Upload error", severity: "error" });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  // 🗑️ Delete report
  const remove = async (id) => {
    setConfirmDialog({
      open: true,
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/reports/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (res.ok) {
            setToast({ open: true, message: "Report deleted", severity: "success" });
            setItems(items.filter((x) => (x._id || x.id) !== id));
          } else {
            setToast({ open: true, message: data.error || "Delete failed", severity: "error" });
          }
        } catch {
          setToast({ open: true, message: "Network error deleting report", severity: "error" });
        }
        setConfirmDialog({ open: false, onConfirm: null });
      },
    });
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3}>
          {/* Header */}
          <Grid item xs={12}>
            <MDTypography variant="h4" fontWeight="medium">
              <Icon sx={{ verticalAlign: "middle", mr: 1 }}>assessment</Icon>
              Reports Dashboard
            </MDTypography>
          </Grid>

          {/* Upload Form */}
          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Create New Report
                </MDTypography>
                <Box component="form" onSubmit={handleUpload}>
                  <TextField
                    fullWidth
                    label="Title (optional)"
                    variant="outlined"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    label="Tags (comma separated)"
                    variant="outlined"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    sx={{ mb: 2 }}
                  />

                  <MDTypography variant="body2" fontWeight="medium" mb={1}>
                    Upload Document 1
                  </MDTypography>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    sx={{ mb: 2, justifyContent: "flex-start" }}
                  >
                    <Icon sx={{ mr: 1 }}>upload_file</Icon>
                    {file1 ? file1.name : "Choose File"}
                    <input
                      id="file1-input"
                      type="file"
                      hidden
                      accept=".txt,.docx,.pdf,.md"
                      onChange={(e) => setFile1(e.target.files?.[0] || null)}
                    />
                  </Button>

                  <MDTypography variant="body2" fontWeight="medium" mb={1}>
                    Upload Document 2
                  </MDTypography>
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    sx={{ mb: 2, justifyContent: "flex-start" }}
                  >
                    <Icon sx={{ mr: 1 }}>upload_file</Icon>
                    {file2 ? file2.name : "Choose File"}
                    <input
                      id="file2-input"
                      type="file"
                      hidden
                      accept=".txt,.docx,.pdf,.md"
                      onChange={(e) => setFile2(e.target.files?.[0] || null)}
                    />
                  </Button>

                  {progress > 0 && progress < 100 && (
                    <MDBox mb={2}>
                      <LinearProgress variant="determinate" value={progress} />
                      <MDTypography variant="caption" color="text">
                        {progress}% uploaded
                      </MDTypography>
                    </MDBox>
                  )}

                  <MDButton
                    variant="gradient"
                    color="info"
                    fullWidth
                    type="submit"
                    disabled={isUploading}
                  >
                    {isUploading ? "Uploading..." : "Create Report"}
                  </MDButton>
                </Box>
              </MDBox>
            </Card>
          </Grid>

          {/* Reports List */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Saved Reports
                </MDTypography>

                {loading ? (
                  <MDTypography variant="body2" color="text">
                    Loading reports...
                  </MDTypography>
                ) : items.length === 0 ? (
                  <MDTypography variant="body2" color="text">
                    No reports yet.
                  </MDTypography>
                ) : (
                  <Grid container spacing={2}>
                    {items.map((r) => {
                      const id = r._id || r.id;
                      return (
                        <Grid item xs={12} key={id}>
                          <Card variant="outlined">
                            <MDBox p={3}>
                              <MDTypography variant="h6" fontWeight="medium" mb={1}>
                                {r.title}
                              </MDTypography>
                              <MDTypography variant="caption" color="text" mb={2} display="block">
                                {r.report_type || "comparison"} ·{" "}
                                {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                              </MDTypography>

                              <MDBox mb={2}>
                                <MDTypography variant="body2" component="div">
                                  <strong>Jaccard:</strong> {r.results?.jaccard?.toFixed(3)} ·{" "}
                                  <strong>TF-IDF:</strong> {r.results?.tfidf?.toFixed(3)} ·{" "}
                                  <strong>Semantic:</strong> {r.results?.semantic?.toFixed(3)} ·{" "}
                                  <strong>LLM:</strong> {r.results?.llm?.toFixed(3)}
                                </MDTypography>
                              </MDBox>

                              <MDBox display="flex" gap={2}>
                                <MDButton
                                  component={Link}
                                  to={`/reports/${id}`}
                                  variant="gradient"
                                  color="info"
                                  size="small"
                                >
                                  <Icon sx={{ mr: 0.5 }}>visibility</Icon>
                                  View Details
                                </MDButton>
                                <MDButton
                                  variant="gradient"
                                  color="error"
                                  size="small"
                                  onClick={() => remove(id)}
                                >
                                  <Icon sx={{ mr: 0.5 }}>delete</Icon>
                                  Delete
                                </MDButton>
                              </MDBox>
                            </MDBox>
                          </Card>
                        </Grid>
                      );
                    })}
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

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, onConfirm: null })}
      >
        <DialogTitle>Delete Report?</DialogTitle>
        <DialogContent>
          <DialogContentText>This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, onConfirm: null })}>Cancel</Button>
          <Button onClick={confirmDialog.onConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
