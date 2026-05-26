import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Bot, MessageSquare, Users, AlertCircle, Plus, Wifi, WifiOff, ArrowRight } from "lucide-react";

export default function Dashboard() {
  const stats = trpc.dashboard.stats.useQuery();

  const data = stats.data;

  const statCards = [
    {
      label: "Total de Bots",
      value: data?.totalBots ?? 0,
      icon: Bot,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Mensagens Hoje",
      value: data?.messagesToday ?? 0,
      icon: MessageSquare,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Conversas Ativas",
      value: data?.activeConversations ?? 0,
      icon: Users,
      color: "text-violet-600",
      bg: "bg-violet-50",
    },
    {
      label: "Handoffs Pendentes",
      value: data?.handoffPending ?? 0,
      icon: AlertCircle,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Visão geral do seu atendimento</p>
        </div>
        <Link to="/bots">
          <Button size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Novo Bot
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.isLoading ? "..." : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Bots */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Seus Bots</CardTitle>
              <Link to="/bots" className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver todos <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : data?.bots.length === 0 ? (
              <div className="text-center py-6">
                <Bot className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum bot criado ainda</p>
                <Link to="/bots">
                  <Button size="sm" className="mt-3">Criar primeiro bot</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.bots.slice(0, 5).map(bot => (
                  <div key={bot.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{bot.name}</p>
                      <p className="text-xs text-muted-foreground">{bot.niche}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      {bot.instance?.status === "connected" ? (
                        <><Wifi className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600">Conectado</span></>
                      ) : (
                        <><WifiOff className="w-3 h-3 text-muted-foreground" /><span className="text-muted-foreground">Desconectado</span></>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent conversations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Conversas Recentes</CardTitle>
              <Link to="/inbox" className="text-sm text-primary hover:underline flex items-center gap-1">
                Ver todas <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : data?.recentConversations.length === 0 ? (
              <div className="text-center py-6">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data?.recentConversations.map(conv => (
                  <Link key={conv.id} to="/inbox" className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors">
                        Conversa #{conv.id}
                      </p>
                      <p className="text-xs text-muted-foreground">{conv.status}</p>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        conv.status === "active"
                          ? "bg-emerald-100 text-emerald-700"
                          : conv.status === "handoff"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {conv.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
