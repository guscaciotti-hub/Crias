import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Users, Bot, MessageSquare, DollarSign, Brain, TrendingUp, Shield, ChevronDown } from "lucide-react";

const PLAN_COLORS: Record<string, string> = {
  trial:    "bg-gray-100 text-gray-700",
  starter:  "bg-blue-100 text-blue-700",
  pro:      "bg-purple-100 text-purple-700",
  business: "bg-emerald-100 text-emerald-700",
};
const PLAN_LABELS: Record<string, string> = {
  trial: "Trial", starter: "Starter", pro: "Pro", business: "Business",
};

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{label}</p>
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState<"overview" | "workspaces" | "users">("overview");
  const [changingPlan, setChangingPlan] = useState<number | null>(null);

  const summary    = trpc.admin.summary.useQuery();
  const workspaces = trpc.admin.listWorkspaces.useQuery();
  const users      = trpc.admin.listUsers.useQuery();
  const changePlan = trpc.admin.changePlan.useMutation({ onSuccess: () => workspaces.refetch() });

  const s = summary.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Painel Admin</h1>
          <p className="text-sm text-muted-foreground">Gestão de usuários, planos e custos de IA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(["overview", "workspaces", "users"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {tab === "overview" ? "Visão Geral" : tab === "workspaces" ? "Workspaces" : "Usuários"}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Usuários" value={String(s?.totalUsers ?? "...")} />
            <StatCard icon={Bot} label="Bots" value={String(s?.totalBots ?? "...")} />
            <StatCard icon={MessageSquare} label="Mensagens" value={String(s?.totalMessages ?? "...")} />
            <StatCard icon={Brain} label="Tokens IA"
              value={s ? ((s.totalInputTokens + s.totalOutputTokens) / 1000).toFixed(1) + "k" : "..."}
              sub="tokens totais" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Custo Total IA (GPT-4o mini)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Custo em USD</p>
                  <p className="text-3xl font-bold">${s?.totalCostUsd?.toFixed(4) ?? "0.0000"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Custo em R$</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    R$ {s?.totalCostBrl?.toFixed(2) ?? "0,00"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Tokens entrada / saída</p>
                  <p className="text-lg font-semibold">
                    {(s?.totalInputTokens ?? 0).toLocaleString()} / {(s?.totalOutputTokens ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">R$0,78/1M entrada · R$3,12/1M saída</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" /> Workspaces por Plano
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6">
                {["trial", "starter", "pro", "business"].map(plan => (
                  <div key={plan} className="text-center">
                    <p className="text-3xl font-bold">{s?.byPlan?.[plan] ?? 0}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[plan]}`}>
                      {PLAN_LABELS[plan]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Workspaces */}
      {activeTab === "workspaces" && (
        <div className="space-y-3">
          {workspaces.isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
          {workspaces.data?.map(ws => (
            <Card key={ws.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{ws.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[ws.plan]}`}>
                        {PLAN_LABELS[ws.plan]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ws.owner?.name} · {ws.owner?.email}
                    </p>
                    <div className="flex flex-wrap gap-4 text-xs pt-1">
                      <span className="text-muted-foreground">🤖 {ws.botCount} bots ({ws.aiBotCount} IA)</span>
                      <span className="text-muted-foreground">💬 {ws.messageCount.toLocaleString()} msgs</span>
                      <span className="text-muted-foreground">🧠 {ws.ai.calls} chamadas IA</span>
                      <span className="font-semibold text-emerald-700">💵 R$ {ws.ai.costBrl.toFixed(4)}</span>
                      <span className="text-muted-foreground">(${ws.ai.costUsd.toFixed(6)} USD)</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {changingPlan === ws.id ? (
                      <div className="flex gap-1 flex-wrap">
                        {(["trial", "starter", "pro", "business"] as const).map(plan => (
                          <Button key={plan} size="sm"
                            variant={ws.plan === plan ? "default" : "outline"}
                            className="text-xs h-7"
                            disabled={changePlan.isPending}
                            onClick={() => { changePlan.mutate({ workspaceId: ws.id, plan }); setChangingPlan(null); }}>
                            {PLAN_LABELS[plan]}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" className="h-7 text-xs"
                          onClick={() => setChangingPlan(null)}>✕</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="text-xs"
                        onClick={() => setChangingPlan(ws.id)}>
                        Mudar plano <ChevronDown className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Users */}
      {activeTab === "users" && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Nome</th>
                <th className="text-left p-3 font-medium">Email</th>
                <th className="text-left p-3 font-medium">Workspace</th>
                <th className="text-left p-3 font-medium">Plano</th>
                <th className="text-left p-3 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.isLoading && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {users.data?.map(u => (
                <tr key={u.id} className="border-t hover:bg-muted/20">
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3 text-muted-foreground">{u.email}</td>
                  <td className="p-3">{u.workspace?.name ?? "—"}</td>
                  <td className="p-3">
                    {u.workspace?.plan ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[u.workspace.plan]}`}>
                        {PLAN_LABELS[u.workspace.plan]}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.role === "admin" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
