import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Zap } from "lucide-react";

const PLAN_FEATURES: Record<string, string[]> = {
  trial: ["1 bot", "100 mensagens/mês", "10 documentos", "Suporte comunidade"],
  starter: ["1 bot", "1.000 mensagens/mês", "50 documentos", "Suporte por email"],
  pro: ["3 bots", "5.000 mensagens/mês", "Documentos ilimitados", "Suporte prioritário", "Analytics avançado"],
  business: ["Bots ilimitados", "20.000 mensagens/mês", "Tudo ilimitado", "Suporte dedicado", "SLA garantido"],
};

const PLAN_PRICES: Record<string, number> = { trial: 0, starter: 97, pro: 297, business: 697 };
const PLAN_NAMES: Record<string, string> = { trial: "Trial", starter: "Starter", pro: "Pro", business: "Business" };

export default function Billing() {
  const utils = trpc.useUtils();
  const { data: usage, isLoading } = trpc.billing.getUsage.useQuery();
  const upgrade = trpc.billing.upgradePlan.useMutation({
    onSuccess: () => utils.billing.getUsage.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-green-600" />
      </div>
    );
  }

  const limitText = (used: number, limit: number) =>
    limit === -1 ? `${used} / ∞` : `${used} / ${limit}`;

  const limitPct = (used: number, limit: number) =>
    limit === -1 ? 5 : Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">Plano & Cobrança</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie sua assinatura e uso</p>
      </div>

      {/* Current plan */}
      <Card className="mb-8 border-green-300 bg-gradient-to-br from-green-50 to-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-xs text-green-700 font-semibold uppercase tracking-wider mb-1">
                Plano atual
              </div>
              <div className="font-display text-2xl font-bold text-green-900">
                {usage?.planName}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-green-700">
                {usage?.price === 0 ? "Grátis" : `R$ ${usage?.price}`}
              </div>
              {(usage?.price ?? 0) > 0 && (
                <div className="text-xs text-green-600">/mês</div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {[
              { label: "Bots criados", used: usage?.usage.bots ?? 0, limit: usage?.limits.bots ?? 1 },
              { label: "Mensagens enviadas", used: usage?.usage.messages ?? 0, limit: usage?.limits.messages ?? 100 },
              { label: "Documentos", used: usage?.usage.docs ?? 0, limit: usage?.limits.docs ?? 10 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-green-800 font-medium">{item.label}</span>
                  <span className="text-green-900 font-semibold">
                    {limitText(item.used, item.limit)}
                  </span>
                </div>
                <div className="h-2 bg-green-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full transition-all duration-500"
                    style={{ width: `${limitPct(item.used, item.limit)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Plans */}
      <h2 className="font-display font-semibold text-gray-900 mb-4 text-lg">Todos os planos</h2>
      <div className="grid md:grid-cols-4 gap-4">
        {(["trial", "starter", "pro", "business"] as const).map((plan) => {
          const isCurrent = usage?.plan === plan;
          const isPopular = plan === "pro";
          return (
            <Card
              key={plan}
              className={`relative transition-all ${
                isCurrent
                  ? "border-green-500 ring-2 ring-green-500 shadow-md"
                  : isPopular
                  ? "border-purple-300 shadow-md"
                  : ""
              }`}
            >
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-purple-600 text-white text-xs px-2">
                    <Zap className="w-3 h-3 mr-1" /> Popular
                  </Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-green-600 text-white text-xs px-2">Plano atual</Badge>
                </div>
              )}
              <CardContent className="p-5 pt-6">
                <div className="font-display font-bold text-lg text-gray-900 mb-0.5">
                  {PLAN_NAMES[plan]}
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-bold text-gray-900">
                    {PLAN_PRICES[plan] === 0 ? "Grátis" : `R$${PLAN_PRICES[plan]}`}
                  </span>
                  {PLAN_PRICES[plan] > 0 && (
                    <span className="text-gray-400 text-xs">/mês</span>
                  )}
                </div>
                <ul className="space-y-2 mb-5">
                  {(PLAN_FEATURES[plan] ?? []).map((f, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  className={`w-full ${isPopular && !isCurrent ? "bg-purple-600 hover:bg-purple-700" : ""}`}
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || upgrade.isPending}
                  onClick={() => !isCurrent && upgrade.mutate({ plan })}
                >
                  {isCurrent
                    ? "Plano atual"
                    : upgrade.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : "Assinar"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">
        * Os pagamentos são mockados nesta versão MVP. Para produção, integre com Stripe ou Pagar.me.
      </p>
    </div>
  );
}
