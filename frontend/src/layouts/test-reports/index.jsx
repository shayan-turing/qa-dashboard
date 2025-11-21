import React, { useEffect, useMemo, useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

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

const STATUS_MAP = {
  success: "success",
  succeeded: "success",
  completed: "success",
  passed: "success",
  fail: "error",
  failed: "error",
  error: "error",
  blocked: "error",
  running: "warning",
  pending: "warning",
  processing: "warning",
  in_progress: "warning",
  queued: "warning",
};

function getNestedValue(obj, path) {
  if (!obj || typeof path !== "string") return undefined;
  return path.split(".").reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[key];
  }, obj);
}

function pickValue(obj, paths, fallback) {
  if (!obj) return fallback;
  for (const path of paths) {
    const value = getNestedValue(obj, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return fallback;
}

function deriveStatusFromResults(results) {
  if (!results || typeof results !== "object" || Array.isArray(results))
    return undefined;
  const values = Object.values(results).map((v) =>
    v === undefined || v === null ? "" : String(v).toLowerCase()
  );
  if (!values.length) return undefined;
  if (values.every((v) => ["passed", "completed", "success"].includes(v)))
    return "passed";
  if (values.some((v) => ["failed", "error"].includes(v))) return "failed";
  return values[0];
}

function normalizeStatusValue(value) {
  if (value === undefined || value === null || value === "") {
    return { label: "Unknown", normalized: "unknown" };
  }
  const label = typeof value === "string" ? value : String(value);
  return { label, normalized: label.toLowerCase() };
}

function normalizeDownloadUrl(value) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    return value.url || value.href || value.link;
  }
  return undefined;
}

function formatTimestamp(value) {
  if (!value && value !== 0) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : "—";
  }
  return date.toLocaleString();
}

function createRowFromReport(report = {}, detail = null, reportId, index = 0) {
  const detailData = detail && typeof detail === "object" ? detail : {};
  const createdAt =
    pickValue(detailData, [
      "created_at",
      "createdAt",
      "created",
      "timestamp",
      "finished_at",
      "completed_at",
    ]) ||
    pickValue(report, ["created_at", "createdAt", "created", "timestamp"]);
  const rawStatus =
    pickValue(detailData, ["status", "result", "state"]) ||
    deriveStatusFromResults(detailData.results) ||
    pickValue(report, ["status"]);
  const { label: statusLabel, normalized: normalizedStatus } =
    normalizeStatusValue(rawStatus);
  const exitCode =
    pickValue(detailData, ["exit_code", "exitCode", "code", "return_code"]) ??
    pickValue(report, ["exit_code", "exitCode", "code"]);
  const rawDownload =
    pickValue(detailData, [
      "zip_download_url",
      "zip_url",
      "download_url",
      "artifact_url",
      "zip",
    ]) ||
    pickValue(report, [
      "zip_download_url",
      "zip_url",
      "download_url",
      "artifact_url",
      "storage.zip_url",
      "results.zip_url",
    ]);
  const downloadUrl = normalizeDownloadUrl(rawDownload);
  const source =
    pickValue(detailData, ["source", "source_type", "runner"]) ||
    pickValue(report, ["source_type", "source", "inputs.source", "origin"]) ||
    "N/A";
  const testName =
    pickValue(detailData, [
      "test_name",
      "name",
      "title",
      "tool",
      "tool_name",
      "file_name",
      "module",
    ]) ||
    pickValue(report, ["title", "name"]) ||
    `Test ${index + 1}`;
  const toolName =
    pickValue(detailData, [
      "tool",
      "tool_name",
      "module",
      "file",
      "interface",
      "path",
    ]) || pickValue(report, ["tool", "tool_name"]);
  const baseTestType = pickValue(detailData, ["test_type", "type"]);
  const resultEntries =
    detailData.results &&
    typeof detailData.results === "object" &&
    !Array.isArray(detailData.results)
      ? Object.entries(detailData.results).filter(
          ([, value]) => typeof value === "string" || typeof value === "number"
        )
      : [];
  const aggregateResults = resultEntries.length
    ? resultEntries.map(([key, value]) => `${key}: ${value}`).join(" • ")
    : null;
  const testMeta = baseTestType || aggregateResults || null;

  return {
    id:
      pickValue(detailData, ["_id", "id", "uid"]) ||
      `${reportId || "report"}-${index}`,
    reportId,
    createdAt,
    statusLabel,
    normalizedStatus,
    exitCode,
    source,
    testName,
    toolName,
    testMeta,
    downloadUrl,
  };
}

function buildTestRows(reports = []) {
  if (!Array.isArray(reports)) return [];
  const rows = [];

  reports.forEach((report) => {
    if (!report) return;
    const reportId = pickValue(report, ["_id", "id", "report_id", "uid"]);
    const detailSources = [];

    const directTests = getNestedValue(report, "tests");
    if (Array.isArray(directTests)) detailSources.push(...directTests);

    const summaryDetails = getNestedValue(report, "summary.details");
    if (Array.isArray(summaryDetails)) detailSources.push(...summaryDetails);

    const resultDetails = getNestedValue(report, "results.details");
    if (Array.isArray(resultDetails)) detailSources.push(...resultDetails);

    if (Array.isArray(report.details)) detailSources.push(...report.details);

    if (!detailSources.length) {
      rows.push(createRowFromReport(report, null, reportId, rows.length));
      return;
    }

    detailSources.forEach((detail, index) => {
      rows.push(createRowFromReport(report, detail, reportId, index));
    });
  });

  return rows;
}

export default function TestReports() {
  const { apiFetch } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState({});

  // Toast state
  const [toast, setToast] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // ------------------ Fetch Reports ------------------
  async function loadReports() {
    try {
      setLoading(true);
      const res = await apiFetch("/test-generator/folder/report-test");
      if (!res.ok) throw new Error("Failed to load reports");
      const data = await res.json();
      setReports(data.items || []);
    } catch (err) {
      console.error(err);
      setToast({
        open: true,
        message: "Failed to fetch reports",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }

  // ------------------ Refresh ZIP Link ------------------
  async function handleRefreshZip(rid) {
    if (!rid) return;
    setRefreshing((r) => ({ ...r, [rid]: true }));
    try {
      const res = await apiFetch(`/test-generator/folder/download/${rid}`);
      const data = await res.json();
      if (res.ok && data.download_url) {
        setToast({
          open: true,
          message: "Refreshed signed download link",
          severity: "success",
        });
        setReports((prev) =>
          prev.map((r) => {
            if ((r._id || r.id || r.report_id) !== rid) return r;
            return { ...r, zip_download_url: data.download_url };
          })
        );
      } else {
        setToast({
          open: true,
          message: "Failed to refresh link",
          severity: "error",
        });
      }
    } catch (err) {
      console.error(err);
      setToast({
        open: true,
        message: "Error refreshing download link",
        severity: "error",
      });
    } finally {
      setRefreshing((r) => ({ ...r, [rid]: false }));
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const normalizedTests = useMemo(() => buildTestRows(reports), [reports]);

  const getStatusColor = (status) => {
    const normalized = (status || "").toString().toLowerCase();
    return STATUS_MAP[normalized] || "secondary";
  };

  const tableConfig = useMemo(() => {
    const columns = [
      { Header: "Created", accessor: "created", width: "18%", align: "left" },
      { Header: "Test", accessor: "test", width: "30%", align: "left" },
      { Header: "Status", accessor: "status", width: "12%", align: "center" },
      {
        Header: "Exit Code",
        accessor: "exitCode",
        width: "10%",
        align: "center",
      },
      { Header: "Source", accessor: "source", width: "12%", align: "center" },
      { Header: "Actions", accessor: "actions", align: "left" },
    ];

    const rows = normalizedTests.map((row) => ({
      created: (
        <MDTypography variant="body2">
          {formatTimestamp(row.createdAt)}
        </MDTypography>
      ),
      test: (
        <MDBox display="flex" flexDirection="column">
          <MDTypography variant="button" fontWeight="medium">
            {row.testName}
          </MDTypography>
          {row.toolName && row.toolName !== row.testName && (
            <MDTypography variant="caption" color="text">
              {row.toolName}
            </MDTypography>
          )}
          {row.testMeta && (
            <MDTypography variant="caption" color="text.secondary">
              {row.testMeta}
            </MDTypography>
          )}
        </MDBox>
      ),
      status: (
        <Chip
          label={row.statusLabel}
          color={getStatusColor(row.normalizedStatus)}
          size="small"
          sx={{ textTransform: "capitalize" }}
        />
      ),
      exitCode: (
        <MDTypography variant="body2" color="text">
          {row.exitCode ?? "—"}
        </MDTypography>
      ),
      source: (
        <MDTypography variant="body2" color="text">
          {row.source || "—"}
        </MDTypography>
      ),
      actions: row.downloadUrl ? (
        <MDBox display="flex" gap={1} flexWrap="wrap">
          <MDButton
            variant="gradient"
            color="info"
            size="small"
            component="a"
            href={row.downloadUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon sx={{ mr: 0.5, fontSize: "1rem" }}>download</Icon>
            Download ZIP
          </MDButton>
          {row.reportId && (
            <MDButton
              variant="gradient"
              color="secondary"
              size="small"
              onClick={() => handleRefreshZip(row.reportId)}
              disabled={refreshing[row.reportId]}
            >
              {refreshing[row.reportId] ? (
                <>
                  <CircularProgress
                    size={14}
                    color="inherit"
                    sx={{ mr: 0.5 }}
                  />
                  Refreshing...
                </>
              ) : (
                <>
                  <Icon sx={{ mr: 0.5, fontSize: "1rem" }}>refresh</Icon>
                  Refresh Link
                </>
              )}
            </MDButton>
          )}
        </MDBox>
      ) : row.reportId ? (
        <MDButton
          variant="outlined"
          color="info"
          size="small"
          onClick={() => handleRefreshZip(row.reportId)}
          disabled={refreshing[row.reportId]}
        >
          {refreshing[row.reportId] ? (
            <>
              <CircularProgress size={14} color="inherit" sx={{ mr: 0.5 }} />
              Refreshing...
            </>
          ) : (
            <>
              <Icon sx={{ mr: 0.5, fontSize: "1rem" }}>refresh</Icon>
              Refresh Link
            </>
          )}
        </MDButton>
      ) : (
        <MDTypography variant="caption" color="text" fontStyle="italic">
          No ZIP available
        </MDTypography>
      ),
    }));

    if (!rows.length && !loading) {
      rows.push({
        created: (
          <MDTypography variant="caption" color="text">
            No test reports found yet.
          </MDTypography>
        ),
        test: "—",
        status: "—",
        exitCode: "—",
        source: "—",
        actions: "—",
      });
    }

    return { columns, rows };
  }, [normalizedTests, refreshing, loading]);

  // ------------------ Render ------------------
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3}>
          {/* Header */}
          <Grid item xs={12}>
            <MDTypography variant="h4" fontWeight="medium">
              <Icon sx={{ verticalAlign: "middle", mr: 1 }}>description</Icon>
              Test Generation Reports
            </MDTypography>
          </Grid>

          {/* Reports Table */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h5" fontWeight="medium" mb={3}>
                  Unit Test Reports
                </MDTypography>
                {loading ? (
                  <MDBox
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    minHeight="200px"
                    flexDirection="column"
                    p={3}
                  >
                    <CircularProgress size={60} thickness={4} />
                    <MDTypography variant="body2" color="text" mt={2}>
                      Loading reports...
                    </MDTypography>
                  </MDBox>
                ) : (
                  <MDBox p={3}>
                    <DataTable
                      table={tableConfig}
                      entriesPerPage={{
                        defaultValue: 10,
                        entries: [5, 10, 25, 50],
                      }}
                      canSearch={false}
                      showTotalEntries={normalizedTests.length > 0}
                      pagination={{ variant: "gradient", color: "info" }}
                      noEndBorder
                    />
                  </MDBox>
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
