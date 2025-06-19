import React from "react";
import Sidebar from "./components/Sidebar";
import UserProfileButton from "./components/UserProfileButton";
import BudgetStatusDisplay from "./components/BudgetStatusDisplay";
import mainPageStyles from "../page.module.css";
import layoutStyles from "./dashboardLayout.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${mainPageStyles.container} ${layoutStyles.dashboardLayoutRoot}`}
    >
      <Sidebar />
      <div className={layoutStyles.mainContentWrapper}>
        <header className={layoutStyles.topBar}>
          <BudgetStatusDisplay />
          <UserProfileButton />
        </header>
        <main className={layoutStyles.contentArea}>{children}</main>
      </div>
    </div>
  );
}
