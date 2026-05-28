import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bot, MessageSquare, Zap, Shield, BarChart3, CheckCircle2, ArrowRight } from "lucide-react";

type Mode = "home" | "register" | "login";

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("home");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      localStorage.setItem("atendeai_token", data.token);
      localStorage.removeItem("atendeai_wsid");
      setLoading(false);
      // New user (no workspace) → onboarding; existing user → dashboard
      navigate(data.hasWorkspace ? "/dashboard" : "/onboarding");
    },
    onError: (err) => {
      setError(err.message);
      setLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (mode === "register" && !name) return;
    setLoading(true);
    setError("");
    // Both register and login use the same upsert endpoint
    loginMutation.mutate({ email, name: name || email.split("@")[0] });
  };

  const features = [
    { icon: Bot, title: "Bots por Nicho", desc: "Templates prontos para clínicas, salões, restaurantes e muito mais." },
    { icon: MessageSquare, title: "WhatsApp Nativo", desc: "Conexão direta via QR Code. Sem APIs pagas." },
    { icon: Zap, title: "Editor de Fluxos", desc: "Monte o fluxo de atendimento sem código." },
    { icon: Shield, title: "Agente IA", desc: "GPT-4o mini responde naturalmente pelos seus clientes." },
    { icon: BarChart3, title: "Analytics", desc: "Acompanhe conversas, handoffs e taxa de resolução." },
    { icon: CheckCircle2, title: "Multi-Workspace", desc: "Gerencie múltiplos negócios com workspaces isolados." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">AtendêAI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </Link>
            <Button variant="outline" size="sm" onClick={() => { setMode("login"); setError(""); }}>
              Entrar
            </Button>
            <Button size="sm" onClick={() => { setMode("register"); setError(""); }}>
              Registrar
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Zap className="w-3.5 h-3.5" />
            WhatsApp Chatbot SaaS para PMEs brasileiras
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Atenda seus clientes no{" "}
            <span className="text-primary">WhatsApp 24/7</span>{" "}com IA
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
            Crie um chatbot inteligente para o seu negócio em minutos. Sem código, sem complicação.
          </p>

          {/* Auth card */}
          <Card className="max-w-md mx-auto">
            <CardContent className="p-6">
              {mode === "home" && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold mb-4">Comece agora</h2>
                  <Button className="w-full" onClick={() => setMode("register")}>
                    Criar conta grátis
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setMode("login")}>
                    Já tenho conta — Entrar
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    14 dias de trial grátis. Sem cartão de crédito.
                  </p>
                </div>
              )}

              {mode === "register" && (
                <>
                  <h2 className="text-lg font-semibold mb-4">Criar conta</h2>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input
                      placeholder="Seu nome completo"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      autoFocus
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
                      {loading ? "Criando conta..." : "Criar conta"}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <button type="button" onClick={() => setMode("login")}
                      className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
                      Já tem conta? Entrar
                    </button>
                  </form>
                </>
              )}

              {mode === "login" && (
                <>
                  <h2 className="text-lg font-semibold mb-4">Entrar</h2>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading || !email}>
                      {loading ? "Entrando..." : "Entrar"}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <button type="button" onClick={() => setMode("register")}
                      className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
                      Não tem conta? Registrar
                    </button>
                  </form>
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="max-w-6xl mx-auto px-4 pb-20">
          <h2 className="text-2xl font-bold text-center mb-10">Tudo para automatizar seu atendimento</h2>
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
