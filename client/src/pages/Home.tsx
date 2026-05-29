import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bot, MessageSquare, Zap, Shield, BarChart3, CheckCircle2, ArrowRight, Mail } from "lucide-react";

type Mode = "home" | "register" | "login" | "verify_email" | "forgot_password" | "reset_password";

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("home");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");

  function onSuccess(data: { token: string | null; user: any; hasWorkspace: boolean; needsVerification?: boolean; email?: string }) {
    if (data.needsVerification) {
      setLoading(false);
      setMode("verify_email");
      setInfo("");
      return;
    }
    if (data.token) {
      localStorage.setItem("atendeai_token", data.token);
      localStorage.removeItem("atendeai_wsid");
    }
    setLoading(false);
    navigate(data.hasWorkspace ? "/dashboard" : "/onboarding");
  }

  function onError(err: { message: string }) {
    setError(err.message);
    setLoading(false);
  }

  const registerMutation        = trpc.auth.register.useMutation({ onSuccess, onError });
  const loginMutation           = trpc.auth.login.useMutation({ onSuccess, onError });
  const verifyEmailMutation     = trpc.auth.verifyEmail.useMutation({ onSuccess, onError });
  const resendMutation          = trpc.auth.resendVerification.useMutation({
    onSuccess: () => { setInfo("Código reenviado! Verifique sua caixa de entrada."); setLoading(false); },
    onError,
  });
  const requestResetMutation    = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => { setLoading(false); setMode("reset_password"); setInfo(""); },
    onError,
  });
  const resetPasswordMutation   = trpc.auth.resetPassword.useMutation({ onSuccess, onError });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    if (mode === "register")        registerMutation.mutate({ name, email, password });
    else if (mode === "login")      loginMutation.mutate({ email, password });
    else if (mode === "verify_email") verifyEmailMutation.mutate({ email, code });
    else if (mode === "forgot_password") requestResetMutation.mutate({ email });
    else if (mode === "reset_password")  resetPasswordMutation.mutate({ email, code, newPassword });
  };

  const switchMode = (m: Mode) => { setMode(m); setError(""); setInfo(""); setCode(""); setPassword(""); setNewPassword(""); };

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
            <Button variant="outline" size="sm" onClick={() => switchMode("login")}>Entrar</Button>
            <Button size="sm" onClick={() => switchMode("register")}>Registrar</Button>
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

          <Card className="max-w-md mx-auto">
            <CardContent className="p-6">

              {/* ── Home ── */}
              {mode === "home" && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold mb-4">Comece agora</h2>
                  <Button className="w-full" onClick={() => switchMode("register")}>
                    Criar conta grátis <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => switchMode("login")}>
                    Já tenho conta — Entrar
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">14 dias de trial grátis. Sem cartão de crédito.</p>
                </div>
              )}

              {/* ── Register ── */}
              {mode === "register" && (
                <>
                  <h2 className="text-lg font-semibold mb-4">Criar conta</h2>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input placeholder="Seu nome completo" value={name} onChange={e => setName(e.target.value)} required autoFocus />
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    <Input type="password" placeholder="Senha (mínimo 6 caracteres)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading || !email || !name || password.length < 6}>
                      {loading ? "Criando conta..." : "Criar conta"} <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <button type="button" onClick={() => switchMode("login")}
                      className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
                      Já tem conta? Entrar
                    </button>
                  </form>
                </>
              )}

              {/* ── Verify email ── */}
              {mode === "verify_email" && (
                <>
                  <div className="flex flex-col items-center mb-5">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold">Confirme seu e-mail</h2>
                    <p className="text-sm text-muted-foreground text-center mt-1">
                      Enviamos um código de 6 dígitos para <strong>{email}</strong>
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input
                      placeholder="000000"
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      maxLength={6}
                      className="text-center text-2xl tracking-[0.4em] font-mono"
                      autoFocus
                    />
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    {info  && <p className="text-green-600 text-sm">{info}</p>}
                    <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                      {loading ? "Verificando..." : "Confirmar"} <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <div className="flex gap-2 justify-center pt-1">
                      <button type="button"
                        onClick={() => { setLoading(true); resendMutation.mutate({ email }); }}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Reenviar código
                      </button>
                      <span className="text-xs text-muted-foreground">·</span>
                      <button type="button" onClick={() => switchMode("register")}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Voltar
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* ── Login ── */}
              {mode === "login" && (
                <>
                  <h2 className="text-lg font-semibold mb-4">Entrar</h2>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                    <Input type="password" placeholder="Sua senha" value={password} onChange={e => setPassword(e.target.value)} required />
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading || !email || !password}>
                      {loading ? "Entrando..." : "Entrar"} <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <div className="flex justify-between pt-1">
                      <button type="button" onClick={() => switchMode("register")}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Não tem conta? Registrar
                      </button>
                      <button type="button" onClick={() => switchMode("forgot_password")}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Esqueci minha senha
                      </button>
                    </div>
                  </form>
                </>
              )}

              {/* ── Forgot password ── */}
              {mode === "forgot_password" && (
                <>
                  <h2 className="text-lg font-semibold mb-2">Redefinir senha</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Informe seu e-mail e enviaremos um código para criar uma nova senha.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading || !email}>
                      {loading ? "Enviando..." : "Enviar código"} <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <button type="button" onClick={() => switchMode("login")}
                      className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
                      Voltar ao login
                    </button>
                  </form>
                </>
              )}

              {/* ── Reset password ── */}
              {mode === "reset_password" && (
                <>
                  <div className="flex flex-col items-center mb-5">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold">Nova senha</h2>
                    <p className="text-sm text-muted-foreground text-center mt-1">
                      Enviamos um código para <strong>{email}</strong>
                    </p>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-3">
                    <Input
                      placeholder="Código de 6 dígitos"
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      required
                      maxLength={6}
                      className="text-center text-2xl tracking-[0.4em] font-mono"
                      autoFocus
                    />
                    <Input type="password" placeholder="Nova senha (mínimo 6 caracteres)" value={newPassword}
                      onChange={e => setNewPassword(e.target.value)} required minLength={6} />
                    {error && <p className="text-destructive text-sm">{error}</p>}
                    <Button type="submit" className="w-full" disabled={loading || code.length !== 6 || newPassword.length < 6}>
                      {loading ? "Salvando..." : "Redefinir senha"} <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <div className="flex gap-2 justify-center pt-1">
                      <button type="button"
                        onClick={() => { setLoading(true); requestResetMutation.mutate({ email }); }}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Reenviar código
                      </button>
                      <span className="text-xs text-muted-foreground">·</span>
                      <button type="button" onClick={() => switchMode("login")}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        Voltar ao login
                      </button>
                    </div>
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
