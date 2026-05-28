import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { trpc } from "./lib/trpc";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Bots from "./pages/Bots";
import FlowEditor from "./pages/FlowEditor";
import Inbox from "./pages/Inbox";
import Knowledge from "./pages/Knowledge";
import Analytics from "./pages/Analytics";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import DashboardLayout from "./components/DashboardLayout";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("atendeai_token");
  if (!token) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("atendeai_token");
  const me = trpc.auth.me.useQuery(undefined, { enabled: !!token });
  if (!token) return <Navigate to="/" replace />;
  if (me.isLoading) return null;
  if (me.data?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route
          path="/onboarding"
          element={
            <AuthGuard>
              <Onboarding />
            </AuthGuard>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/bots"
          element={
            <AuthGuard>
              <DashboardLayout>
                <Bots />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/bots/:botId/flow"
          element={
            <AuthGuard>
              <FlowEditor />
            </AuthGuard>
          }
        />
        <Route
          path="/inbox"
          element={
            <AuthGuard>
              <DashboardLayout>
                <Inbox />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/knowledge"
          element={
            <AuthGuard>
              <DashboardLayout>
                <Knowledge />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/analytics"
          element={
            <AuthGuard>
              <DashboardLayout>
                <Analytics />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/billing"
          element={
            <AuthGuard>
              <DashboardLayout>
                <Billing />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <AuthGuard>
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminGuard>
              <DashboardLayout>
                <Admin />
              </DashboardLayout>
            </AdminGuard>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
