import React, { useEffect, useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";

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

// Health Card Component
function HealthCard() {
  const { apiBase } = useAuth();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch(`${apiBase}/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "unhealthy" }));
  }, [apiBase]);

  return (
    <Card>
      <MDBox p={3}>
        <MDTypography variant="h6" fontWeight="medium" mb={2}>
          Health
        </MDTypography>
        <MDBox
          component="pre"
          sx={{
            fontSize: "0.875rem",
            backgroundColor: "grey.100",
            p: 2,
            borderRadius: 1,
            overflow: "auto",
            fontFamily: "monospace",
          }}
        >
          {JSON.stringify(health, null, 2)}
        </MDBox>
      </MDBox>
    </Card>
  );
}

// Quick Links Card Component
function QuickLinksCard() {
  return (
    <Card>
      <MDBox p={3}>
        <MDTypography variant="h6" fontWeight="medium" mb={2}>
          Quick Links
        </MDTypography>
        <MDBox component="ul" sx={{ listStyleType: "disc", pl: 3, m: 0 }}>
          <MDTypography component="li" variant="body2" mb={1}>
            Run tool validation
          </MDTypography>
          <MDTypography component="li" variant="body2" mb={1}>
            Create & run tasks
          </MDTypography>
          <MDTypography component="li" variant="body2">
            Generate sanity reports
          </MDTypography>
        </MDBox>
      </MDBox>
    </Card>
  );
}

// Status Card Component
function StatusCard() {
  return (
    <Card>
      <MDBox p={3}>
        <MDTypography variant="h6" fontWeight="medium" mb={2}>
          Status
        </MDTypography>
        <MDTypography variant="body2" color="text">
          All systems nominal.
        </MDTypography>
      </MDBox>
    </Card>
  );
}

function Dashboard() {
  const { sales, tasks } = reportsLineChartData;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mt={4.5}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <MDBox mb={3}>
                <HealthCard />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={4}>
              <MDBox mb={3}>
                <QuickLinksCard />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={4}>
              <MDBox mb={3}>
                <StatusCard />
              </MDBox>
            </Grid>
          </Grid>
        </MDBox>
      </MDBox>
    </DashboardLayout>
  );
}

export default Dashboard;
