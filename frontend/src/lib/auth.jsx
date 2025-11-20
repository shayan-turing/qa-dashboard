import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { storage } from "./storage";
import PropTypes from "prop-types";
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);
// eslint-disable-next-line react/prop-types
export function AuthProvider({ children }) {
  const [apiBase, setApiBase] = useState( process.env.VITE_API_BASE|| "https://48804b2f52b8.ngrok-free.app");
  const [accessToken, setAccessToken] = useState(storage.get("accessToken") || "");
  const [refreshToken, setRefreshToken] = useState(storage.get("refreshToken") || "");
  const [user, setUser] = useState(accessToken ? { id: "me" } : null);

  useEffect(() => {
    storage.set("accessToken", accessToken);
  }, [accessToken]);
  useEffect(() => {
    storage.set("refreshToken", refreshToken);
  }, [refreshToken]);
  useEffect(() => {
    storage.set("apiBase", apiBase);
  }, [apiBase]);

  const rawFetch = useCallback(
    async (path, opts = {}) => {
      const url = path.startsWith("http") ? path : `${apiBase}${path}`;
      const headers = new Headers(opts.headers || {});
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      const res = await fetch(url, { ...opts, headers });
      return res;
    },
    [apiBase, accessToken]
  );

  const refreshAccess = useCallback(async () => {
    if (!refreshToken) throw new Error("No refresh token");
    const res = await fetch(`${apiBase}/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
    if (!res.ok) throw new Error("Refresh failed");
    const data = await res.json();
    setAccessToken(data.access_token);
    return data.access_token;
  }, [apiBase, refreshToken]);

  const apiFetch = useCallback(
    async (path, opts = {}) => {
      let res = await rawFetch(path, opts);
      if (res.status === 401 && refreshToken) {
        try {
          await refreshAccess();
        } catch {
          logout();
          throw new Error("Session expired");
        }
        res = await rawFetch(path, opts);
      }
      return res;
    },
    [rawFetch, refreshAccess, refreshToken]
  );

  const apiUpload = useCallback(
    (path, formData, { onProgress } = {}) => {
      return new Promise((resolve) => {
        const url = path.startsWith("http") ? path : `${apiBase}${path}`;
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && typeof onProgress === "function") {
            const pct = Math.round((e.loaded / e.total) * 100);
            onProgress(pct);
          }
        };

        xhr.onload = () => {
          let json = {};
          try {
            json = JSON.parse(xhr.responseText || "{}");
          } catch {
            json = {};
          }

          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            json,
          });
        };

        xhr.onerror = () => {
          resolve({
            ok: false,
            status: xhr.status || 0,
            json: { error: "Network error" },
          });
        };

        xhr.send(formData);
      });
    },
    [apiBase, accessToken]
  );

  const login = useCallback(
    async (email, password) => {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      setAccessToken(data.access_token);
      setRefreshToken(data.refresh_token);
      setUser({ id: "me", email });
      return true;
    },
    [apiBase]
  );

  const register = useCallback(
    async (email, password) => {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      return true;
    },
    [apiBase]
  );

  const logout = useCallback(() => {
    setAccessToken("");
    setRefreshToken("");
    setUser(null);
    storage.del("accessToken");
    storage.del("refreshToken");
  }, []);

  const value = useMemo(
    () => ({
      apiBase,
      setApiBase,
      accessToken,
      refreshToken,
      user,
      setUser,
      apiFetch,
      apiUpload,
      login,
      register,
      logout,
    }),
    [apiBase, accessToken, refreshToken, user, apiFetch, apiUpload, login, register, logout]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export function getToken() {
  try {
    // Maintain compatibility with AuthProvider storage keys
    return localStorage.getItem("accessToken") || sessionStorage.getItem("accessToken") || "";
  } catch (err) {
    console.error("Failed to read token:", err);
    return "";
  }
}
