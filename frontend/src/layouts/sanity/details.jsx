import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Auth context
import { useAuth } from "../../lib/auth";

export default function SanityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast state
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  useEffect(() => {
    loadReport();
  }, [id]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/sanity/reports/${id}`);
      const data = await res.json();
      if (res.ok) {
        setReport(data);
      } else {
        setToast({
          open: true,
          message: "Failed to load report",
          severity: "error",
        });
        setTimeout(() => navigate("/sanity"), 2000);
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Error loading report",
        severity: "error",
      });
      setTimeout(() => navigate("/sanity"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await apiFetch(`/sanity/reports/${id}/download`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `db_sanity_report_${id}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        setToast({
          open: true,
          message: "Report exported successfully",
          severity: "success",
        });
      } else {
        setToast({
          open: true,
          message: "Failed to export report",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Error exporting report",
        severity: "error",
      });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/sanity/reports/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setToast({
          open: true,
          message: "Report deleted successfully",
          severity: "success",
        });
        setTimeout(() => navigate("/sanity"), 1500);
      } else {
        const data = await res.json();
        setToast({
          open: true,
          message: data.error || "Failed to delete report",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Error deleting report",
        severity: "error",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialog(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardNavbar />
        <MDBox pt={6} pb={3}>
          <MDBox
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="400px"
            flexDirection="column"
          >
            <CircularProgress size={60} thickness={4} />
            <MDTypography variant="body2" color="text" mt={2}>
              Loading report...
            </MDTypography>
          </MDBox>
        </MDBox>
      </DashboardLayout>
    );
  }

  if (!report) {
    return null;
  }

  const results = report.results || {};
  const fkSummary = results.generic_fk_summary || {
    passes: 0,
    fails: 0,
    total: 0,
  };
  const totalTables = results.tables ? Object.keys(results.tables).length : 0;
  const totalEnumChecks = results.enum_tables
    ? Object.values(results.enum_tables).reduce(
        (sum, checks) => sum + checks.length,
        0
      )
    : 0;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3}>
          {/* Header */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDBox
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  mb={2}
                >
                  <MDBox>
                    <MDBox display="flex" alignItems="center" mb={1}>
                      <MDButton
                        variant="text"
                        color="dark"
                        size="small"
                        onClick={() => navigate("/sanity")}
                        sx={{ mr: 2 }}
                      >
                        <Icon sx={{ mr: 0.5 }}>arrow_back</Icon>
                        Back
                      </MDButton>
                      <MDTypography variant="h4" fontWeight="medium">
                        {report.title || "DB Sanity Report"}
                      </MDTypography>
                    </MDBox>
                    <MDTypography variant="body2" color="text">
                      Created:{" "}
                      {report.created_at
                        ? new Date(report.created_at).toLocaleString()
                        : "N/A"}
                    </MDTypography>
                  </MDBox>
                  <MDBox display="flex" gap={2}>
                    <MDButton
                      variant="gradient"
                      color="info"
                      size="small"
                      onClick={handleExport}
                    >
                      <Icon sx={{ mr: 0.5 }}>download</Icon>
                      Export
                    </MDButton>
                    <MDButton
                      variant="gradient"
                      color="error"
                      size="small"
                      onClick={() => setDeleteDialog(true)}
                    >
                      <Icon sx={{ mr: 0.5 }}>delete</Icon>
                      Delete
                    </MDButton>
                  </MDBox>
                </MDBox>

                {/* Summary Cards */}
                <Grid container spacing={2} mt={1}>
                  <Grid item xs={12} sm={3}>
                    <Card
                      variant="outlined"
                      sx={{
                        background:
                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        color: "white",
                      }}
                    >
                      <MDBox p={2} textAlign="center">
                        <Icon fontSize="large" sx={{ color: "white" }}>
                          check_circle
                        </Icon>
                        <MDTypography
                          variant="h3"
                          fontWeight="bold"
                          color="white"
                        >
                          {fkSummary.passes}
                        </MDTypography>
                        <MDTypography variant="body2" color="white">
                          FK Checks Passed
                        </MDTypography>
                      </MDBox>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Card
                      variant="outlined"
                      sx={{
                        background:
                          "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                        color: "white",
                      }}
                    >
                      <MDBox p={2} textAlign="center">
                        <Icon fontSize="large" sx={{ color: "white" }}>
                          error
                        </Icon>
                        <MDTypography
                          variant="h3"
                          fontWeight="bold"
                          color="white"
                        >
                          {fkSummary.fails}
                        </MDTypography>
                        <MDTypography variant="body2" color="white">
                          FK Checks Failed
                        </MDTypography>
                      </MDBox>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Card
                      variant="outlined"
                      sx={{
                        background:
                          "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                        color: "white",
                      }}
                    >
                      <MDBox p={2} textAlign="center">
                        <Icon fontSize="large" sx={{ color: "white" }}>
                          table_chart
                        </Icon>
                        <MDTypography
                          variant="h3"
                          fontWeight="bold"
                          color="white"
                        >
                          {totalTables}
                        </MDTypography>
                        <MDTypography variant="body2" color="white">
                          Tables Analyzed
                        </MDTypography>
                      </MDBox>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <Card
                      variant="outlined"
                      sx={{
                        background:
                          "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                        color: "white",
                      }}
                    >
                      <MDBox p={2} textAlign="center">
                        <Icon fontSize="large" sx={{ color: "white" }}>
                          list
                        </Icon>
                        <MDTypography
                          variant="h3"
                          fontWeight="bold"
                          color="white"
                        >
                          {totalEnumChecks}
                        </MDTypography>
                        <MDTypography variant="body2" color="white">
                          Enum Checks
                        </MDTypography>
                      </MDBox>
                    </Card>
                  </Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          {/* Tabs Section */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
                  <Tabs
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                  >
                    <Tab
                      label="Enum Tables"
                      icon={<Icon>list</Icon>}
                      iconPosition="start"
                    />
                    <Tab
                      label="Relationships"
                      icon={<Icon>hub</Icon>}
                      iconPosition="start"
                    />
                    <Tab
                      label="Generic Relationships"
                      icon={<Icon>account_tree</Icon>}
                      iconPosition="start"
                    />
                    <Tab
                      label="Tables"
                      icon={<Icon>table_chart</Icon>}
                      iconPosition="start"
                    />
                  </Tabs>
                </Box>

                {/* Tab 0: Enum Tables */}
                {activeTab === 0 && (
                  <Box>
                    {results.enum_tables &&
                    Object.keys(results.enum_tables).length > 0 ? (
                      Object.entries(results.enum_tables).map(
                        ([tableName, checks]) => (
                          <Accordion key={tableName}>
                            <AccordionSummary
                              expandIcon={<Icon>expand_more</Icon>}
                            >
                              <MDBox
                                display="flex"
                                alignItems="center"
                                width="100%"
                              >
                                <Chip
                                  label={tableName}
                                  color="primary"
                                  size="small"
                                  sx={{ mr: 2 }}
                                />
                                <MDTypography variant="body2" color="text">
                                  {checks.length || 0} checks
                                </MDTypography>
                                <MDBox ml="auto" mr={2}>
                                  <Chip
                                    label={`${
                                      checks.filter((c) => c.result).length
                                    }/${checks.length} passed`}
                                    color={
                                      checks.every((c) => c.result)
                                        ? "success"
                                        : "warning"
                                    }
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
                                                {check.result
                                                  ? "check_circle"
                                                  : "cancel"}
                                              </Icon>
                                            }
                                            label={
                                              check.result ? "PASS" : "FAIL"
                                            }
                                            color={
                                              check.result ? "success" : "error"
                                            }
                                            size="small"
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <MDTypography
                                            variant="caption"
                                            color="text"
                                          >
                                            {check.details &&
                                            check.details.length > 0
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
                        )
                      )
                    ) : (
                      <MDTypography variant="body2" color="text">
                        No enum table data available
                      </MDTypography>
                    )}
                  </Box>
                )}

                {/* Tab 1: Relationships */}
                {activeTab === 1 && (
                  <Box>
                    {results.relationships &&
                    results.relationships.length > 0 ? (
                      results.relationships.map((rel, idx) => (
                        <Accordion key={idx}>
                          <AccordionSummary
                            expandIcon={<Icon>expand_more</Icon>}
                          >
                            <MDBox
                              display="flex"
                              alignItems="center"
                              width="100%"
                            >
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
                              <MDTypography
                                variant="body2"
                                fontWeight="medium"
                                mb={1}
                              >
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
                                  <pre
                                    style={{
                                      margin: 0,
                                      whiteSpace: "pre-wrap",
                                    }}
                                  >
                                    {JSON.stringify(rel.details, null, 2)}
                                  </pre>
                                </Box>
                              )}
                            </MDBox>
                          </AccordionDetails>
                        </Accordion>
                      ))
                    ) : (
                      <MDTypography variant="body2" color="text">
                        No relationship data available
                      </MDTypography>
                    )}
                  </Box>
                )}

                {/* Tab 2: Generic Relationships */}
                {activeTab === 2 && (
                  <Box>
                    {results.generic_relationships &&
                    results.generic_relationships.length > 0 ? (
                      results.generic_relationships.map((rel, idx) => (
                        <Accordion key={idx}>
                          <AccordionSummary
                            expandIcon={<Icon>expand_more</Icon>}
                          >
                            <MDBox
                              display="flex"
                              alignItems="center"
                              width="100%"
                            >
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
                              <MDTypography
                                variant="body2"
                                fontWeight="medium"
                                mb={1}
                              >
                                {rel.check}
                              </MDTypography>
                              {rel.kind && (
                                <Chip
                                  label={`Kind: ${rel.kind}`}
                                  size="small"
                                  sx={{ mb: 1 }}
                                />
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
                                  <pre
                                    style={{
                                      margin: 0,
                                      whiteSpace: "pre-wrap",
                                    }}
                                  >
                                    {JSON.stringify(rel.details, null, 2)}
                                  </pre>
                                </Box>
                              )}
                            </MDBox>
                          </AccordionDetails>
                        </Accordion>
                      ))
                    ) : (
                      <MDTypography variant="body2" color="text">
                        No generic relationship data available
                      </MDTypography>
                    )}
                  </Box>
                )}

                {/* Tab 3: Tables */}
                {activeTab === 3 && (
                  <Box>
                    {results.tables &&
                    Object.keys(results.tables).length > 0 ? (
                      <Grid container spacing={2}>
                        {Object.entries(results.tables).map(
                          ([tableName, tableData]) => (
                            <Grid item xs={12} md={6} lg={4} key={tableName}>
                              <Card variant="outlined">
                                <MDBox p={2}>
                                  <MDBox
                                    display="flex"
                                    alignItems="center"
                                    mb={1}
                                  >
                                    <Icon sx={{ mr: 1 }}>table_chart</Icon>
                                    <MDTypography
                                      variant="h6"
                                      fontWeight="medium"
                                    >
                                      {tableName}
                                    </MDTypography>
                                  </MDBox>
                                  <Divider sx={{ my: 1 }} />
                                  <MDTypography
                                    variant="body2"
                                    color="text"
                                    mb={1}
                                  >
                                    <strong>Row Count:</strong>{" "}
                                    {tableData.row_count || 0}
                                  </MDTypography>
                                  <MDTypography
                                    variant="caption"
                                    color="text"
                                    fontWeight="medium"
                                  >
                                    Checks: {tableData.checks?.length || 0}
                                  </MDTypography>
                                  {tableData.checks &&
                                    tableData.checks.length > 0 && (
                                      <Box mt={1}>
                                        {tableData.checks.map((check, idx) => (
                                          <MDBox
                                            key={idx}
                                            display="flex"
                                            alignItems="center"
                                            mt={0.5}
                                          >
                                            <Icon
                                              fontSize="small"
                                              color={
                                                check.result
                                                  ? "success"
                                                  : "error"
                                              }
                                              sx={{ mr: 0.5 }}
                                            >
                                              {check.result
                                                ? "check_circle"
                                                : "cancel"}
                                            </Icon>
                                            <MDTypography
                                              variant="caption"
                                              color="text"
                                            >
                                              {check.check}
                                            </MDTypography>
                                          </MDBox>
                                        ))}
                                      </Box>
                                    )}
                                </MDBox>
                              </Card>
                            </Grid>
                          )
                        )}
                      </Grid>
                    ) : (
                      <MDTypography variant="body2" color="text">
                        No table data available
                      </MDTypography>
                    )}
                  </Box>
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog}
        onClose={() => !isDeleting && setDeleteDialog(false)}
      >
        <DialogTitle>Delete Report</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this DB Sanity report? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <MDButton
            onClick={() => setDeleteDialog(false)}
            disabled={isDeleting}
          >
            Cancel
          </MDButton>
          <MDButton color="error" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </MDButton>
        </DialogActions>
      </Dialog>

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
