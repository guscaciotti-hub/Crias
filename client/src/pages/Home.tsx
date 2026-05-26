import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bot, MessageSquare, Zap, Shield, BarChart3, CheckCircle2, ArrowRight } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = trpc.auth.login.useMutation({
    onSuccess: async (data) => {
      localStorage.setItem("atendeai_token", data.token);

      // Try to get or create workspace
      const wsId = localStorage.getItem("atendeai_wsid");
      if (!wsId) {
        // Will be handled during onboarding
      }
      navigate("/onboarding");
    },
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;
    setLoading(true);
    setError("");
    login.mutate({ email, name });
  };

  const features = [
    {
      icon: Bot,
      title: "Bots por Nicho",
      desc: "Templates prontos para clínicas, salões, restaurantes, imobiliárias e muito mais.",
    },
    {
      icon: MessageSquare,
      title: "WhatsApp Nativo",
      desc: "Conexão direta via Baileys. QR Code simples, sem APIs pagas.",
    },
    {
      icon: Zap,
      title: "Editor Visual de Fluxos",
      desc: "Monte o fluxo de atendimento do seu bot sem código.",
    },
    {
      icon: Shield,
      title: "Base de Conhecimento",
      desc: "Adicione FAQs, documentos e URLs para o bot responder com precisão.",
    },
    {
      icon: BarChart3,
      title: "Analytics em Tempo Real",
      desc: "Acompanhe conversas, handoffs e taxa de resolução.",
    },
    {
      icon: CheckCircle2,
      title: "Multi-Workspace",
      desc: "Gerencie múltiplos negócios com workspaces isolados.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">AtendêAI</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero section */}
        <section className="max-w-6xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            WhatsApp Chatbot SaaS para PMEs brasileiras
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Atenda seus clientes no{" "}
            <span className="text-primary">WhatsApp 24/7</span>
            {" "}com IA
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
            Crie um chatbot inteligente para o seu negócio em minutos. Sem código, sem complicação.
            Templates prontos para clínicas, salões, restaurantes e muito mais.
          </p>

          {/* Login form */}
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4">Comece gratuitamente</h2>
              <form onSubmit={handleLogin} className="space-y-3">
                <Input
                  placeholder="Seu nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                {error && <p className="text-destructive text-sm">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || !email || !name}>
                  {loading ? "Entrando..." : "Começar agora"}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                14 dias de trial grátis. Sem cartão de crédito.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 pb-20">
          <h2 className="text-2xl font-bold text-center mb-10">Tudo que você precisa para automatizar o atendimento</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t bg-card py-8 text-center text-sm text-muted-foreground">
        © 2025 AtendêAI. Todos os direitos reservados.
      </footer>
    </div>
  );
}
