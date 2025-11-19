import React, { useState, useEffect, useMemo, useRef } from "react";
import { io } from "socket.io-client";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import Icon from "@mui/material/Icon";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

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

export default function TestGenerator() {
  const { accessToken, apiBase } = useAuth();

  const [file, setFile] = useState(null);
  const [logs, setLogs] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [isStopped, setIsStopped] = useState(false);
  const logsRef = useRef(null);

  // Toast state
  const [toast, setToast] = useState({ open: false, message: "", severity: "info" });

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Socket.io setup
  const socket = useMemo(() => {
    const url = process.env.VITE_SOCKET_URL || apiBase || "http://localhost:8080";
    console.log("🔌 Connecting to socket:", url);
    return io(url, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }, [apiBase]);

  // Socket event listeners
  useEffect(() => {
    socket.on("connect", () => {
      console.log("✅ Socket connected");
      setSocketConnected(true);
    });

    socket.on("disconnect", () => {
      console.warn("⚠️ Socket disconnected");
      setSocketConnected(false);
    });

    socket.on("log_line", (msg) => {
      if (!isStopped) setLogs((prev) => prev + (msg.line || "") + "\n");
    });

    socket.on("log_done", (msg) => {
      if (isStopped) return;
      console.log("✅ log_done received:", msg);
      setLoading(false);
      setProgress(100);
      setToast({ open: true, message: "Test generation completed!", severity: "success" });
      setLogs((prev) => prev + "\n✅ " + (msg.message || "Done") + "\n");
      if (msg.zip_url) {
        const baseUrl = process.env.VITE_API_URL || apiBase || "http://localhost:8080";
        const fullUrl = msg.zip_url.startsWith("http")
          ? msg.zip_url
          : `${baseUrl}${msg.zip_url.startsWith("/") ? "" : "/"}${msg.zip_url}`;
        setDownloadUrl(fullUrl);
        setLogs(
          (prev) =>
            prev +
            `\n📦 <a href="${fullUrl}" target="_blank" rel="noopener noreferrer" style="color:#3b82f6; text-decoration:underline; font-weight:bold;">⬇️ Download Results</a>\n`
        );
      }
    });

    socket.on("log_error", (msg) => {
      if (isStopped) return;
      console.error("❌ Log error:", msg);
      setLogs((prev) => prev + "\n❌ " + msg.error + "\n");
      setToast({ open: true, message: msg.error || "Test generation failed", severity: "error" });
      setLoading(false);
      setProgress(0);
    });

    return () => {
      socket.disconnect();
    };
  }, [socket, isStopped, apiBase]);

  // Upload handler
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setToast({ open: true, message: "Please select a .zip file", severity: "error" });
      return;
    }
    if (!accessToken) {
      setToast({ open: true, message: "You must be logged in", severity: "error" });
      return;
    }

    setLogs("");
    setProgress(0);
    setLoading(true);
    setDownloadUrl(null);
    setIsStopped(false);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    const url = `${apiBase}/test-generator/folder`;
    console.log("📤 Uploading ZIP to backend:", url);

    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setProgress(pct);
      }
    };

    xhr.onload = () => {
      let response = {};
      try {
        response = JSON.parse(xhr.responseText || "{}");
      } catch {
        response = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        setToast({
          open: true,
          message: "🚀 Test generation started (see live logs)",
          severity: "success",
        });
        console.log("✅ Upload successful:", response);
      } else {
        setToast({
          open: true,
          message: `Upload failed: ${response.error || "unknown error"}`,
          severity: "error",
        });
        setLoading(false);
        setProgress(0);
      }
    };

    xhr.onerror = () => {
      setToast({ open: true, message: "Upload failed (network error)", severity: "error" });
      setLoading(false);
      setProgress(0);
    };

    xhr.send(formData);
  };

  // Stop button handler
  const handleStop = () => {
    setIsStopped(true);
    setLoading(false);
    setProgress(0);
    setLogs((prev) => prev + "\n🛑 Generation stopped by user.\n");
    setToast({ open: true, message: "Test generation stopped", severity: "warning" });

    // Send stop signal to backend
    try {
      socket.emit("stop_generation", { reason: "user_request" });
    } catch (err) {
      console.warn("Stop signal could not be sent:", err);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={3}>
          {/* Header */}
          <Grid item xs={12}>
            <MDTypography variant="h4" fontWeight="medium" textAlign="center">
              <Icon sx={{ verticalAlign: "middle", mr: 1 }}>psychology</Icon>
              Automated Test Generator
            </MDTypography>
          </Grid>

          {/* Main Form Card */}
          <Grid item xs={12}>
            <Card>
              <MDBox p={3}>
                <Box component="form" onSubmit={handleUpload}>
                  <MDTypography variant="h5" fontWeight="medium" mb={3}>
                    Upload Tools ZIP
                  </MDTypography>

                  {/* File Upload */}
                  <Button
                    variant="outlined"
                    component="label"
                    fullWidth
                    sx={{ mb: 3, justifyContent: "flex-start" }}
                  >
                    <Icon sx={{ mr: 1 }}>upload_file</Icon>
                    {file ? file.name : "Choose ZIP File"}
                    <input
                      type="file"
                      hidden
                      accept=".zip"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </Button>

                  {/* Progress Bar */}
                  {loading && (
                    <MDBox mb={3}>
                      <LinearProgress variant="determinate" value={progress} />
                      <MDTypography variant="caption" color="text" mt={1}>
                        Processing: {progress}%
                      </MDTypography>
                    </MDBox>
                  )}

                  {/* Action Buttons */}
                  <Grid container spacing={2}>
                    <Grid item xs={loading ? 8 : 12}>
                      <MDButton
                        variant="gradient"
                        color="info"
                        fullWidth
                        type="submit"
                        disabled={loading}
                      >
                        <Icon sx={{ mr: 0.5 }}>play_arrow</Icon>
                        {loading ? `Processing (${progress}%)...` : "Generate Tests"}
                      </MDButton>
                    </Grid>
                    {loading && (
                      <Grid item xs={4}>
                        <MDButton variant="gradient" color="error" fullWidth onClick={handleStop}>
                          <Icon sx={{ mr: 0.5 }}>stop</Icon>
                          Stop
                        </MDButton>
                      </Grid>
                    )}
                  </Grid>
                </Box>

                {/* Socket Status */}
                <MDBox mt={3} pt={3} borderTop="1px solid" borderColor="grey.300">
                  <MDBox display="flex" alignItems="center" gap={1} mb={2}>
                    <MDTypography variant="body2" color="text">
                      Socket Status:
                    </MDTypography>
                    <Chip
                      label={socketConnected ? "Connected" : "Disconnected"}
                      color={socketConnected ? "success" : "error"}
                      size="small"
                    />
                  </MDBox>

                  {/* Live Logs Display */}
                  <MDBox
                    ref={logsRef}
                    sx={{
                      backgroundColor: "#000",
                      color: "#00ff00",
                      fontFamily: "monospace",
                      fontSize: "0.75rem",
                      p: 2,
                      borderRadius: 2,
                      height: "400px",
                      overflowY: "auto",
                      lineHeight: 1.4,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                    dangerouslySetInnerHTML={{
                      __html: logs || "<em style='color: #888;'>Awaiting logs...</em>",
                    }}
                  />

                  {/* Download Button */}
                  {downloadUrl && !isStopped && (
                    <MDBox textAlign="center" mt={3}>
                      <MDButton
                        variant="gradient"
                        color="success"
                        component="a"
                        href={downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon sx={{ mr: 0.5 }}>download</Icon>
                        Download Results
                      </MDButton>
                    </MDBox>
                  )}
                </MDBox>
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
