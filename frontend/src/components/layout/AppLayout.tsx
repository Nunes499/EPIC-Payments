import type { ReactNode } from "react";

import Header from "./Header";
import Sidebar from "./Sidebar";

type AppLayoutProps = {
  children: ReactNode;
  hideHeader?: boolean;
};

export default function AppLayout({
  children,
  hideHeader = false,
}: AppLayoutProps) {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main">
        {!hideHeader && <Header />}

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
