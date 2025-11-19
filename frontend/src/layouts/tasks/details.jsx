import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import TextField from "@mui/material/TextField";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Button from "@mui/material/Button";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Auth context
import { useAuth } from "../../lib/auth";

export default function TaskDetails() {
  const { id } = useParams();
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    title: "",
    env: "",
    interface_num: "",
    actions: [],
  });

  // Toast state
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // Delete confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({ open: false });

  // Load task
  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch(`/tasks/${id}`);
        const data = await res.json();
        if (res.ok) {
          setTask(data);
          setForm({
            title: data.title || "",
            env: data.env || "",
            interface_num: data.interface_num || "",
            actions: data.actions || [],
          });
        } else {
          setToast({
            open: true,
            message: data.error || "Failed to load task",
            severity: "error",
          });
        }
      } catch {
        setToast({
          open: true,
          message: "Network error while loading task",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiFetch, id]);

  // Delete
  const handleDelete = async () => {
    setConfirmDialog({ open: false });
    try {
      const res = await apiFetch(`/tasks/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setToast({
          open: true,
          message: "🗑️ Task deleted",
          severity: "success",
        });
        setTimeout(() => navigate("/tasks"), 1000);
      } else {
        setToast({
          open: true,
          message: data.error || "Delete failed",
          severity: "error",
        });
      }
    } catch {
      setToast({
        open: true,
        message: "Network error deleting task",
        severity: "error",
      });
    }
  };

  // Save edits
  const handleSave = async () => {
    try {
      const res = await apiFetch(`/tasks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({
          open: true,
          message: "✅ Task updated",
          severity: "success",
        });
        setTask(data);
        setEditMode(false);
      } else {
        setToast({
          open: true,
          message: data.error || "Update failed",
          severity: "error",
        });
      }
    } catch {
      setToast({
        open: true,
        message: "Network error updating task",
        severity: "error",
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="text">
            Loading task details...
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDTypography variant="h6" color="error">
            Task not found.
          </MDTypography>
        </MDBox>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3} justifyContent="center">
          {/* Back Button */}
          <Grid item xs={12} lg={11}>
            <MDButton
              variant="text"
              color="info"
              onClick={() => navigate("/tasks")}
              sx={{ mb: 2 }}
            >
              <Icon sx={{ mr: 1 }}>arrow_back</Icon>
              Back to Tasks
            </MDButton>
          </Grid>

          {/* Header Card */}
          <Grid item xs={12} lg={11}>
            <Card>
              <MDBox p={3}>
                <MDBox
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={2}
                >
                  <MDBox display="flex" alignItems="center" gap={1}>
                    <MDTypography variant="h4" fontWeight="medium">
                      📄
                    </MDTypography>
                    {editMode ? (
                      <TextField
                        value={form.title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, title: e.target.value }))
                        }
                        variant="standard"
                        sx={{ minWidth: 300 }}
                      />
                    ) : (
                      <MDTypography variant="h4" fontWeight="medium">
                        {task.title || "Untitled Task"}
                      </MDTypography>
                    )}
                  </MDBox>

                  {!editMode ? (
                    <MDButton
                      variant="gradient"
                      color="warning"
                      size="small"
                      onClick={() => setEditMode(true)}
                    >
                      <Icon sx={{ mr: 0.5 }}>edit</Icon>
                      Edit
                    </MDButton>
                  ) : (
                    <MDBox display="flex" gap={1}>
                      <MDButton
                        variant="gradient"
                        color="success"
                        size="small"
                        onClick={handleSave}
                      >
                        <Icon sx={{ mr: 0.5 }}>save</Icon>
                        Save
                      </MDButton>
                      <MDButton
                        variant="gradient"
                        color="secondary"
                        size="small"
                        onClick={() => setEditMode(false)}
                      >
                        <Icon sx={{ mr: 0.5 }}>close</Icon>
                        Cancel
                      </MDButton>
                    </MDBox>
                  )}
                </MDBox>

                <MDBox>
                  <MDTypography variant="body2" color="text">
                    <strong>Interface:</strong>{" "}
                    {editMode ? (
                      <TextField
                        value={form.interface_num}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            interface_num: e.target.value,
                          }))
                        }
                        variant="standard"
                        size="small"
                        sx={{ width: 80, ml: 0.5 }}
                      />
                    ) : (
                      task.interface_num
                    )}{" "}
                    | <strong>Env:</strong>{" "}
                    {editMode ? (
                      <TextField
                        value={form.env}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, env: e.target.value }))
                        }
                        variant="standard"
                        size="small"
                        sx={{ width: 120, ml: 0.5 }}
                      />
                    ) : (
                      task.env || "—"
                    )}
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          {/* Actions Card */}
          <Grid item xs={12} lg={11}>
            <Card sx={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={2}>
                  🛠 Actions:
                </MDTypography>
                {editMode ? (
                  <TextField
                    value={JSON.stringify(form.actions, null, 2)}
                    onChange={(e) => {
                      try {
                        setForm((f) => ({
                          ...f,
                          actions: JSON.parse(e.target.value),
                        }));
                      } catch {
                        // Ignore parse errors while typing
                      }
                    }}
                    multiline
                    rows={10}
                    fullWidth
                    variant="outlined"
                    sx={{
                      "& .MuiInputBase-root": {
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        backgroundColor: "#1e293b",
                        color: "#fff",
                      },
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255, 255, 255, 0.2)",
                      },
                    }}
                  />
                ) : (
                  <MDBox
                    component="pre"
                    sx={{
                      backgroundColor: "#1e293b",
                      color: "#fff",
                      p: 2,
                      borderRadius: 1,
                      fontSize: "0.75rem",
                      overflow: "auto",
                      fontFamily: "monospace",
                    }}
                  >
                    {JSON.stringify(task.actions, null, 2)}
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>

          {/* Delete Button */}
          <Grid item xs={12} lg={11}>
            <MDBox display="flex" justifyContent="flex-end">
              <MDButton
                variant="gradient"
                color="error"
                onClick={() => setConfirmDialog({ open: true })}
                startIcon={<Icon>delete</Icon>}
              >
                Delete Task
              </MDButton>
            </MDBox>
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

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false })}
      >
        <DialogTitle>Delete this task?</DialogTitle>
        <DialogContent>
          <DialogContentText>This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false })}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
