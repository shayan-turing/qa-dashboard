// Material Dashboard 2 React layouts
import Dashboard from "layouts/dashboard";
import Reports from "layouts/reports";
import Validate from "layouts/validate";
import RuleValidate from "layouts/rule-validate";
import Tasks from "layouts/tasks";
import Sanity from "layouts/sanity";
import TestGenerator from "layouts/test-generator";
import TestReports from "layouts/test-reports";
import Tables from "layouts/tables";
import Billing from "layouts/billing";
import RTL from "layouts/rtl";
import Notifications from "layouts/notifications";
import Profile from "layouts/profile";

// @mui icons
import Icon from "@mui/material/Icon";

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
  {
    type: "collapse",
    name: "Rule Validate",
    key: "Rule_validate",
    icon: <Icon fontSize="small">rule</Icon>,
    route: "/rule-validate",
    component: <RuleValidate />,
  },
  {
    type: "collapse",
    name: "Tasks",
    key: "tasks",
    icon: <Icon fontSize="small">task_alt</Icon>,
    route: "/tasks",
    component: <Tasks />,
  },
  {
    type: "collapse",
    name: "AI TestGen",
    key: "test_generator",
    icon: <Icon fontSize="small">psychology</Icon>,
    route: "/test-generator",
    component: <TestGenerator />,
  },
  {
    type: "collapse",
    name: "Test Reports",
    key: "test_report",
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
    name: "Notifications",
    key: "notifications",
    icon: <Icon fontSize="small">notifications</Icon>,
    route: "/notifications",
    component: <Notifications />,
  },
  {
    type: "collapse",
    name: "Profile",
    key: "profile",
    icon: <Icon fontSize="small">person</Icon>,
    route: "/profile",
    component: <Profile />,
  },
];

export default routes;
