import React, { useState, useCallback, useEffect } from "react";
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
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import OutlinedInput from "@mui/material/OutlinedInput";
import Autocomplete from "@mui/material/Autocomplete";
import FormHelperText from "@mui/material/FormHelperText";

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

export default function Validate() {
  const { apiFetch, apiUpload } = useAuth();

  // Upload state
  const [excel, setExcel] = useState(null);
  const [doc, setDoc] = useState(null);
  const [sheets, setSheets] = useState({});
  const [selectedSheet, setSelectedSheet] = useState("");
  const [columns, setColumns] = useState([]);
  const [selectedCols, setSelectedCols] = useState([]);
  const [threshold, setThreshold] = useState(0.5);
  const [useLLM, setUseLLM] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Saved reports
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Load Validation Reports
  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/validate");
      const data = await res.json();
      if (res.ok) {
        setItems(data.items || []);
      } else {
        setToast({
          open: true,
          message: data.error || "Failed to load validations",
          severity: "error",
        });
      }
    } catch {
      setToast({ open: true, message: "Network error", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Load Excel sheet names and columns
  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcel(file);

    const fd = new FormData();
    fd.append("excel_file", file);

    try {
      const res = await apiUpload("/validate/columns", fd);
      if (res.ok && res.json?.sheets) {
        setSheets(res.json.sheets);
        const first = Object.keys(res.json.sheets)[0];
        setSelectedSheet(first);
        setColumns(res.json.sheets[first]);
        setSelectedCols([]);
        setToast({
          open: true,
          message: "Excel loaded successfully",
          severity: "success",
        });
      } else {
        setToast({
          open: true,
          message: res.json?.error || "Failed to load Excel",
          severity: "error",
        });
      }
    } catch {
      setToast({
        open: true,
        message: "Error reading Excel file",
        severity: "error",
      });
    }
  };

  const handleSheetChange = (sheet) => {
    setSelectedSheet(sheet);
    setColumns(sheets[sheet] || []);
    setSelectedCols([]);
  };

  // Run Validation
  const submitValidation = async (e) => {
    e.preventDefault();
    if (!excel || !doc) {
      setToast({
        open: true,
        message: "Please upload both files",
        severity: "error",
      });
      return;
    }
    if (!selectedSheet || selectedCols.length === 0) {
      setToast({
        open: true,
        message: "Please select a sheet and columns",
        severity: "error",
      });
      return;
    }

    const fd = new FormData();
    fd.append("excel_file", excel);
    fd.append("doc_file", doc);
    fd.append("sheet_name", selectedSheet);
    fd.append("threshold", threshold);
    fd.append("use_llm_reasoning", useLLM);

    setIsUploading(true);
    setProgress(0);

    try {
      const res = await apiUpload("/validate", fd, { onProgress: setProgress });
      if (res.ok) {
        setToast({
          open: true,
          message: "Validation completed",
          severity: "success",
        });
        loadReports();
        // Reset form
        setExcel(null);
        setDoc(null);
        setSheets({});
        setSelectedSheet("");
        setColumns([]);
        setSelectedCols([]);
        document.getElementById("excel-input").value = "";
        document.getElementById("doc-input").value = "";
      } else {
        setToast({
          open: true,
          message: res.json?.error || "Validation failed",
          severity: "error",
        });
      }
    } catch {
      setToast({ open: true, message: "Upload failed", severity: "error" });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  // Delete Report
  const remove = async (id) => {
    setConfirmDialog({
      open: true,
      onConfirm: async () => {
        const res = await apiFetch(`/validate/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (res.ok) {
          setToast({ open: true, message: "Deleted", severity: "success" });
          setItems(items.filter((x) => (x._id || x.id) !== id));
        } else {
          setToast({
            open: true,
            message: data.error || "Delete failed",
            severity: "error",
          });
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
              <Icon sx={{ verticalAlign: "middle", mr: 1 }}>verified</Icon>
              Validation Dashboard
            </MDTypography>
          </Grid>

          {/* Upload Form */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Run New Validation
                </MDTypography>

                <Box component="form" onSubmit={submitValidation}>
                  <Grid container spacing={2}>
                    {/* Excel Upload */}
                    <Grid item xs={12} lg={6}>
                      <MDTypography variant="body2" fontWeight="medium" mb={1}>
                        Upload Excel File (.xlsx, .xls)
                      </MDTypography>
                      <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        sx={{ justifyContent: "flex-start" }}
                      >
                        <Icon sx={{ mr: 1 }}>upload_file</Icon>
                        {excel ? excel.name : "Choose Excel File"}
                        <input
                          id="excel-input"
                          type="file"
                          hidden
                          accept=".xlsx,.xls"
                          onChange={handleExcelUpload}
                        />
                      </Button>
                    </Grid>

                    {/* Document Upload */}
                    <Grid item xs={12} lg={6}>
                      <MDTypography variant="body2" fontWeight="medium" mb={1}>
                        Upload Document (.txt, .docx, .pdf)
                      </MDTypography>
                      <Button
                        variant="outlined"
                        component="label"
                        fullWidth
                        sx={{ justifyContent: "flex-start" }}
                      >
                        <Icon sx={{ mr: 1 }}>upload_file</Icon>
                        {doc ? doc.name : "Choose Document"}
                        <input
                          id="doc-input"
                          type="file"
                          hidden
                          accept=".txt,.docx,.pdf"
                          onChange={(e) => setDoc(e.target.files?.[0] || null)}
                        />
                      </Button>
                    </Grid>

                    {/* Excel Mapping: Sheet + Columns */}
                    {Object.keys(sheets).length > 0 && (
                      <Grid item xs={12}>
                        <MDBox
                          borderRadius={2}
                          border="1px solid"
                          borderColor="divider"
                          p={2.5}
                          mt={1}
                        >
                          <MDTypography
                            variant="subtitle2"
                            fontWeight="medium"
                            mb={1}
                          >
                            Excel Mapping
                          </MDTypography>

                          <Grid container spacing={2}>
                            {/* Sheet Selection */}
                            <Grid item xs={12} md={6}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Select Sheet</InputLabel>
                                <Select
                                  value={selectedSheet}
                                  sx={{ height: 40 }}
                                  label="Select Sheet"
                                  onChange={(e) =>
                                    handleSheetChange(e.target.value)
                                  }
                                >
                                  {Object.keys(sheets).map((s) => (
                                    <MenuItem key={s} value={s}>
                                      {s}
                                    </MenuItem>
                                  ))}
                                </Select>
                                <FormHelperText>
                                  Choose the worksheet to validate.
                                </FormHelperText>
                              </FormControl>
                            </Grid>

                            {/* Columns Selection */}
                            <Grid item xs={12} md={6}>
                              <Autocomplete
                                multiple
                                size="small"
                                options={columns}
                                value={selectedCols}
                                sx={{ height: 45 }}
                                onChange={(_, value) => setSelectedCols(value)}
                                disableCloseOnSelect
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    label="Select Column(s)"
                                    placeholder="Search or pick columns"
                                  />
                                )}
                                renderTags={(value, getTagProps) =>
                                  value.map((option, index) => (
                                    <Chip
                                      {...getTagProps({ index })}
                                      key={option}
                                      label={option}
                                      size="small"
                                    />
                                  ))
                                }
                                fullWidth
                              />
                              <FormHelperText>
                                Select one or more columns to run the validation
                                on.
                              </FormHelperText>
                            </Grid>
                          </Grid>
                        </MDBox>
                      </Grid>
                    )}

                    {/* Threshold + LLM Settings */}
                    <Grid item xs={12} lg={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Threshold"
                        inputProps={{ step: 0.01, min: 0, max: 1 }}
                        value={threshold}
                        onChange={(e) => setThreshold(e.target.value)}
                      />
                    </Grid>

                    <Grid item xs={12} lg={6}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={useLLM}
                            onChange={(e) => setUseLLM(e.target.checked)}
                          />
                        }
                        label="Use LLM Reasoning"
                      />
                    </Grid>
                  </Grid>

                  {/* Progress Bar */}
                  {progress > 0 && progress < 100 && (
                    <MDBox mt={2}>
                      <LinearProgress variant="determinate" value={progress} />
                      <MDTypography variant="caption" color="text">
                        {progress}% completed
                      </MDTypography>
                    </MDBox>
                  )}

                  {/* Submit */}
                  <MDButton
                    variant="gradient"
                    color="info"
                    type="submit"
                    disabled={isUploading}
                    sx={{ mt: 2 }}
                  >
                    {isUploading ? "Validating..." : "Run Validation"}
                  </MDButton>
                </Box>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {/* Previous Validations */}
      <Grid item xs={12}>
        <Card>
          <MDBox p={3}>
            <MDTypography variant="h5" fontWeight="medium" mb={3}>
              Previous Validations
            </MDTypography>

            {loading ? (
              <MDTypography variant="body2" color="text">
                Loading...
              </MDTypography>
            ) : items.length === 0 ? (
              <MDTypography variant="body2" color="text">
                No validations found.
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
                          <MDTypography
                            variant="caption"
                            color="text"
                            mb={2}
                            display="block"
                          >
                            {r.report_type || "validation"} ·{" "}
                            {r.created_at
                              ? new Date(r.created_at).toLocaleString()
                              : ""}
                          </MDTypography>

                          <MDBox mb={2}>
                            <MDTypography variant="body2" component="div">
                              <strong>Tools:</strong>{" "}
                              {r.results?.summary?.total_tools || 0} ·{" "}
                              <strong>Matched:</strong>{" "}
                              {r.results?.summary?.matched || 0}
                            </MDTypography>
                          </MDBox>

                          <MDBox display="flex" gap={2}>
                            <MDButton
                              component={Link}
                              to={`/validate/${id}`}
                              variant="gradient"
                              color="info"
                              size="small"
                            >
                              <Icon sx={{ mr: 0.5 }}>visibility</Icon>
                              Open Details
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
        <DialogTitle>Delete Validation Report?</DialogTitle>
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
      <Footer />
    </DashboardLayout>
  );
}
