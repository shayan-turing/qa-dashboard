import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ThemeToggle } from "./Theme";
import { LogOut, Brain, FileText, Settings } from "lucide-react";

function cls(...a) {
  return a.filter(Boolean).join(" ");
}

export default function Navbar() {
  const { logout } = useAuth();
  const { pathname } = useLocation();

  // ✅ All your routes listed in one clean config
  const tabs = [
    ["/", "Dashboard"],
    ["/reports", "Reports"],
    ["/validate", "Validate Tools"],
    ["/rule-validate", "Rule Validate"],
    ["/tasks", "Tasks"],
    ["/sanity", "DB Sanity"],
    ["/test-generator", "AI TestGen 🧠"], // ✅ New Tab
    ["/test-generator/reports", "Test Reports"], // ✅ New Tab
  ];

  return (
    <nav className="sticky top-0 z-10 bg-white/90 backdrop-blur-md dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-3">
        {/* Left: Brand */}
        <div className="flex items-center gap-2 font-bold text-lg dark:text-white">
          <Brain className="w-5 h-5 text-blue-500" />
          <span>QA Tools</span>
        </div>

        {/* Center: Nav Tabs */}
        <div className="hidden md:flex gap-2">
          {tabs.map(([href, label]) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                to={href}
                className={cls(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active
                    ? "bg-blue-600 text-white dark:bg-blue-700"
                    : "text-gray-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right: Theme + Logout */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={logout}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {/* Mobile nav (optional) */}
      <div className="flex md:hidden overflow-x-auto px-2 pb-2">
        {tabs.map(([href, label]) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              to={href}
              className={cls(
                "px-3 py-1.5 rounded-md text-sm whitespace-nowrap mr-2",
                active
                  ? "bg-blue-600 text-white dark:bg-blue-700"
                  : "text-gray-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
