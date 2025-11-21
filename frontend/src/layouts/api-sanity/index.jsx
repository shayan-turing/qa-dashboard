import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";

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

export default function ApiSanityChecker() {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [reportData, setReportData] = useState(null);

  // Reports list state
  const [reports, setReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);

  // Filters for All APIs table
  const [filterInterface, setFilterInterface] = useState("__all__");
  const [filterType, setFilterType] = useState("__all__");
  const [filterMatch, setFilterMatch] = useState("__all__");
  const [searchQuery, setSearchQuery] = useState("");

  // Toast state
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // Load reports on mount
  useEffect(() => {
    loadAllReports();
  }, []);

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

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setToast({
        open: true,
        message: "Please select a zip file first",
        severity: "warning",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await apiFetch("/api_sanity_check/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setReportData(data);
        setToast({
          open: true,
          message: "API Sanity Check completed successfully",
          severity: "success",
        });
        loadAllReports();
      } else {
        setToast({
          open: true,
          message: data.error || "Upload failed",
          severity: "error",
        });
      }
    } catch (err) {
      setToast({
        open: true,
        message: err.message || "Network error during upload",
        severity: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const loadAllReports = async () => {
    setIsLoadingReports(true);
    try {
      const res = await apiFetch("/api_sanity_check/reports");
      const data = await res.json();
      if (res.ok) {
        setReports(Array.isArray(data) ? data : data.items || []);
      }
    } catch (err) {
      console.error("Error loading reports:", err);
      setToast({
        open: true,
        message: "Error loading reports",
        severity: "error",
      });
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleViewDetail = (reportId) => {
    navigate(`/api-sanity/${reportId}`);
  };

  const handleDeleteReport = (reportId) => {
    setReportToDelete(reportId);
    setDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    if (isDeleting) return;
    setDeleteDialog(false);
    setReportToDelete(null);
  };

  const handleDelete = async () => {
    if (!reportToDelete) return;
    setIsDeleting(true);

    try {
      const res = await apiFetch(
        `/api_sanity_check/deletions/${reportToDelete}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        setToast({
          open: true,
          message: "Report deleted successfully",
          severity: "success",
        });
        loadAllReports();
        if (reportData && reportData._id === reportToDelete) {
          setReportData(null);
        }
        handleCloseDeleteDialog();
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
    }
  };

  const formatSignature = (api) => {
    const sigArgs = (api.params || [])
      .map((p) => {
        const opt = p.optional ? "?" : "";
        const ty = p.type ? `: ${p.type}` : "";
        return `${p.name}${opt}${ty}`;
      })
      .join(", ");
    return `${api.api_name}(${sigArgs})`;
  };

  const renderMismatchDetails = (api) => {
    const mm = api.param_mismatch;
    if (!mm) return "—";
    if (mm.not_in_tools_info) return "Not in tools_info.json";

    const parts = [];
    if (mm.missing_in_tools && mm.missing_in_tools.length > 0) {
      parts.push(`Missing: ${mm.missing_in_tools.join(", ")}`);
    }
    if (mm.extra_in_tools && mm.extra_in_tools.length > 0) {
      parts.push(`Extra: ${mm.extra_in_tools.join(", ")}`);
    }
    if (mm.type_or_optional_diff && mm.type_or_optional_diff.length > 0) {
      const diffs = mm.type_or_optional_diff
        .map((d) => {
          return `${d.name} (parsed: ${
            d.parsed?.optional ? "opt" : "req"
          } vs tools: ${d.tools?.optional ? "opt" : "req"})`;
        })
        .join("; ");
      parts.push(`Diff: ${diffs}`);
    }

    return parts.length ? parts.join(" | ") : "—";
  };

  // Extract data from results object
  const results = reportData?.results || reportData || {};

  const overall = results?.summary?.overall || {
    total_apis: 0,
    get: { count: 0, percent: 0 },
    set: { count: 0, percent: 0 },
  };

  const interfaces = results?.interfaces || [];
  const duplicates = results?.duplicates || [];
  const comparison = results?.interface_file_yaml_comparison || {};
  const ifaceSummary = results?.summary?.interfaces || {};

  const filteredApis = useMemo(() => {
    if (!results.apis) return [];

    const query = searchQuery.toLowerCase();

    return results.apis.filter((api) => {
      const interfaceMatch =
        filterInterface === "__all__" || api.interface === filterInterface;
      const typeMatch =
        filterType === "__all__" ||
        (api.classification || "").toLowerCase() === filterType;
      const matchStatus =
        filterMatch === "__all__" ||
        (filterMatch === "match" && api.param_match) ||
        (filterMatch === "mismatch" && !api.param_match);

      const searchMatch =
        !query ||
        (api.api_name || "").toLowerCase().includes(query) ||
        (api.interface || "").toLowerCase().includes(query) ||
        (api.params || []).some((p) =>
          (p.name || "").toLowerCase().includes(query)
        );

      return interfaceMatch && typeMatch && matchStatus && searchMatch;
    });
  }, [results, filterInterface, filterType, filterMatch, searchQuery]);

  const perInterfaceTable = useMemo(() => {
    const columns = [
      { Header: "Interface", accessor: "interface", width: "20%", align: "left" },
      { Header: "Total APIs", accessor: "total", align: "center" },
      { Header: "GET", accessor: "get", align: "center" },
      { Header: "SET", accessor: "set", align: "center" },
    ];

    const rows = Object.keys(ifaceSummary)
      .sort()
      .map((iface) => {
        const s = ifaceSummary[iface];
        return {
          interface: <Chip label={iface} size="small" variant="outlined" />,
          total: (
            <MDTypography variant="button" fontWeight="medium">
              {s.total_apis}
            </MDTypography>
          ),
          get: (
            <MDBox display="flex" justifyContent="center" alignItems="center" gap={0.5}>
              <MDTypography variant="button" fontWeight="medium">
                {s.get.count}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                ({s.get.percent?.toFixed(2)}%)
              </MDTypography>
            </MDBox>
          ),
          set: (
            <MDBox display="flex" justifyContent="center" alignItems="center" gap={0.5}>
              <MDTypography variant="button" fontWeight="medium">
                {s.set.count}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                ({s.set.percent?.toFixed(2)}%)
              </MDTypography>
            </MDBox>
          ),
        };
      });

    const hasData = rows.length > 0;

    if (!hasData) {
      rows.push({
        interface: (
          <MDTypography variant="caption" color="text">
            No interface summary available
          </MDTypography>
        ),
        total: "—",
        get: "—",
        set: "—",
      });
    }

    return { table: { columns, rows }, hasData };
  }, [ifaceSummary]);

  const duplicatesTable = useMemo(() => {
    const columns = [
      { Header: "API Name", accessor: "apiName", width: "30%", align: "left" },
      { Header: "Interfaces Involved", accessor: "interfaces", align: "left" },
    ];

    const rows = duplicates.map((dup) => ({
      apiName: (
        <Chip label={dup.api_name} size="small" color="warning" variant="outlined" />
      ),
      interfaces: (
        <MDTypography variant="caption" color="text">
          {(dup.interfaces_involved || []).join(", ")}
        </MDTypography>
      ),
    }));

    const hasData = rows.length > 0;

    if (!hasData) {
      rows.push({
        apiName: (
          <MDTypography variant="body2" color="success">
            ✅ No duplicates found
          </MDTypography>
        ),
        interfaces: "—",
      });
    }

    return { table: { columns, rows }, hasData };
  }, [duplicates]);

  const comparisonTable = useMemo(() => {
    const columns = [
      { Header: "Interface", accessor: "interface", width: "18%", align: "left" },
      { Header: "Files Count", accessor: "files", align: "center" },
      { Header: "YAML Count", accessor: "yaml", align: "center" },
      { Header: "Files not in YAML", accessor: "missing", align: "left" },
      {
        Header: "YAML entries missing files",
        accessor: "extra",
        align: "left",
      },
    ];

    const formatList = (items = []) =>
      items && items.length > 0 ? items.join(", ") : "—";

    const rows = Object.keys(comparison)
      .sort()
      .map((iface) => {
        const c = comparison[iface] || {};
        return {
          interface: <Chip label={iface} size="small" variant="outlined" />,
          files: (
            <MDTypography variant="button" fontWeight="medium">
              {c.files_count ?? "—"}
            </MDTypography>
          ),
          yaml: (
            <MDTypography variant="button" fontWeight="medium">
              {c.yaml_count ?? "—"}
            </MDTypography>
          ),
          missing: (
            <MDTypography variant="caption" color="text">
              {formatList(c.missing_in_yaml)}
            </MDTypography>
          ),
          extra: (
            <MDTypography variant="caption" color="text">
              {formatList(c.extra_in_yaml)}
            </MDTypography>
          ),
        };
      });

    const hasData = rows.length > 0;

    if (!hasData) {
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

    return { table: { columns, rows }, hasData };
  }, [comparison]);

  const apisTable = useMemo(() => {
    const columns = [
      {
        Header: "Interface",
        accessor: "interface",
        width: "12%",
        align: "left",
        Cell: ({ value }) => value?.content || value?.raw || "—",
        sortType: (rowA, rowB) =>
          (rowA.original.interface?.raw || "").localeCompare(
            rowB.original.interface?.raw || ""
          ),
      },
      {
        Header: "API Signature",
        accessor: "signature",
        width: "30%",
        align: "left",
        Cell: ({ value }) => value?.content || value?.raw || "—",
        sortType: (rowA, rowB) =>
          (rowA.original.signature?.raw || "").localeCompare(
            rowB.original.signature?.raw || ""
          ),
      },
      {
        Header: "Type",
        accessor: "type",
        align: "center",
        Cell: ({ value }) => value?.content || value?.raw || "—",
        sortType: (rowA, rowB) =>
          (rowA.original.type?.raw || "").localeCompare(
            rowB.original.type?.raw || ""
          ),
      },
      {
        Header: "Params Match",
        accessor: "match",
        align: "center",
        Cell: ({ value }) => value?.content || value?.raw || "—",
        sortType: (rowA, rowB) =>
          (rowA.original.match?.raw || 0) - (rowB.original.match?.raw || 0),
      },
      {
        Header: "Details",
        accessor: "details",
        width: "30%",
        align: "left",
        Cell: ({ value }) => (
          <MDTypography variant="caption" color="text">
            {value}
          </MDTypography>
        ),
      },
    ];

    const rows = filteredApis.map((api) => {
      const signatureText = formatSignature(api);
      const classification = (api.classification || "").toUpperCase();
      const typeColor = classification === "GET" ? "success" : "warning";

      return {
        interface: {
          raw: api.interface || "",
          content: (
            <Chip label={api.interface} size="small" variant="outlined" />
          ),
        },
        signature: {
          raw: signatureText,
          content: (
            <MDTypography
              variant="caption"
              component="code"
              sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
            >
              {signatureText}
            </MDTypography>
          ),
        },
        type: {
          raw: classification,
          content: (
            <Chip label={classification || "N/A"} size="small" color={typeColor} />
          ),
        },
        match: {
          raw: api.param_match ? 1 : 0,
          content: api.param_match ? (
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
        },
        details: renderMismatchDetails(api),
      };
    });

    const hasData = rows.length > 0;

    if (!hasData) {
      rows.push({
        interface: {
          raw: "",
          content: (
            <MDTypography variant="body2" color="text">
              No APIs match the filters
            </MDTypography>
          ),
        },
        signature: { raw: "", content: "—" },
        type: { raw: "", content: "—" },
        match: { raw: 0, content: "—" },
        details: "—",
      });
    }

    return { table: { columns, rows }, hasData };
  }, [filteredApis]);

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
                <Icon sx={{ verticalAlign: "middle", mr: 1 }}>api</Icon>
                API Sanity Check Report
              </MDTypography>
            </MDBox>
            {reportData && (
              <MDTypography variant="caption" color="text" mt={1}>
                {reportData.title && `${reportData.title} • `}
                {reportData.created_at &&
                  `Created: ${new Date(
                    reportData.created_at
                  ).toLocaleString()} • `}
                Base: {results.base_folder || "N/A"} • YAML:{" "}
                {results.yaml_path?.split("/").pop() || "get_set_APIs.yaml"}
              </MDTypography>
            )}
          </Grid>

          {/* Upload Form */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <Box component="form" onSubmit={handleUpload}>
                  <MDTypography variant="h5" fontWeight="medium" mb={2}>
                    Upload ZIP File
                  </MDTypography>
                  <MDTypography variant="body2" color="text" mb={2}>
                    Upload a ZIP file containing get_set_APIs.yaml and interface
                    folders
                  </MDTypography>

                  <Grid xs={12} lg={6}>
                    <Button
                      variant="outlined"
                      component="label"
                      fullWidth
                      sx={{ justifyContent: "flex-start" }}
                    >
                      <MDTypography variant="body2" fontWeight="small">
                        <Icon sx={{ mr: 1 }}>upload_file</Icon>
                        {selectedFile ? selectedFile.name : "Choose ZIP File"}
                      </MDTypography>
                      <input
                        type="file"
                        hidden
                        accept=".zip"
                        onChange={handleFileChange}
                      />
                    </Button>
                  </Grid>

                  <MDButton
                    variant="gradient"
                    color="info"
                    type="submit"
                    disabled={isUploading}
                    sx={{
                      mt: 3, 
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon sx={{ mr: 0.5 }}>play_arrow</Icon>
                    {isUploading ? "Processing..." : "Run API Sanity Check"}
                  </MDButton>

                  {isUploading && (
                    <MDBox mt={2}>
                      <LinearProgress />
                      <MDTypography variant="caption" color="text" mt={1}>
                        Processing API sanity check...
                      </MDTypography>
                    </MDBox>
                  )}
                </Box>
              </MDBox>
            </Card>
          </Grid>

          {/* Overall Summary Cards */}
          {reportData && (
            <>
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                  }}
                >
                  <MDBox p={3} textAlign="center">
                    <MDTypography variant="h3" fontWeight="bold" color="white">
                      {overall.total_apis}
                    </MDTypography>
                    <MDTypography variant="body2" color="white" opacity={0.8}>
                      Total APIs
                    </MDTypography>
                  </MDBox>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    background:
                      "linear-gradient(135deg, #00ff88 0%, #00d4ff 100%)",
                    color: "white",
                  }}
                >
                  <MDBox p={3} textAlign="center">
                    <MDTypography variant="h3" fontWeight="bold" color="white">
                      {overall.get.count}
                    </MDTypography>
                    <MDTypography variant="body2" color="white" opacity={0.8}>
                      GET ({overall.get.percent?.toFixed(2)}%)
                    </MDTypography>
                  </MDBox>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card
                  sx={{
                    background:
                      "linear-gradient(135deg, #ffab00 0%, #ff6b6b 100%)",
                    color: "white",
                  }}
                >
                  <MDBox p={3} textAlign="center">
                    <MDTypography variant="h3" fontWeight="bold" color="white">
                      {overall.set.count}
                    </MDTypography>
                    <MDTypography variant="body2" color="white" opacity={0.8}>
                      SET ({overall.set.percent?.toFixed(2)}%)
                    </MDTypography>
                  </MDBox>
                </Card>
              </Grid>

              {/* Per-Interface Summary */}
              <Grid item xs={12}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h5" fontWeight="medium" mb={2}>
                      <Icon
                        fontSize="small"
                        sx={{ verticalAlign: "middle", mr: 1 }}
                      >
                        dashboard
                      </Icon>
                      Per-Interface Summary
                    </MDTypography>
                    <MDTypography
                      variant="caption"
                      color="text"
                      mb={2}
                      display="block"
                    >
                      Counts and percentages of GET/SET per interface (from
                      YAML)
                    </MDTypography>
                    <DataTable
                      table={perInterfaceTable.table}
                      entriesPerPage={{ defaultValue: 8, entries: [5, 8, 15, 25, 50] }}
                      canSearch={false}
                      showTotalEntries={perInterfaceTable.hasData}
                      isSorted={false}
                      noEndBorder
                    />
                  </MDBox>
                </Card>
              </Grid>

              {/* Duplicate API Names */}
              <Grid item xs={12}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h5" fontWeight="medium" mb={2}>
                      <Icon
                        fontSize="small"
                        sx={{ verticalAlign: "middle", mr: 1 }}
                      >
                        content_copy
                      </Icon>
                      Duplicate API Names Across Interfaces
                    </MDTypography>
                    <MDTypography
                      variant="caption"
                      color="text"
                      mb={2}
                      display="block"
                    >
                      Same API name appearing in 2+ interfaces (from YAML)
                    </MDTypography>
                    <DataTable
                      table={duplicatesTable.table}
                      entriesPerPage={false}
                      canSearch={false}
                      showTotalEntries={false}
                      isSorted={false}
                      noEndBorder
                    />
                  </MDBox>
                </Card>
              </Grid>

              {/* Folder vs YAML Comparison */}
              <Grid item xs={12}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h5" fontWeight="medium" mb={2}>
                      <Icon
                        fontSize="small"
                        sx={{ verticalAlign: "middle", mr: 1 }}
                      >
                        compare_arrows
                      </Icon>
                      Folder vs YAML Checks
                    </MDTypography>
                    <MDTypography
                      variant="caption"
                      color="text"
                      mb={2}
                      display="block"
                    >
                      Files in interface folders vs entries in get_set_APIs.yaml
                    </MDTypography>
                    <DataTable
                      table={comparisonTable.table}
                      entriesPerPage={{ defaultValue: 10, entries: [5, 10, 20, 50] }}
                      canSearch={false}
                      showTotalEntries={comparisonTable.hasData}
                      isSorted={false}
                      noEndBorder
                    />
                  </MDBox>
                </Card>
              </Grid>

              {/* All APIs with Filters */}
              <Grid item xs={12}>
                <Card>
                  <MDBox p={3}>
                    <MDTypography variant="h5" fontWeight="medium" mb={3}>
                      <Icon
                        fontSize="small"
                        sx={{ verticalAlign: "middle", mr: 1 }}
                      >
                        filter_list
                      </Icon>
                      All APIs
                    </MDTypography>

                    {/* Filters */}
                    <Grid container spacing={2} mb={3}>
                      <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Interface</InputLabel>
                          <Select
                            value={filterInterface}
                            label="Interface"
                            onChange={(e) => setFilterInterface(e.target.value)}
                            sx={{height:40}}
                          >
                            <MenuItem value="__all__">All</MenuItem>
                            {interfaces.sort().map((iface) => (
                              <MenuItem key={iface} value={iface}>
                                {iface}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Type</InputLabel>
                          <Select
                            value={filterType}
                            label="Type"
                            onChange={(e) => setFilterType(e.target.value)}
                             sx={{height:40}}
                          >
                            <MenuItem value="__all__">All</MenuItem>
                            <MenuItem value="get">GET</MenuItem>
                            <MenuItem value="set">SET</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Match</InputLabel>
                          <Select
                            value={filterMatch}
                            label="Match"
                            onChange={(e) => setFilterMatch(e.target.value)}
                             sx={{height:40}}
                          >
                            <MenuItem value="__all__">All</MenuItem>
                            <MenuItem value="match">Match</MenuItem>
                            <MenuItem value="mismatch">Mismatch</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6} md={5}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Search"
                          placeholder="Search api_name, params..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          InputProps={{
                            startAdornment: <Icon sx={{ mr: 1 }}>search</Icon>,
                          }}
                        />
                      </Grid>
                    </Grid>

                    <DataTable
                      table={apisTable.table}
                      entriesPerPage={{
                        defaultValue: 10,
                        entries: [5, 10, 25, 50, 100],
                      }}
                      canSearch={false}
                      showTotalEntries={apisTable.hasData}
                      pagination={{ variant: "gradient", color: "info" }}
                      noEndBorder
                    />

                    <MDBox mt={2}>
                      <MDTypography variant="caption" color="text">
                        Showing {filteredApis.length} of{" "}
                        {results?.apis?.length || 0} APIs
                      </MDTypography>
                    </MDBox>
                  </MDBox>
                </Card>
              </Grid>
            </>
          )}

          {/* All Reports Section */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  API Sanity Reports
                </MDTypography>
                {isLoadingReports ? (
                  <MDBox
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    minHeight="200px"
                    flexDirection="column"
                  >
                    <CircularProgress size={60} thickness={4} />
                    <MDTypography variant="body2" color="text" mt={2}>
                      Loading reports...
                    </MDTypography>
                  </MDBox>
                ) : reports.length === 0 ? (
                  <MDBox
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    minHeight="200px"
                    flexDirection="column"
                  >
                    <Icon
                      fontSize="large"
                      sx={{ fontSize: 60, opacity: 0.3, mb: 2 }}
                    >
                      api
                    </Icon>
                    <MDTypography variant="body2" color="text">
                      No API sanity reports yet.
                    </MDTypography>
                  </MDBox>
                ) : (
                  <Grid container spacing={2}>
                    {reports.map((report) => (
                      <Grid item xs={12} md={6} lg={4} key={report._id}>
                        <Card variant="outlined">
                          <MDBox p={2}>
                            <MDTypography
                              variant="h6"
                              fontWeight="medium"
                              mb={1}
                            >
                              {report.title || "API Sanity Report"}
                            </MDTypography>
                            <MDTypography
                              variant="caption"
                              color="text"
                              display="block"
                              mb={1}
                            >
                              {report.created_at
                                ? new Date(report.created_at).toLocaleString()
                                : ""}
                            </MDTypography>
                            {report.results?.summary?.overall && (
                              <MDBox mb={2}>
                                <MDTypography
                                  variant="caption"
                                  color="text"
                                  display="block"
                                >
                                  <strong>Total APIs:</strong>{" "}
                                  {report.results.summary.overall.total_apis ||
                                    0}
                                </MDTypography>
                                <MDTypography
                                  variant="caption"
                                  color="text"
                                  display="block"
                                >
                                  <strong>GET:</strong>{" "}
                                  {report.results.summary.overall.get?.count ||
                                    0}{" "}
                                  • <strong>SET:</strong>{" "}
                                  {report.results.summary.overall.set?.count ||
                                    0}
                                </MDTypography>
                              </MDBox>
                            )}
                            <MDBox display="flex" gap={1}>
                              <MDButton
                                variant="gradient"
                                color="info"
                                size="small"
                                fullWidth
                                onClick={() => handleViewDetail(report._id)}
                              >
                                <Icon sx={{ mr: 0.5 }}>visibility</Icon>
                                View Detail
                              </MDButton>
                              <MDButton
                                variant="gradient"
                                color="error"
                                size="small"
                                fullWidth
                                onClick={() => handleDeleteReport(report._id)}
                              >
                                <Icon sx={{ mr: 0.5 }}>delete</Icon>
                                Delete
                              </MDButton>
                            </MDBox>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Delete Report</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this API Sanity report? This action
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseDeleteDialog} disabled={isDeleting}>
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
