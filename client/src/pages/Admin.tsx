import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Building, Bot, MessageCircle, Shield } from "lucide-react";

export default function Admin() {
  const { data: stats, isLoading: loadingStats } = trpc.admin.getStats.useQuery();
  const { data: users, isLoading: loadingUsers } = trpc.admin.listUsers.useQuery();
  const { data: workspaces, isLoading: loadingWs } = trpc.admin.listWorkspaces.useQuery();

  const isLoading = loadingStats || loadingUsers || loadingWs;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Painel Admin</h1>
          <p className="text-gray-500 text-sm">Visão geral de toda a plataforma</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-green-600" />
        </div>
      ) : (
        <>
          {/* Platform stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Usuários", value: stats?.totalUsers ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
              { label: "Workspaces", value: stats?.totalWorkspaces ?? 0, icon: Building, color: "text-green-600", bg: "bg-green-50" },
              { label: "Bots criados", value: stats?.totalBots ?? 0, icon: Bot, color: "text-purple-600", bg: "bg-purple-50" },
              { label: "Total mensagens", value: stats?.totalMessages ?? 0, icon: MessageCircle, color: "text-amber-600", bg: "bg-amber-50" },
            ].map((card, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{card.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Users */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Usuários ({(users ?? []).length})</CardTitle>
              </CardHeader>
              <CardContent>
                {(users ?? []).length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">Nenhum usuário</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {(users ?? []).map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-sm font-medium text-green-700">
                            {u.name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900 leading-tight">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </div>
                        <Badge
                          className={`text-xs ${
                            u.role === "admin"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {u.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workspaces */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Workspaces ({(workspaces ?? []).length})</CardTitle>
              </CardHeader>
              <CardContent>
                {(workspaces ?? []).length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">Nenhum workspace</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {(workspaces ?? []).map((ws: any) => (
                      <div key={ws.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-700">
                            {ws.name?.[0]?.toUpperCase() ?? "W"}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-gray-900 leading-tight">{ws.name}</div>
                            <div className="text-xs text-gray-500">ID #{ws.id}</div>
                          </div>
                        </div>
                        <Badge
                          className={`text-xs capitalize ${
                            ws.plan === "business"
                              ? "bg-amber-100 text-amber-700"
                              : ws.plan === "pro"
                              ? "bg-purple-100 text-purple-700"
                              : ws.plan === "starter"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {ws.plan}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
