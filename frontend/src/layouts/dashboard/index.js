import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import { useTheme } from "@mui/material/styles";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
// Data
import reportsLineChartData from "layouts/dashboard/data/reportsLineChartData";

// Auth context
import { useAuth } from "../../lib/auth";

const STATUS_META = {
  healthy: {
    label: "Operational",
    description: "All core services are responding as expected.",
    badgeBg: "rgba(76, 175, 80, 0.15)",
    dot: "#4caf50",
    textColor: "success",
  },
  unhealthy: {
    label: "Issues detected",
    description: "One or more services reported problems.",
    badgeBg: "rgba(244, 67, 54, 0.15)",
    dot: "#f44336",
    textColor: "error",
  },
  loading: {
    label: "Checking",
    description: "Requesting the latest health snapshot.",
    badgeBg: "rgba(33, 150, 243, 0.15)",
    dot: "#2196f3",
    textColor: "info",
  },
  unknown: {
    label: "Unknown",
    description: "Waiting for the first successful response.",
    badgeBg: "rgba(158, 158, 158, 0.15)",
    dot: "#757575",
    textColor: "text",
  },
};

// Health Card Component
function HealthCard() {
  const { apiBase } = useAuth();
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchHealth = () => {
      setLoading(true);
      fetch(`${apiBase}/health`)
        .then((r) => r.json())
        .then((data) => {
          if (!active) return;
          setHealth(data);
          setUpdatedAt(new Date());
        })
        .catch(() => {
          if (!active) return;
          setHealth({ status: "unhealthy" });
          setUpdatedAt(new Date());
        })
        .finally(() => {
          if (!active) return;
          setLoading(false);
        });
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [apiBase]);

  const statusKey =
    (health?.status || (loading ? "loading" : "unknown")).toLowerCase();
  const statusMeta = STATUS_META[statusKey] || STATUS_META.unknown;
  const metrics = Object.entries(health || {}).filter(
    ([key]) => key !== "status" && key !== "error"
  );

  const formatLabel = (label) =>
    label
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <Card>
      <MDBox p={3}>
        <MDBox
          display="flex"
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
          flexDirection={{ xs: "column", md: "row" }}
          gap={1}
          mb={2}
        >
          <MDBox display="flex" alignItems="center" gap={1.5}>
            <MDTypography variant="h6" fontWeight="medium">
              Health
            </MDTypography>
            <MDBox
              display="flex"
              alignItems="center"
              gap={1}
              px={1.5}
              py={0.5}
              borderRadius="lg"
              sx={{ backgroundColor: statusMeta.badgeBg }}
            >
              <MDBox
                component="span"
                width="10px"
                height="10px"
                borderRadius="50%"
                sx={{ backgroundColor: statusMeta.dot }}
              />
              <MDTypography
                variant="button"
                fontWeight="medium"
                color={statusMeta.textColor}
              >
                {statusMeta.label}
              </MDTypography>
            </MDBox>
          </MDBox>
          <MDTypography variant="caption" color="text">
            {loading
              ? "Checking services…"
              : updatedAt
              ? `Updated ${updatedAt.toLocaleTimeString()}`
              : "Awaiting data"}
          </MDTypography>
        </MDBox>

        <MDTypography variant="body2" color="text" mb={3}>
          {statusMeta.description}
        </MDTypography>

        {loading && (
          <MDTypography variant="button" color="info" mb={2} display="block">
            Fetching latest snapshot…
          </MDTypography>
        )}

        <MDBox
          display="grid"
          gap={2}
          gridTemplateColumns={{
            xs: "repeat(1, minmax(0, 1fr))",
            sm: "repeat(2, minmax(0, 1fr))",
          }}
        >
          {metrics.map(([key, value]) => (
            <MDBox
              key={key}
              p={2}
              borderRadius="lg"
              sx={{
                border: "1px solid",
                borderColor: "grey.200",
              }}
            >
              <MDTypography
                variant="button"
                color="text"
                sx={{ opacity: 0.7 }}
              >
                {formatLabel(key)}
              </MDTypography>
              <MDTypography variant="h6" fontWeight="medium">
                {String(value)}
              </MDTypography>
            </MDBox>
          ))}
        </MDBox>

        {!metrics.length && !loading && (
          <MDTypography variant="body2" color="text">
            No additional component details were returned.
          </MDTypography>
        )}

        {health?.error && (
          <MDBox
            mt={3}
            p={2}
            borderRadius="lg"
            sx={{
              backgroundColor: "rgba(244, 67, 54, 0.1)",
              border: "1px solid",
              borderColor: "error.main",
            }}
          >
            <MDTypography variant="button" color="error" fontWeight="medium">
              Error
            </MDTypography>
            <MDTypography variant="body2" color="error">
              {health.error}
            </MDTypography>
          </MDBox>
        )}
      </MDBox>
    </Card>
  );
}

function StatCard({ icon, label, value, change, detail }) {
  const theme = useTheme();
  const gradient =
    theme.palette.mode === "dark"
      ? "linear-gradient(135deg, rgba(120,144,156,0.25), rgba(69,90,100,0.6))"
      : "linear-gradient(135deg, rgba(25,118,210,0.08), rgba(21,101,192,0.2))";
  const changeColor =
    change && change.trim().startsWith("-") ? "error" : "success";

  return (
    <Card
      sx={{
        height: "100%",
        backgroundImage: gradient,
        border: `1px solid ${
          theme.palette.mode === "dark"
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.05)"
        }`,
      }}
    >
      <MDBox p={3} display="flex" flexDirection="column" gap={1.5}>
        <MDBox display="flex" alignItems="center" gap={1.5}>
          <MDBox
            width={44}
            height={44}
            borderRadius="lg"
            display="flex"
            alignItems="center"
            justifyContent="center"
            sx={{
              backgroundColor:
                theme.palette.mode === "dark"
                  ? "rgba(255,255,255,0.08)"
                  : "rgba(255,255,255,0.7)",
            }}
          >
            <Icon color="primary" fontSize="medium">
              {icon}
            </Icon>
          </MDBox>
          <MDBox>
            <MDTypography variant="button" color="text" sx={{ opacity: 0.8 }}>
              {label}
            </MDTypography>
            <MDTypography variant="h4" fontWeight="bold">
              {value}
            </MDTypography>
          </MDBox>
        </MDBox>
        <MDTypography variant="button" color={changeColor} fontWeight="medium">
          {change}
        </MDTypography>
        <MDTypography variant="caption" color="text">
          {detail}
        </MDTypography>
      </MDBox>
    </Card>
  );
}

function QuickActionsCard({ onNavigate }) {
  const quickLinks = [
    {
      label: "Run API Sanity",
      description: "Validate latest interface bundle & auto-generate reports.",
      icon: "api",
      path: "/api-sanity",
    },
    {
      label: "Launch Tasks Board",
      description: "Track execution progress across automation suites.",
      icon: "task_alt",
      path: "/tasks",
    },
    {
      label: "Generate Test Pack",
      description: "Spin up synthetic test data and scripts on demand.",
      icon: "science",
      path: "/test-generator",
    },
    {
      label: "Review Reports",
      description: "Deep dive into validations & share with stakeholders.",
      icon: "insights",
      path: "/reports",
    },
  ];

  return (
    <Card sx={{ height: "100%" }}>
      <MDBox p={3} display="flex" flexDirection="column" gap={2}>
        <MDBox>
          <MDTypography variant="h6" fontWeight="medium">
            Quick Actions
          </MDTypography>
          <MDTypography variant="caption" color="text">
            Navigate directly to the workflows you use most.
          </MDTypography>
        </MDBox>
        {quickLinks.map((link) => (
          <Button
            key={link.path}
            variant="outlined"
            startIcon={<Icon>{link.icon}</Icon>}
            endIcon={<Icon fontSize="small">arrow_forward</Icon>}
            onClick={() => onNavigate(link.path)}
            sx={{
              justifyContent: "flex-start",
              textTransform: "none",
              borderRadius: 2,
              borderColor: "divider",
              color: "inherit",
              "&:hover": {
                borderColor: "primary.main",
                backgroundColor: "action.hover",
              },
            }}
          >
            <MDBox textAlign="left">
              <MDTypography variant="button" fontWeight="medium" display="block">
                {link.label}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                {link.description}
              </MDTypography>
            </MDBox>
          </Button>
        ))}
      </MDBox>
    </Card>
  );
}




function Dashboard() {
  const { sales, tasks } = reportsLineChartData;
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const automationRuns = sales.datasets.data.reduce((acc, value) => acc + value, 0);
    const rollingThroughput = tasks.datasets.data
      .slice(-3)
      .reduce((acc, value) => acc + value, 0);

    return [
      {
        id: "runs",
        icon: "bolt",
        label: "Automation Runs",
        value: automationRuns.toLocaleString(),
        change: "+18% vs last sprint",
        detail: "Rolling 9-week execution volume",
      },
      {
        id: "coverage",
        icon: "radar",
        label: "Coverage",
        value: "84.5%",
        change: "+3.1% QoQ",
        detail: "APIs monitored across environments",
      },
      {
        id: "sla",
        icon: "schedule",
        label: "SLA Compliance",
        value: "99.4%",
        change: "+0.4% this week",
        detail: "Responses triaged in under 2 mins",
      },
      {
        id: "throughput",
        icon: "stacked_bar_chart",
        label: "Test Throughput",
        value: rollingThroughput.toLocaleString(),
        change: "+9% week over week",
        detail: "Latest 3-week task completion",
      },
    ];
  }, [sales.datasets.data, tasks.datasets.data]);

  const workloads = useMemo(
    () => [
      {
        label: "Regression Suites",
        value: 78,
        detail: "Next run scheduled in 2h",
        color: "info",
      },
      {
        label: "Contract Testing",
        value: 62,
        detail: "12 APIs awaiting schema updates",
        color: "success",
      },
      {
        label: "Performance & Load",
        value: 45,
        detail: "Targeting 10k RPS benchmark",
        color: "warning",
      },
      {
        label: "Bug Fix & Triage",
        value: 32,
        detail: "5 hotfixes shipping today",
        color: "error",
      },
    ],
    []
  );



  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mt={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Grid container spacing={3}>
                {stats.map((stat) => (
                  <Grid item xs={12} sm={6} lg={3} key={stat.id}>
                    <StatCard {...stat} />
                  </Grid>
                ))}
              </Grid>
            </Grid>
            <Grid item xs={12} lg={5}>
              <HealthCard />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <QuickActionsCard onNavigate={(path) => navigate(path)} />
            </Grid>
          </Grid>
        </MDBox>
      </MDBox>
    </DashboardLayout>
  );
}

export default Dashboard;
