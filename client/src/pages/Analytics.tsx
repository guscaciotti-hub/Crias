import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, MessageCircle, Users, CheckCircle } from "lucide-react";

export default function Analytics() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const { data: stats, isLoading } = trpc.analytics.stats.useQuery({ period });

  const periodLabel = period === "7d" ? "7" : period === "30d" ? "30" : "90";

  const cards = [
    {
      label: "Total de mensagens",
      value: stats?.totalMessages ?? 0,
      icon: MessageCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total de conversas",
      value: stats?.totalConversations ?? 0,
      icon: Users,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Handoffs realizados",
      value: stats?.handoffCount ?? 0,
      icon: TrendingUp,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Taxa de resolução",
      value: `${stats?.resolutionRate ?? 0}%`,
      icon: CheckCircle,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Métricas de atendimento do seu workspace</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                period === p
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 hover:border-green-300"
              }`}
            >
              {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-green-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {cards.map((card, i) => (
              <Card key={i} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className={`w-10 h-10 ${card.bg} rounded-lg flex items-center justify-center mb-3`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                  <div className="text-sm text-gray-500 mt-0.5">{card.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">Últimos {periodLabel} dias</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo do período</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  {[
                    { label: "Mensagens recebidas", value: stats?.totalMessages ?? 0 },
                    { label: "Conversas iniciadas", value: stats?.totalConversations ?? 0 },
                    { label: "Transferências para humano", value: stats?.handoffCount ?? 0 },
                    { label: "Taxa de resolução bot", value: `${stats?.resolutionRate ?? 0}%`, highlight: true },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 border-b last:border-b-0">
                      <span className="text-sm text-gray-600">{row.label}</span>
                      <span className={`font-semibold ${row.highlight ? "text-green-600" : "text-gray-900"}`}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center">
                  {(stats?.totalConversations ?? 0) === 0 ? (
                    <div className="text-center text-gray-400">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Sem dados para este período</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-5xl font-bold text-green-600 mb-1">
                        {stats?.resolutionRate ?? 0}%
                      </div>
                      <div className="text-sm text-gray-500">taxa de resolução automática</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {(stats?.totalConversations ?? 0) - (stats?.handoffCount ?? 0)} de{" "}
                        {stats?.totalConversations ?? 0} conversas resolvidas pelo bot
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
