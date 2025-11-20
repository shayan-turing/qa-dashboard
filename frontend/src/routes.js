// Material Dashboard 2 React layouts
import Dashboard from "layouts/dashboard";
import Reports from "layouts/reports";
import ReportDetails from "layouts/reports/details";
import Validate from "layouts/validate";
import RuleValidate from "layouts/rule-validate";
import Tasks from "layouts/tasks";
import Sanity from "layouts/sanity";
import SanityReport from "layouts/sanity/report";
import SanitySummary from "layouts/sanity/summary";
import TestGenerator from "layouts/test-generator";
import TestReports from "layouts/test-reports";

// @mui icons
import Icon from "@mui/material/Icon";
import ValidateDetails from "layouts/validate/details";
import TaskDetails from "layouts/tasks/details";
import TaskResults from "layouts/tasks/results.jsx";
import ResultsSummary from "layouts/tasks/summary";
import DataConsistencyChecker from "layouts/data-consistency";
import ApiSanityChecker from "layouts/api-sanity";

const routes = [
  {
    type: "collapse",
    name: "Dashboard",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    route: "/dashboard",
    component: <Dashboard />,
  },
  {
    type: "collapse",
    name: "Reports",
    key: "reports",
    icon: <Icon fontSize="small">assessment</Icon>,
    route: "/reports",
    component: <Reports />,
  },
  {
    type: "collapse",
    name: "Validate Tools",
    key: "validate",
    icon: <Icon fontSize="small">verified</Icon>,
    route: "/validate",
    component: <Validate />,
  },
  // {
  //   type: "collapse",
  //   name: "Tasks",
  //   key: "tasks",
  //   icon: <Icon fontSize="small">task_alt</Icon>,
  //   route: "/tasks",
  //   component: <Tasks />,
  // },
  {
    type: "collapse",
    name: "AI TestGen",
    key: "test-generator",
    icon: <Icon fontSize="small">psychology</Icon>,
    route: "/test-generator",
    component: <TestGenerator />,
  },
  {
    type: "collapse",
    name: "Test Reports",
    key: "test-generator/reports",
    icon: <Icon fontSize="small">description</Icon>,
    route: "/test-generator/reports",
    component: <TestReports />,
  },

  {
    type: "collapse",
    name: "DB Sanity",
    key: "sanity",
    icon: <Icon fontSize="small">storage</Icon>,
    route: "/sanity",
    component: <Sanity />,
  },

  {
    type: "collapse",
    name: "  Api Sanity ",
    key: "api-sanity",
    icon: <Icon fontSize="small">api</Icon>,
    route: "/api-sanity",
    component: <ApiSanityChecker />,
  },

  {
    type: "collapse",
    name: "Data consistency",
    key: "data-consistency",
    icon: <Icon fontSize="small">fact_check</Icon>,
    route: "/data-consistency",
    component: <DataConsistencyChecker />,
  },

  {
    type: "hidden",
    route: "/reports/:id",
    component: <ReportDetails />,
    key: "report-details",
  },
  {
    type: "hidden",
    route: "/validate/:id",
    component: <ValidateDetails />,
    key: "validate-details",
  },
  {
    type: "hidden",
    route: "/tasks/:id/view",
    component: <TaskDetails />,
    key: "task-details",
  },
  {
    type: "hidden",
    route: "/tasks/:id/results",
    component: <TaskResults />,
    key: "task-results",
  },
  {
    type: "hidden",
    route: "/tasks/results",
    component: <ResultsSummary />,
    key: "results-summary",
  },
  {
    type: "hidden",
    route: "/sanity/report",
    component: <SanityReport />,
    key: "sanity-report",
  },
  // {
  //   type: "hidden",
  //   route: "/sanity/summary",
  //   component: <SanitySummary />,
  //   key: "sanity-summary",
  // },
];

export default routes;
