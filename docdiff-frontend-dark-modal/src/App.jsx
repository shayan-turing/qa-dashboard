import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ToastProvider } from "./components/Toast";
import { ThemeProvider } from "./components/Theme";
import { ModalProvider } from "./components/Modal";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import ReportDetails from "./pages/ReportDetails";
import Validate from "./pages/Validate";
import ValidateDetails from "./pages/ValidateDetails";
import RuleValidate from "./pages/RuleValidate";
import Tasks from "./pages/Tasks";
import TaskDetails from "./pages/TaskDetails";
import ResultsSummary from "./pages/ResultsSummary";
import TaskResults from "./pages/TaskResults";
import Sanity from "./pages/Sanity";
import TestGenerator from "./pages/TestGenerator";
import TestReports from "./pages/TestReports";

function Protected({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <ModalProvider>
            <Routes>
              {/* Auth */}
              <Route path="/login" element={<Login />} />

              {/* Dashboard */}
              <Route
                path="/"
                element={
                  <Protected>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </Protected>
                }
              />

              {/* Reports */}
              <Route
                path="/reports"
                element={
                  <Protected>
                    <Layout>
                      <Reports />
                    </Layout>
                  </Protected>
                }
              />
              <Route
                path="/reports/:id"
                element={
                  <Protected>
                    <Layout>
                      <ReportDetails />
                    </Layout>
                  </Protected>
                }
              />

              {/* Validation */}
              <Route
                path="/validate"
                element={
                  <Protected>
                    <Layout>
                      <Validate />
                    </Layout>
                  </Protected>
                }
              />
              <Route
                path="/validate/:id"
                element={
                  <Protected>
                    <Layout>
                      <ValidateDetails />
                    </Layout>
                  </Protected>
                }
              />
              <Route
                path="/rule-validate"
                element={
                  <Protected>
                    <Layout>
                      <RuleValidate />
                    </Layout>
                  </Protected>
                }
              />

              {/* Tasks */}
              <Route
                path="/tasks"
                element={
                  <Protected>
                    <Layout>
                      <Tasks />
                    </Layout>
                  </Protected>
                }
              />
              <Route
                path="/tasks/:id/view"
                element={
                  <Protected>
                    <Layout>
                      <TaskDetails />
                    </Layout>
                  </Protected>
                }
              />
              <Route
                path="/tasks/results"
                element={
                  <Protected>
                    <Layout>
                      <ResultsSummary />
                    </Layout>
                  </Protected>
                }
              />
              <Route
                path="/tasks/:id/results"
                element={
                  <Protected>
                    <Layout>
                      <TaskResults />
                    </Layout>
                  </Protected>
                }
              />

              {/* Sanity */}
              <Route
                path="/sanity"
                element={
                  <Protected>
                    <Layout>
                      <Sanity />
                    </Layout>
                  </Protected>
                }
              />

              {/* ✅ Test Generator Routes */}
              <Route
                path="/test-generator"
                element={
                  <Protected>
                    <Layout>
                      <TestGenerator />
                    </Layout>
                  </Protected>
                }
              />
              <Route
                path="/test-generator/reports"
                element={
                  <Protected>
                    <Layout>
                      <TestReports />
                    </Layout>
                  </Protected>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </ModalProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 dark:text-slate-100">
      <Navbar />
      <main className="max-w-6xl mx-auto p-4 space-y-6">{children}</main>
    </div>
  );
}
