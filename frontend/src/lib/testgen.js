import { getToken } from "./auth";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const headers = () => ({
  Authorization: `Bearer ${getToken()}`,
});

export async function generateSingleTool(toolName, toolCode) {
  const res = await fetch(`${API_BASE}/test-generator`, {
    method: "POST",
    headers: {
      ...headers(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tool_name: toolName, tool_code: toolCode }),
  });
  return await res.json();
}

export async function generateFromFolder(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/test-generator/folder`, {
    method: "POST",
    headers: headers(),
    body: formData,
  });
  return await res.json();
}

export async function listReports(folderMode = false) {
  const url = folderMode
    ? `${API_BASE}/test-generator/folder/reports`
    : `${API_BASE}/test-generator/reports`;
  const res = await fetch(url, { headers: headers() });
  return await res.json();
}

export async function refreshZipLink(reportId, folderMode = false) {
  const url = folderMode
    ? `${API_BASE}/test-generator/folder/download/${reportId}`
    : `${API_BASE}/test-generator/download/${reportId}`;
  const res = await fetch(url, { headers: headers() });
  return await res.json();
}
