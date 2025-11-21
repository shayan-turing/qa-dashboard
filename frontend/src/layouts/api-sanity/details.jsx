import React, { useState, useEffect, useRef } from "react";
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

  const results = report.results || {};
  const overall = results.summary?.overall || {
    total_apis: 0,
    get: { count: 0, percent: 0 },
    set: { count: 0, percent: 0 },
  };

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
                      {results.summary?.interfaces ? (
                        <TableContainer>
                          <Table
                            sx={{
                              tableLayout: "fixed",
                              "& th, & td": {
                                padding: "6px 8px !important",
                                verticalAlign: "middle",
                                textAlign: "center",
                              },
                              "& th:first-of-type, & td:first-of-type": {
                                textAlign: "left",
                              },
                            }}
                          >
                            <TableHead sx={{ backgroundColor: "action.hover" }}>
                              <TableRow>
                                <TableCell
                                  align="left"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    Interface
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    Total APIs
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    GET
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    SET
                                  </MDTypography>
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {Object.entries(results.summary.interfaces).map(
                                ([iface, data]) => (
                                  <TableRow key={iface} hover>
                                    <TableCell
                                      align="left"
                                      sx={{ verticalAlign: "middle" }}
                                    >
                                      <Chip
                                        label={iface}
                                        size="small"
                                        color="primary"
                                      />
                                    </TableCell>
                                    <TableCell
                                      align="center"
                                      sx={{ verticalAlign: "middle" }}
                                    >
                                      <MDTypography
                                        variant="body2"
                                        fontWeight="medium"
                                      >
                                        {data.total_apis || data.total || 0}
                                      </MDTypography>
                                    </TableCell>
                                    <TableCell
                                      align="center"
                                      sx={{ verticalAlign: "middle" }}
                                    >
                                      <MDBox>
                                        <MDTypography
                                          variant="body2"
                                          fontWeight="medium"
                                          component="span"
                                        >
                                          {data.get?.count || 0}
                                        </MDTypography>
                                        <MDTypography
                                          variant="caption"
                                          color="text.secondary"
                                          component="span"
                                          ml={0.5}
                                        >
                                          ({data.get?.percent || 0}%)
                                        </MDTypography>
                                      </MDBox>
                                    </TableCell>
                                    <TableCell
                                      align="center"
                                      sx={{ verticalAlign: "middle" }}
                                    >
                                      <MDBox>
                                        <MDTypography
                                          variant="body2"
                                          fontWeight="medium"
                                          component="span"
                                        >
                                          {data.set?.count || 0}
                                        </MDTypography>
                                        <MDTypography
                                          variant="caption"
                                          color="text.secondary"
                                          component="span"
                                          ml={0.5}
                                        >
                                          ({data.set?.percent || 0}%)
                                        </MDTypography>
                                      </MDBox>
                                    </TableCell>
                                  </TableRow>
                                )
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <MDTypography variant="body2" color="text.secondary">
                          No interface summary data available
                        </MDTypography>
                      )}
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
                                <TableContainer>
                                  <Table size="small">
                                    <TableHead>
                                      <TableRow>
                                        <TableCell
                                          align="left"
                                          sx={{ verticalAlign: "middle" }}
                                        >
                                          API Name
                                        </TableCell>
                                        <TableCell
                                          align="center"
                                          sx={{ verticalAlign: "middle" }}
                                        >
                                          Type
                                        </TableCell>
                                        <TableCell
                                          align="center"
                                          sx={{ verticalAlign: "middle" }}
                                        >
                                          Match
                                        </TableCell>
                                        <TableCell
                                          align="center"
                                          sx={{ verticalAlign: "middle" }}
                                        >
                                          Parameters
                                        </TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {ifaceApis.map((api, apiIdx) => (
                                        <TableRow key={apiIdx} hover>
                                          <TableCell
                                            align="left"
                                            sx={{ verticalAlign: "middle" }}
                                          >
                                            <MDTypography
                                              variant="body2"
                                              fontWeight="medium"
                                            >
                                              {api.api_name}
                                            </MDTypography>
                                          </TableCell>
                                          <TableCell
                                            align="center"
                                            sx={{ verticalAlign: "middle" }}
                                          >
                                            <Chip
                                              label={
                                                api.classification?.toUpperCase() ||
                                                "N/A"
                                              }
                                              size="small"
                                              color={
                                                api.classification === "get"
                                                  ? "info"
                                                  : "warning"
                                              }
                                            />
                                          </TableCell>
                                          <TableCell
                                            align="center"
                                            sx={{ verticalAlign: "middle" }}
                                          >
                                            <Chip
                                              icon={
                                                <Icon fontSize="small">
                                                  {api.param_match
                                                    ? "check_circle"
                                                    : "cancel"}
                                                </Icon>
                                              }
                                              label={
                                                api.param_match
                                                  ? "Match"
                                                  : "Mismatch"
                                              }
                                              size="small"
                                              color={
                                                api.param_match
                                                  ? "success"
                                                  : "error"
                                              }
                                            />
                                          </TableCell>
                                          <TableCell
                                            align="center"
                                            sx={{ verticalAlign: "middle" }}
                                          >
                                            <MDTypography
                                              variant="caption"
                                              color="text.secondary"
                                            >
                                              {api.params?.length || 0} params
                                            </MDTypography>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </TableContainer>
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
                      {results.apis && results.apis.length > 0 ? (
                        <TableContainer>
                          <Table>
                            <TableHead sx={{ backgroundColor: "action.hover" }}>
                              <TableRow>
                                <TableCell
                                  align="left"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    API Name
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    Interface
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    Type
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    Match
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    Parameters
                                  </MDTypography>
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {results.apis.map((api, idx) => (
                                <TableRow key={idx} hover>
                                  <TableCell
                                    align="left"
                                    sx={{ verticalAlign: "middle" }}
                                  >
                                    <MDTypography
                                      variant="body2"
                                      fontWeight="medium"
                                    >
                                      {api.api_name}
                                    </MDTypography>
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ verticalAlign: "middle" }}
                                  >
                                    <Chip
                                      label={api.interface}
                                      size="small"
                                      color="primary"
                                      variant="outlined"
                                    />
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ verticalAlign: "middle" }}
                                  >
                                    <Chip
                                      label={
                                        api.classification?.toUpperCase() ||
                                        "N/A"
                                      }
                                      size="small"
                                      color={
                                        api.classification === "get"
                                          ? "info"
                                          : "warning"
                                      }
                                    />
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ verticalAlign: "middle" }}
                                  >
                                    <Chip
                                      icon={
                                        <Icon fontSize="small">
                                          {api.param_match
                                            ? "check_circle"
                                            : "cancel"}
                                        </Icon>
                                      }
                                      label={
                                        api.param_match ? "Match" : "Mismatch"
                                      }
                                      size="small"
                                      color={
                                        api.param_match ? "success" : "error"
                                      }
                                    />
                                  </TableCell>
                                  <TableCell
                                    align="center"
                                    sx={{ verticalAlign: "middle" }}
                                  >
                                    <MDTypography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {api.params?.length || 0} params
                                      {!api.param_match &&
                                        api.param_mismatch && (
                                          <>
                                            {api.param_mismatch
                                              .not_in_tools_info && (
                                              <Chip
                                                label="Not in tools_info"
                                                size="small"
                                                color="error"
                                                sx={{ ml: 1 }}
                                              />
                                            )}
                                            {api.param_mismatch
                                              .type_or_optional_diff?.length >
                                              0 && (
                                              <Chip
                                                label={`${api.param_mismatch.type_or_optional_diff.length} diffs`}
                                                size="small"
                                                color="warning"
                                                sx={{ ml: 1 }}
                                              />
                                            )}
                                          </>
                                        )}
                                    </MDTypography>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <MDTypography variant="body2" color="text.secondary">
                          No API data available
                        </MDTypography>
                      )}
                    </Box>
                  )}

                  {/* Tab 3: Duplicates */}
                  {activeTab === 3 && (
                    <Box>
                      {results.duplicates && results.duplicates.length > 0 ? (
                        <TableContainer>
                          <Table>
                            <TableHead sx={{ backgroundColor: "action.hover" }}>
                              <TableRow>
                                <TableCell
                                  align="left"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    API Name
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  align="center"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    Count
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  align="left"
                                  sx={{ verticalAlign: "middle" }}
                                >
                                  <MDTypography
                                    variant="caption"
                                    fontWeight="bold"
                                  >
                                    Interfaces
                                  </MDTypography>
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {results.duplicates.map((dup, idx) => {
                                const interfaces =
                                  dup.interfaces_involved ||
                                  dup.interfaces ||
                                  [];
                                return (
                                  <TableRow key={idx} hover>
                                    <TableCell
                                      align="left"
                                      sx={{ verticalAlign: "middle" }}
                                    >
                                      <MDTypography
                                        variant="body2"
                                        fontWeight="medium"
                                      >
                                        {dup.api_name}
                                      </MDTypography>
                                    </TableCell>
                                    <TableCell
                                      align="center"
                                      sx={{ verticalAlign: "middle" }}
                                    >
                                      <Chip
                                        label={interfaces.length}
                                        color="warning"
                                        size="small"
                                      />
                                    </TableCell>
                                    <TableCell
                                      align="left"
                                      sx={{ verticalAlign: "middle" }}
                                    >
                                      {interfaces.map((iface, i) => (
                                        <Chip
                                          key={i}
                                          label={iface}
                                          size="small"
                                          variant="outlined"
                                          sx={{ mr: 0.5, mb: 0.5 }}
                                        />
                                      ))}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <MDBox textAlign="center" py={4}>
                          <Icon sx={{ fontSize: 60, opacity: 0.3, mb: 2 }}>
                            check_circle
                          </Icon>
                          <MDTypography variant="body2" color="text.secondary">
                            No duplicate APIs found
                          </MDTypography>
                        </MDBox>
                      )}
                    </Box>
                  )}

                  {/* Tab 4: Comparison */}
                  {activeTab === 4 && (
                    <Box>
                      {results.interface_file_yaml_comparison &&
                      Object.keys(results.interface_file_yaml_comparison)
                        .length > 0 ? (
                        Object.entries(
                          results.interface_file_yaml_comparison
                        ).map(([iface, comp], idx) => (
                          <Accordion key={idx}>
                            <AccordionSummary
                              expandIcon={<Icon>expand_more</Icon>}
                            >
                              <MDBox
                                display="flex"
                                alignItems="center"
                                width="100%"
                              >
                                <Chip
                                  label={iface}
                                  color="primary"
                                  size="small"
                                  sx={{ mr: 2 }}
                                />
                                <MDTypography
                                  variant="body2"
                                  color="text.primary"
                                >
                                  Comparison Data
                                </MDTypography>
                              </MDBox>
                            </AccordionSummary>
                            <AccordionDetails>
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
                                  style={{ margin: 0, whiteSpace: "pre-wrap" }}
                                >
                                  {JSON.stringify(comp, null, 2)}
                                </pre>
                              </Box>
                            </AccordionDetails>
                          </Accordion>
                        ))
                      ) : (
                        <MDTypography variant="body2" color="text.secondary">
                          No comparison data available
                        </MDTypography>
                      )}
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
