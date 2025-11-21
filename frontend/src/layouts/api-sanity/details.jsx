import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

// PDF libraries
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
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
import DataTable from "examples/Tables/DataTable";

// Auth context
import { useAuth } from "../../lib/auth";

export default function ApiSanityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const reportRef = useRef(null);

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
      const res = await apiFetch(`/api_sanity_check/reports/${id}`);
      const data = await res.json();
      if (res.ok) {
        setReport(data);
      } else {
        setToast({
          open: true,
          message: "Failed to load report",
          severity: "error",
        });
        setTimeout(() => navigate("/api-sanity"), 2000);
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Error loading report",
        severity: "error",
      });
      setTimeout(() => navigate("/api-sanity"), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!reportRef.current) {
      setToast({
        open: true,
        message: "Report content not ready for export",
        severity: "warning",
      });
      return;
    }

    try {
      const pdf = new jsPDF("p", "pt", "a4");
      const input = reportRef.current;

      const canvas = await html2canvas(input, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 550;
      const pageHeight = 780;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 20;

      pdf.addImage(imgData, "PNG", 30, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 30, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(
        `API_Sanity_Report_${report.title || "Untitled"}_${
          new Date().toISOString().split("T")[0]
        }.pdf`
      );

      setToast({
        open: true,
        message: "Report exported as PDF successfully",
        severity: "success",
      });
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
      const res = await apiFetch(`/api_sanity_check/deletions/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setToast({
          open: true,
          message: "Report deleted successfully",
          severity: "success",
        });
        setTimeout(() => navigate("/api-sanity"), 1500);
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

  const results = report?.results || {};
  const overall = results.summary?.overall || {
    total_apis: 0,
    get: { count: 0, percent: 0 },
    set: { count: 0, percent: 0 },
  };
  const summaryInterfaces = results.summary?.interfaces || {};
  const interfacesList = results.interfaces || [];
  const apis = results.apis || [];
  const duplicates = results.duplicates || [];
  const comparison = results.interface_file_yaml_comparison || {};

  const summaryTable = useMemo(() => {
    const columns = [
      { Header: "Interface", accessor: "interface", width: "20%", align: "left" },
      { Header: "Total APIs", accessor: "total", align: "center" },
      { Header: "GET", accessor: "get", align: "center" },
      { Header: "SET", accessor: "set", align: "center" },
    ];

    const rows = Object.entries(summaryInterfaces).map(([iface, data]) => ({
      interface: <Chip label={iface} size="small" color="primary" variant="outlined" />,
      total: (
        <MDTypography variant="button" fontWeight="medium">
          {data.total_apis || data.total || 0}
        </MDTypography>
      ),
      get: (
        <MDBox display="flex" justifyContent="center" alignItems="center" gap={0.5}>
          <MDTypography variant="button" fontWeight="medium">
            {data.get?.count || 0}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            ({data.get?.percent || 0}%)
          </MDTypography>
        </MDBox>
      ),
      set: (
        <MDBox display="flex" justifyContent="center" alignItems="center" gap={0.5}>
          <MDTypography variant="button" fontWeight="medium">
            {data.set?.count || 0}
          </MDTypography>
          <MDTypography variant="caption" color="text">
            ({data.set?.percent || 0}%)
          </MDTypography>
        </MDBox>
      ),
    }));

    if (!rows.length) {
      rows.push({
        interface: (
          <MDTypography variant="caption" color="text">
            No interface summary data available
          </MDTypography>
        ),
        total: "—",
        get: "—",
        set: "—",
      });
    }

    return { columns, rows };
  }, [summaryInterfaces]);

  const interfaceTables = useMemo(() => {
    const columns = [
      { Header: "API Name", accessor: "name", width: "30%", align: "left" },
      { Header: "Type", accessor: "type", align: "center" },
      { Header: "Match", accessor: "match", align: "center" },
      { Header: "Parameters", accessor: "params", align: "center" },
    ];

    const tables = {};

    interfacesList.forEach((ifaceName) => {
      const rows = apis
        .filter((api) => api.interface === ifaceName)
        .map((api) => ({
          name: (
            <MDTypography variant="button" fontWeight="medium">
              {api.api_name}
            </MDTypography>
          ),
          type: (
            <Chip
              label={api.classification?.toUpperCase() || "N/A"}
              size="small"
              color={(api.classification || "").toLowerCase() === "get" ? "info" : "warning"}
            />
          ),
          match: api.param_match ? (
            <Chip
              icon={<Icon fontSize="small">check_circle</Icon>}
              label="Match"
              size="small"
              color="success"
            />
          ) : (
            <Chip
              icon={<Icon fontSize="small">cancel</Icon>}
              label="Mismatch"
              size="small"
              color="error"
            />
          ),
          params: (
            <MDTypography variant="caption" color="text">
              {api.params?.length || 0} params
            </MDTypography>
          ),
        }));

      if (!rows.length) {
        rows.push({
          name: (
            <MDTypography variant="caption" color="text">
              No APIs for this interface
            </MDTypography>
          ),
          type: "—",
          match: "—",
          params: "—",
        });
      }

      tables[ifaceName] = { columns, rows };
    });

    return tables;
  }, [interfacesList, apis]);

  const allApisTable = useMemo(() => {
    const columns = [
      { Header: "API Name", accessor: "name", width: "28%", align: "left" },
      { Header: "Interface", accessor: "interface", align: "center" },
      { Header: "Type", accessor: "type", align: "center" },
      { Header: "Match", accessor: "match", align: "center" },
      { Header: "Parameters", accessor: "params", width: "22%", align: "left" },
    ];

    const rows = apis.map((api) => {
      const classification = (api.classification || "").toUpperCase();
      const mismatch = api.param_mismatch || {};

      return {
        name: (
          <MDTypography variant="button" fontWeight="medium">
            {api.api_name}
          </MDTypography>
        ),
        interface: <Chip label={api.interface} size="small" color="primary" variant="outlined" />,
        type: (
          <Chip label={classification || "N/A"} size="small" color={classification === "GET" ? "info" : "warning"} />
        ),
        match: api.param_match ? (
          <Chip
            icon={<Icon fontSize="small">check_circle</Icon>}
            label="Match"
            size="small"
            color="success"
          />
        ) : (
          <Chip
            icon={<Icon fontSize="small">cancel</Icon>}
            label="Mismatch"
            size="small"
            color="error"
          />
        ),
        params: (
          <MDBox display="flex" flexWrap="wrap" alignItems="center" gap={0.5}>
            <MDTypography variant="caption" color="text">
              {api.params?.length || 0} params
            </MDTypography>
            {!api.param_match && mismatch.not_in_tools_info && (
              <Chip label="Not in tools_info" size="small" color="error" variant="outlined" />
            )}
            {!api.param_match && mismatch.type_or_optional_diff?.length > 0 && (
              <Chip
                label={`${mismatch.type_or_optional_diff.length} diffs`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
          </MDBox>
        ),
      };
    });

    if (!rows.length) {
      rows.push({
        name: (
          <MDTypography variant="caption" color="text">
            No API data available
          </MDTypography>
        ),
        interface: "—",
        type: "—",
        match: "—",
        params: "—",
      });
    }

    return { columns, rows };
  }, [apis]);

  const duplicatesTable = useMemo(() => {
    const columns = [
      { Header: "API Name", accessor: "apiName", width: "30%", align: "left" },
      { Header: "Count", accessor: "count", align: "center" },
      { Header: "Interfaces", accessor: "interfaces", align: "left" },
    ];

    const rows = duplicates.map((dup) => {
      const involved = dup.interfaces_involved || dup.interfaces || [];
      return {
        apiName: (
          <MDTypography variant="button" fontWeight="medium">
            {dup.api_name}
          </MDTypography>
        ),
        count: (
          <Chip label={involved.length} color="warning" size="small" variant="outlined" />
        ),
        interfaces: (
          <MDBox display="flex" flexWrap="wrap" gap={0.5}>
            {involved.map((iface) => (
              <Chip label={iface} size="small" color="primary" variant="outlined" />
            ))}
          </MDBox>
        ),
      };
    });

    if (!rows.length) {
      rows.push({
        apiName: (
          <MDTypography variant="body2" color="success">
            ✅ No duplicate APIs found
          </MDTypography>
        ),
        count: "—",
        interfaces: "—",
      });
    }

    return { columns, rows };
  }, [duplicates]);

  const comparisonTable = useMemo(() => {
    const columns = [
      { Header: "Interface", accessor: "interface", width: "18%", align: "left" },
      { Header: "Files Count", accessor: "files", align: "center" },
      { Header: "YAML Count", accessor: "yaml", align: "center" },
      { Header: "Files not in YAML", accessor: "missing", align: "left" },
      { Header: "YAML entries missing files", accessor: "extra", align: "left" },
    ];

    const formatList = (items = []) => (items && items.length > 0 ? items.join(", ") : "—");

    const rows = Object.entries(comparison).map(([iface, comp]) => ({
      interface: <Chip label={iface} size="small" color="primary" variant="outlined" />,
      files: (
        <MDTypography variant="button" fontWeight="medium">
          {comp.files_count ?? "—"}
        </MDTypography>
      ),
      yaml: (
        <MDTypography variant="button" fontWeight="medium">
          {comp.yaml_count ?? "—"}
        </MDTypography>
      ),
      missing: (
        <MDTypography variant="caption" color="text">
          {formatList(comp.missing_in_yaml)}
        </MDTypography>
      ),
      extra: (
        <MDTypography variant="caption" color="text">
          {formatList(comp.extra_in_yaml)}
        </MDTypography>
      ),
    }));

    if (!rows.length) {
      rows.push({
        interface: (
          <MDTypography variant="caption" color="text">
            No comparison data available
          </MDTypography>
        ),
        files: "—",
        yaml: "—",
        missing: "—",
        extra: "—",
      });
    }

    return { columns, rows };
  }, [comparison]);

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
            <MDTypography variant="body2" color="text.secondary" mt={2}>
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

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <div ref={reportRef}>
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
                          onClick={() => navigate("/api-sanity")}
                          sx={{ mr: 2 }}
                        >
                          <Icon sx={{ mr: 0.5 }}>arrow_back</Icon>
                          Back
                        </MDButton>
                        <MDTypography variant="h4" fontWeight="medium">
                          {report.title || "API Sanity Report"}
                        </MDTypography>
                      </MDBox>
                      <MDBox>
                        <MDTypography
                          variant="body2"
                          color="text.secondary"
                          mb={0.5}
                        >
                          Created:{" "}
                          {report.created_at
                            ? new Date(report.created_at).toLocaleString()
                            : "N/A"}
                        </MDTypography>
                        {results.base_folder && (
                          <MDTypography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            Base: {results.base_folder}
                          </MDTypography>
                        )}
                        {results.yaml_path && (
                          <MDTypography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            YAML: {results.yaml_path.split("/").pop()}
                          </MDTypography>
                        )}
                      </MDBox>
                    </MDBox>
                    <MDBox display="flex" gap={2}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        size="small"
                        onClick={handleExport}
                      >
                        <Icon sx={{ mr: 0.5 }}>picture_as_pdf</Icon>
                        Export PDF
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
                    <Grid item xs={12} sm={4}>
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
                            api
                          </Icon>
                          <MDTypography
                            variant="h3"
                            fontWeight="bold"
                            color="white"
                          >
                            {overall.total_apis}
                          </MDTypography>
                          <MDTypography variant="body2" color="white">
                            Total APIs
                          </MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
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
                            download
                          </Icon>
                          <MDTypography
                            variant="h3"
                            fontWeight="bold"
                            color="white"
                          >
                            {overall.get?.count || 0}
                          </MDTypography>
                          <MDTypography variant="body2" color="white">
                            GET APIs ({overall.get?.percent || 0}%)
                          </MDTypography>
                        </MDBox>
                      </Card>
                    </Grid>
                    <Grid item xs={12} sm={4}>
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
                            upload
                          </Icon>
                          <MDTypography
                            variant="h3"
                            fontWeight="bold"
                            color="white"
                          >
                            {overall.set?.count || 0}
                          </MDTypography>
                          <MDTypography variant="body2" color="white">
                            SET APIs ({overall.set?.percent || 0}%)
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
                        label="Summary"
                        icon={<Icon>view_module</Icon>}
                        iconPosition="start"
                      />
                      <Tab
                        label="Interfaces"
                        icon={<Icon>code</Icon>}
                        iconPosition="start"
                      />
                      <Tab
                        label="All APIs"
                        icon={<Icon>list</Icon>}
                        iconPosition="start"
                      />
                      <Tab
                        label="Duplicates"
                        icon={<Icon>content_copy</Icon>}
                        iconPosition="start"
                      />
                      <Tab
                        label="Comparison"
                        icon={<Icon>compare</Icon>}
                        iconPosition="start"
                      />
                    </Tabs>
                  </Box>

                  {/* Tab 0: Per-Interface Summary */}
                  {activeTab === 0 && (
                    <Box>
                      <DataTable
                        table={summaryTable}
                        entriesPerPage={false}
                        canSearch={false}
                        showTotalEntries={false}
                        isSorted={false}
                        noEndBorder
                      />
                    </Box>
                  )}

                  {/* Tab 1: Interfaces */}
                  {activeTab === 1 && (
                    <Box>
                      {results.interfaces && results.interfaces.length > 0 ? (
                        results.interfaces.map((ifaceName, idx) => {
                          const ifaceApis =
                            results.apis?.filter(
                              (api) => api.interface === ifaceName
                            ) || [];
                          const ifaceStats = results.summary?.interfaces?.[
                            ifaceName
                          ] || {
                            total_apis: 0,
                            get: { count: 0 },
                            set: { count: 0 },
                          };

                          return (
                            <Accordion key={idx}>
                              <AccordionSummary
                                expandIcon={<Icon>expand_more</Icon>}
                              >
                                <MDBox
                                  display="flex"
                                  alignItems="center"
                                  width="100%"
                                  justifyContent="space-between"
                                >
                                  <MDBox display="flex" alignItems="center">
                                    <Chip
                                      label={ifaceName}
                                      color="primary"
                                      size="small"
                                      sx={{ mr: 2 }}
                                    />
                                    <MDTypography
                                      variant="body2"
                                      color="text.primary"
                                    >
                                      {ifaceApis.length} APIs
                                    </MDTypography>
                                  </MDBox>
                                  <MDBox display="flex" gap={1} mr={2}>
                                    <Chip
                                      label={`GET: ${
                                        ifaceStats.get?.count || 0
                                      }`}
                                      size="small"
                                      color="info"
                                      variant="outlined"
                                    />
                                    <Chip
                                      label={`SET: ${
                                        ifaceStats.set?.count || 0
                                      }`}
                                      size="small"
                                      color="warning"
                                      variant="outlined"
                                    />
                                  </MDBox>
                                </MDBox>
                              </AccordionSummary>
                              <AccordionDetails>
                                <MDBox>
                                  <DataTable
                                    table={
                                      interfaceTables[ifaceName] || {
                                        columns: [],
                                        rows: [],
                                      }
                                    }
                                    entriesPerPage={{ defaultValue: 5, entries: [5, 10, 20] }}
                                    canSearch={false}
                                    showTotalEntries={false}
                                    isSorted={false}
                                    noEndBorder
                                  />
                                </MDBox>
                              </AccordionDetails>
                            </Accordion>
                          );
                        })
                      ) : (
                        <MDTypography variant="body2" color="text.secondary">
                          No interface data available
                        </MDTypography>
                      )}
                    </Box>
                  )}

                  {/* Tab 2: All APIs */}
                  {activeTab === 2 && (
                    <Box>
                      <DataTable
                        table={allApisTable}
                        entriesPerPage={{ defaultValue: 10, entries: [5, 10, 25, 50] }}
                        canSearch={false}
                        showTotalEntries={apis.length > 0}
                        pagination={{ variant: "gradient", color: "info" }}
                        isSorted={false}
                        noEndBorder
                      />
                    </Box>
                  )}

                  {/* Tab 3: Duplicates */}
                  {activeTab === 3 && (
                    <Box>
                      <DataTable
                        table={duplicatesTable}
                        entriesPerPage={false}
                        canSearch={false}
                        showTotalEntries={false}
                        isSorted={false}
                        noEndBorder
                      />
                    </Box>
                  )}

                  {/* Tab 4: Comparison */}
                  {activeTab === 4 && (
                    <Box>
                      <DataTable
                        table={comparisonTable}
                        entriesPerPage={{ defaultValue: 10, entries: [5, 10, 20, 50] }}
                        canSearch={false}
                        showTotalEntries={Object.keys(comparison).length > 0}
                        isSorted={false}
                        noEndBorder
                      />
                    </Box>
                  )}
                </MDBox>
              </Card>
            </Grid>
          </Grid>
        </div>
      </MDBox>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog}
        onClose={() => !isDeleting && setDeleteDialog(false)}
      >
        <DialogTitle>Delete Report</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this API Sanity report? This action
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
