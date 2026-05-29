import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard, Bot, Brain, Zap, MessageSquare, BookOpen,
  BarChart3, CreditCard, Settings, Shield, Menu, X,
  LogOut, ChevronRight
} from "lucide-react";

const navItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/agents", icon: Brain, label: "Agentes IA" },
  { path: "/flows", icon: Zap, label: "Fluxos" },
  { path: "/inbox", icon: MessageSquare, label: "Caixa de Entrada" },
  { path: "/knowledge", icon: BookOpen, label: "Base de Conhecimento" },
  { path: "/analytics", icon: BarChart3, label: "Analytics" },
  { path: "/billing", icon: CreditCard, label: "Plano & Billing" },
  { path: "/settings", icon: Settings, label: "Configurações" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const logout = trpc.auth.logout.useMutation();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!localStorage.getItem("atendeai_token"),
  });

  const handleLogout = async () => {
    await logout.mutateAsync();
    localStorage.removeItem("atendeai_token");
    localStorage.removeItem("atendeai_wsid");
    navigate("/");
  };

  const isAdmin = meQuery.data?.role === "admin";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-400 flex items-center justify-center">
            <Bot className="w-5 h-5 text-emerald-900" />
          </div>
          <span className="font-bold text-lg text-white">AtendêAI</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-emerald-500/20 text-emerald-400 font-medium"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {isAdmin && (
          <Link
            to="/admin"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              location.pathname === "/admin"
                ? "bg-emerald-500/20 text-emerald-400 font-medium"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            Admin
          </Link>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm font-semibold">
            {meQuery.data?.name?.charAt(0).toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{meQuery.data?.name ?? "Usuário"}</p>
            <p className="text-xs text-slate-400 truncate">{meQuery.data?.email ?? ""}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/5"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-sidebar text-sidebar-foreground flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 flex flex-col w-56 h-full bg-sidebar text-sidebar-foreground">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 text-slate-400"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-semibold text-foreground">AtendêAI</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
