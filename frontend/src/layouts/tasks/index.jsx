import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
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
import { useMediaQuery, useTheme } from "@mui/material";

export default function Tasks() {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));
  const [form, setForm] = useState({
    env: "",
    interface_num: "1",
    title: "",
    actions: [{ name: "ping", arguments: {} }],
  });

  const [interfaces] = useState(["1", "2", "3"]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Toast state
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // Modal state
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    onConfirm: null,
  });

  // Load Tasks
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/tasks");
      const data = await res.json();
      const items = Array.isArray(data) ? data : data.items || [];
      setTasks(items);
    } catch {
      setToast({
        open: true,
        message: "Network error loading tasks",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  // Create Task
  const createTask = async (e) => {
    e.preventDefault();
    if (!form.env.trim()) {
      setToast({
        open: true,
        message: "Please enter environment path",
        severity: "error",
      });
      return;
    }

    try {
      const res = await apiFetch("/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setToast({
          open: true,
          message: "✅ Task created",
          severity: "success",
        });
        setForm({
          env: "",
          interface_num: "1",
          title: "",
          actions: [{ name: "ping", arguments: {} }],
        });
        loadTasks();
      } else {
        setToast({
          open: true,
          message: data.error || "Failed to create task",
          severity: "error",
        });
      }
    } catch {
      setToast({
        open: true,
        message: "Network error creating task",
        severity: "error",
      });
    }
  };

  // Run Task
  const runTask = async (id) => {
    try {
      const res = await apiFetch(`/tasks/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setToast({
          open: true,
          message: `🚀 Task run: ${data.status}`,
          severity: "success",
        });
      } else {
        setToast({
          open: true,
          message: data.error || "Run failed",
          severity: "error",
        });
      }
    } catch {
      setToast({
        open: true,
        message: "Network error running task",
        severity: "error",
      });
    }
  };

  // Delete Task
  const deleteTask = async (id) => {
    setConfirmDialog({
      open: true,
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/tasks/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (res.ok) {
            setToast({
              open: true,
              message: "🗑️ Task deleted",
              severity: "success",
            });
            loadTasks();
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
        setConfirmDialog({ open: false, onConfirm: null });
      },
    });
  };

  // Run All
  const runAllTasks = async () => {
    try {
      const res = await apiFetch("/tasks/run_all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setToast({
          open: true,
          message: "🚀 All tasks executed",
          severity: "success",
        });
        navigate("/tasks/results");
      } else {
        setToast({
          open: true,
          message: data.error || "Run all failed",
          severity: "error",
        });
      }
    } catch {
      setToast({
        open: true,
        message: "Network error running all tasks",
        severity: "error",
      });
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <Grid container spacing={3}>
        {/* Form */}
        <Grid item xs={12}>
          <MDBox pt={6} pb={3}>
            <Grid container spacing={3}>
              {/* Header */}
              <Grid item xs={12}>
                <MDBox
                  display="flex"
                  flexDirection={isSmDown ? "column" : "row"}
                  justifyContent="space-between"
                  alignItems={isSmDown ? "flex-start" : "center"}
                  gap={isSmDown ? 2 : 0}
                >
                  {/* Left: title + icon */}
                  <MDTypography
                    variant={isSmDown ? "h5" : "h4"}
                    fontWeight="medium"
                    sx={{ display: "flex", alignItems: "center" }}
                  >
                    <Icon sx={{ mr: 1 }}>task_alt</Icon>
                    Task Checker
                  </MDTypography>

                  {/* Right: buttons (stack below on small screens) */}
                  <MDBox
                    display="flex"
                    flexDirection={isSmDown ? "column" : "row"}
                    gap={2}
                    sx={{
                      width: isSmDown ? "100%" : "auto",
                      mt: isSmDown ? 1.5 : 0,
                    }}
                  >
                    <MDButton
                      variant="gradient"
                      color="success"
                      onClick={runAllTasks}
                      fullWidth={isSmDown}
                    >
                      <Icon sx={{ mr: 0.5 }}>play_arrow</Icon>
                      Run All
                    </MDButton>
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={() => navigate("/tasks/results")}
                      fullWidth={isSmDown}
                    >
                      <Icon sx={{ mr: 0.5 }}>assessment</Icon>
                      View All Results
                    </MDButton>
                  </MDBox>
                </MDBox>
              </Grid>
              {/* Create Task Form */}
              <Grid item xs={12}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h5" fontWeight="medium" mb={3}>
                      Create New Task
                    </MDTypography>
                    <Box component="form" onSubmit={createTask}>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Environment Path"
                            placeholder="e.g., envs/smart_home"
                            variant="outlined"
                            value={form.env}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, env: e.target.value }))
                            }
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            fullWidth
                            label="Task Title"
                            placeholder="Task title"
                            variant="outlined"
                            value={form.title}
                            onChange={(e) =>
                              setForm((f) => ({ ...f, title: e.target.value }))
                            }
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Interface Number</InputLabel>
                            <Select
                              value={form.interface_num}
                              label="Interface Number"
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  interface_num: e.target.value,
                                }))
                              }
                              sx={{
                                height: 48,
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              {interfaces.map((i) => (
                                <MenuItem key={i} value={i}>
                                  Interface {i}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            label="Actions (JSON)"
                            multiline
                            rows={4}
                            variant="outlined"
                            value={JSON.stringify(form.actions, null, 2)}
                            onChange={(e) => {
                              try {
                                setForm((f) => ({
                                  ...f,
                                  actions: JSON.parse(e.target.value),
                                }));
                              } catch {}
                            }}
                            sx={{
                              fontFamily: "monospace",
                              fontSize: "0.875rem",
                            }}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <MDButton
                            variant="gradient"
                            color="info"
                            type="submit"
                          >
                            <Icon sx={{ mr: 0.5 }}>add</Icon>
                            Create Task
                          </MDButton>
                        </Grid>
                      </Grid>
                    </Box>
                  </MDBox>
                </Card>
              </Grid>
            </Grid>
          </MDBox>
        </Grid>
        {/* Tasks Table */}
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
                Available Tasks
              </MDTypography>
            </MDBox>
            <MDBox pt={3}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Interface
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          File
                        </MDTypography>
                      </TableCell>
                      <TableCell>
                        <MDTypography variant="caption" fontWeight="bold">
                          Status
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
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <MDTypography variant="body2" color="text">
                            Loading tasks...
                          </MDTypography>
                        </TableCell>
                      </TableRow>
                    ) : Array.isArray(tasks) && tasks.length > 0 ? (
                      tasks.map((t, i) => (
                        <TableRow key={t._id || i} hover>
                          <TableCell>
                            <Chip
                              label={`INTERFACE_${t.interface_num}`}
                              color="info"
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <MDTypography variant="body2">
                              {t.title || t._id}
                            </MDTypography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={
                                t.status === "passed" ? "✓ PASSED" : "✗ FAILED"
                              }
                              color={
                                t.status === "passed" ? "success" : "error"
                              }
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <MDBox display="flex" gap={1} flexWrap="wrap">
                              <Button
                                size="small"
                                variant="contained"
                                color="info"
                                onClick={() => runTask(t._id)}
                              >
                                <Icon sx={{ fontSize: "1rem" }}>
                                  play_arrow
                                </Icon>
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="secondary"
                                onClick={() => navigate(`/tasks/${t._id}/view`)}
                              >
                                <Icon sx={{ fontSize: "1rem" }}>
                                  visibility
                                </Icon>
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() =>
                                  navigate(`/tasks/${t._id}/results`)
                                }
                              >
                                <Icon sx={{ fontSize: "1rem" }}>
                                  assessment
                                </Icon>
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                color="error"
                                onClick={() => deleteTask(t._id)}
                              >
                                <Icon sx={{ fontSize: "1rem" }}>delete</Icon>
                              </Button>
                            </MDBox>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <MDTypography variant="body2" color="text">
                            No tasks found.
                          </MDTypography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </MDBox>
          </Card>
        </Grid>
      </Grid>

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
        <DialogTitle>Delete Task?</DialogTitle>
        <DialogContent>
          <DialogContentText>This action cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setConfirmDialog({ open: false, onConfirm: null })}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDialog.onConfirm}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
