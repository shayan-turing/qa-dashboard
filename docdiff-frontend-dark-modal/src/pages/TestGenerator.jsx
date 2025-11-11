import React, { useState, useEffect, useMemo, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../lib/auth";
import toast from "react-hot-toast";

export default function TestGenerator() {
  const { accessToken } = useAuth();
  const [file, setFile] = useState(null);
  const [logs, setLogs] = useState("");
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [isStopped, setIsStopped] = useState(false);
  const logsRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Socket.io setup
  const socket = useMemo(() => {
    const url = import.meta.env.VITE_SOCKET_URL || "http://localhost:8080";
    console.log("🔌 Connecting to socket:", url);
    return io(url, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }, []);

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
      toast.success("Test generation completed!");
      setLogs((prev) => prev + "\n✅ " + (msg.message || "Done") + "\n");

      if (msg.zip_url) {
        const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8080";
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
      toast.error(msg.error || "Test generation failed");
      setLoading(false);
      setProgress(0);
    });

    return () => {
      socket.disconnect();
    };
  }, [socket, isStopped]);

  // Upload handler
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Please select a .zip file");
    if (!accessToken) return toast.error("You must be logged in");

    setLogs("");
    setProgress(0);
    setLoading(true);
    setDownloadUrl(null);
    setIsStopped(false);

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    const url = `${
      import.meta.env.VITE_API_URL || "http://localhost:8080"
    }/test-generator/folder`;

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
        toast.success("🚀 Test generation started (see live logs)");
        console.log("✅ Upload successful:", response);
      } else {
        toast.error(`❌ Upload failed: ${response.error || "unknown error"}`);
        setLoading(false);
        setProgress(0);
      }
    };

    xhr.onerror = () => {
      toast.error("❌ Upload failed (network error)");
      setLoading(false);
      setProgress(0);
    };

    xhr.send(formData);
  };

  // ✅ Stop button handler
  const handleStop = () => {
    setIsStopped(true);
    setLoading(false);
    setProgress(0);
    setLogs((prev) => prev + "\n🛑 Generation stopped by user.\n");
    toast("🛑 Test generation stopped.", { icon: "🛑" });

    // Send stop signal to backend (optional, if supported)
    try {
      socket.emit("stop_generation", { reason: "user_request" });
    } catch (err) {
      console.warn("Stop signal could not be sent:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">
        🧪 Automated Test Generator
      </h1>

      <div className="max-w-3xl mx-auto bg-gray-800 p-6 rounded-xl shadow-lg">
        <form onSubmit={handleUpload}>
          <label className="block mb-4">
            <span className="text-lg font-semibold">Upload Tools ZIP</span>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => setFile(e.target.files[0])}
              className="block w-full text-gray-300 mt-2"
            />
          </label>

          {loading && (
            <div className="w-full bg-gray-700 rounded-full h-3 mb-4">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 py-2 px-4 rounded-md font-semibold transition ${
                loading
                  ? "bg-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? `Processing (${progress}%)...` : "Generate Tests"}
            </button>

            {/* ✅ Stop Button */}
            {loading && (
              <button
                type="button"
                onClick={handleStop}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md font-semibold text-white transition"
              >
                🛑 Stop
              </button>
            )}
          </div>
        </form>

        <div className="mt-6 border-t border-gray-700 pt-4">
          <p className="text-sm text-gray-400 mb-2">
            Socket Status:{" "}
            <span
              className={socketConnected ? "text-green-400" : "text-red-400"}
            >
              {socketConnected ? "Connected" : "Disconnected"}
            </span>
          </p>

          <div
            ref={logsRef}
            className="bg-black text-sm text-green-300 font-mono p-3 rounded-lg h-96 overflow-y-auto"
            style={{ lineHeight: "1.4", fontFamily: "monospace" }}
            dangerouslySetInnerHTML={{
              __html: logs || "<em>Awaiting logs...</em>",
            }}
          />

          {downloadUrl && !isStopped && (
            <div className="text-center mt-4">
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition"
              >
                ⬇️ Download Results
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
