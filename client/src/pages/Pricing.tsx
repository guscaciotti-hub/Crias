import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, CheckCircle2, ArrowLeft } from "lucide-react";

const plans = [
  {
    name: "Trial",
    price: "Grátis",
    period: "por 14 dias",
    features: ["1 bot", "100 mensagens", "10 documentos", "Suporte por email"],
    cta: "Começar grátis",
    highlight: false,
  },
  {
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    features: ["1 bot", "1.000 mensagens/mês", "50 documentos", "Editor de fluxos", "Analytics básico"],
    cta: "Assinar Starter",
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$ 297",
    period: "/mês",
    features: ["3 bots", "5.000 mensagens/mês", "Documentos ilimitados", "Editor avançado", "Analytics completo", "Suporte prioritário"],
    cta: "Assinar Pro",
    highlight: true,
  },
  {
    name: "Business",
    price: "R$ 697",
    period: "/mês",
    features: ["Bots ilimitados", "20.000 mensagens/mês", "Documentos ilimitados", "Tudo do Pro", "API access", "Onboarding dedicado"],
    cta: "Falar com Vendas",
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold">AtendêAI</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Planos e Preços</h1>
          <p className="text-muted-foreground text-lg">
            Escolha o plano ideal para o seu negócio. Cancele quando quiser.
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={plan.highlight ? "border-primary shadow-lg" : ""}
            >
              {plan.highlight && (
                <div className="bg-primary text-primary-foreground text-xs text-center py-1 font-medium rounded-t-lg">
                  Mais Popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <div>
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm ml-1">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/">
                  <Button
                    className="w-full"
                    variant={plan.highlight ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
