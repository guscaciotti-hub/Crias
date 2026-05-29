import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Bot, Plus, Wifi, WifiOff, Zap, Trash2, QrCode, Brain, X, Send,
  Bell, PhoneCall, Sparkles, Settings2, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

type BotWithInstance = {
  id: number; name: string; businessName: string; businessDescription?: string | null;
  agentMode: string; aiSystemPrompt?: string | null; systemPrompt?: string | null;
  tone: string; alertNumbers?: string[] | null; forbiddenTopics?: string[] | null;
  instance: { status: string } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT EDITOR MODAL
// ─────────────────────────────────────────────────────────────────────────────
function AgentEditorModal({ bot, onClose }: { bot: BotWithInstance; onClose: () => void }) {
  const [prompt, setPrompt]       = useState(bot.aiSystemPrompt ?? "");
  const [desc, setDesc]           = useState(bot.businessDescription ?? "");
  const [tone, setTone]           = useState<"formal"|"friendly"|"professional"|"casual">(bot.tone as any ?? "friendly");
  const [doRules, setDoRules]     = useState(bot.systemPrompt ?? "");
  const [dontRules, setDontRules] = useState((bot.forbiddenTopics ?? []).join("\n"));
  const [alertNumbers, setAlertNumbers] = useState<string[]>(bot.alertNumbers ?? []);
  const [alertInput, setAlertInput]     = useState("");
  const [mode, setMode]           = useState<"flow"|"ai">(bot.agentMode as any ?? "ai");
  const [chatMsg, setChatMsg]     = useState("");
  const [chatLog, setChatLog]     = useState<{ role: string; text: string }[]>([]);
  const [syncBanner, setSyncBanner] = useState(false);
  const [expandTest, setExpandTest] = useState(false);
  const savedConfig = useRef({ tone, doRules, dontRules, desc });

  // Show sync banner when config drifts from last saved state
  useEffect(() => {
    const c = savedConfig.current;
    setSyncBanner(
      tone !== c.tone || doRules !== c.doRules || dontRules !== c.dontRules || desc !== c.desc
    );
  }, [tone, doRules, dontRules, desc]);

  const update         = trpc.bots.update.useMutation({ onSuccess: onClose });
  const genPrompt      = trpc.bots.generatePrompt.useMutation({
    onSuccess: (data) => {
      setPrompt(data.aiSystemPrompt);
      savedConfig.current = { tone, doRules, dontRules, desc };
      setSyncBanner(false);
    },
  });
  const testAI = trpc.bots.testAI.useMutation({
    onSuccess: (data) => setChatLog(l => [...l, { role: "bot", text: data.reply }]),
  });

  const sendTest = () => {
    if (!chatMsg.trim()) return;
    setChatLog(l => [...l, { role: "user", text: chatMsg }]);
    testAI.mutate({ botId: bot.id, message: chatMsg });
    setChatMsg("");
  };

  const addAlert = () => {
    const n = alertInput.replace(/\D/g, "");
    if (n.length >= 10 && !alertNumbers.includes(n)) setAlertNumbers(p => [...p, n]);
    setAlertInput("");
  };

  const handleSave = () => {
    update.mutate({
      id: bot.id,
      agentMode: mode,
      aiSystemPrompt: prompt,
      systemPrompt: doRules,
      businessDescription: desc,
      tone,
      forbiddenTopics: dontRules.split("\n").map(s => s.trim()).filter(Boolean),
      alertNumbers,
    });
  };

  const tones = [
    { value: "friendly",     label: "Amigável" },
    { value: "professional", label: "Profissional" },
    { value: "formal",       label: "Formal" },
    { value: "casual",       label: "Casual" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-background w-full max-w-3xl max-h-[92vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold">{bot.name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Mode */}
          <div>
            <p className="text-sm font-medium mb-2">Modo de atendimento</p>
            <div className="grid grid-cols-2 gap-3">
              {([["flow", Zap, "Fluxo", "Menus e botões fixos"], ["ai", Brain, "Agente IA", "GPT responde livremente"]] as const).map(([val, Icon, label, desc2]) => (
                <button key={val} onClick={() => setMode(val)}
                  className={`p-3 rounded-xl border text-left transition-all ${mode === val ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <Icon className="w-4 h-4 text-primary mb-1" />
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc2}</p>
                </button>
              ))}
            </div>
          </div>

          {mode === "ai" && (<>

            {/* ── Prompt Principal ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">Prompt Principal</p>
                <span className="text-xs text-muted-foreground">Fonte do comportamento do agente</span>
              </div>
              <textarea
                className="w-full border rounded-xl p-3 text-sm min-h-[160px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background font-mono"
                placeholder={"Você é a Ana, assistente virtual da [Empresa]. Responda de forma amigável, ajude com dúvidas sobre produtos/serviços. Se o cliente pedir para falar com humano, informe que vai transferir."}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>

            {/* Sync banner */}
            {syncBanner && (
              <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-sm text-amber-800">Detectamos alterações na configuração. Deseja atualizar o prompt automaticamente?</p>
                <Button size="sm" variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
                  disabled={genPrompt.isPending}
                  onClick={() => genPrompt.mutate({ botId: bot.id, businessDescription: desc, tone, doRules, dontRules })}>
                  {genPrompt.isPending ? <><RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Gerando...</> : <><RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar Prompt</>}
                </Button>
              </div>
            )}

            {/* ── Conhecimento ── */}
            <div>
              <p className="text-sm font-semibold mb-2">Conhecimento da Empresa</p>
              <textarea
                className="w-full border rounded-xl p-3 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                placeholder="Descreva o negócio, serviços, horários, diferenciais... Quanto mais detalhes, melhor o agente responde."
                value={desc}
                onChange={e => setDesc(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Para documentos e PDFs, use a seção <Link to="/knowledge" className="text-primary hover:underline">Base de Conhecimento</Link>.
              </p>
            </div>

            {/* ── Personalidade ── */}
            <div>
              <p className="text-sm font-semibold mb-2">Personalidade</p>
              <div className="flex flex-wrap gap-2">
                {tones.map(t => (
                  <button key={t.value} onClick={() => setTone(t.value)}
                    className={`px-4 py-1.5 rounded-full text-sm border transition-all ${tone === t.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Regras ── */}
            <div>
              <p className="text-sm font-semibold mb-3">Regras</p>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-green-700 mb-1.5">✅ O que fazer</p>
                  <textarea
                    className="w-full border border-green-200 rounded-xl p-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-green-300 bg-background"
                    placeholder={"Sempre se apresentar pelo nome\nResponder sobre horários e preços\nAgendar consultas"}
                    value={doRules}
                    onChange={e => setDoRules(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-red-700 mb-1.5">🚫 O que NÃO fazer</p>
                  <textarea
                    className="w-full border border-red-200 rounded-xl p-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-red-300 bg-background"
                    placeholder={"Dar diagnósticos médicos\nFalar sobre concorrentes\nFornece dados pessoais de clientes"}
                    value={dontRules}
                    onChange={e => setDontRules(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Uma regra por linha.</p>
            </div>

            {/* ── Alertas handoff ── */}
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5 mb-1">
                <Bell className="w-4 h-4 text-primary" /> Alertas de handoff
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                Quando o bot transferir para humano, esses números recebem aviso no WhatsApp.
              </p>
              <div className="flex gap-2 mb-2">
                <Input placeholder="Ex: 5511999998888" value={alertInput}
                  onChange={e => setAlertInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAlert())}
                  className="text-sm" />
                <Button type="button" size="sm" variant="outline" onClick={addAlert}>Adicionar</Button>
              </div>
              {alertNumbers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {alertNumbers.map(n => (
                    <span key={n} className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-xs">
                      <PhoneCall className="w-3 h-3" />{n}
                      <button onClick={() => setAlertNumbers(p => p.filter(x => x !== n))} className="ml-0.5 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Testar agente ── */}
            <div>
              <button
                onClick={() => setExpandTest(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold w-full text-left">
                <Send className="w-4 h-4 text-primary" />
                Testar Agente
                {expandTest ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
              </button>
              {expandTest && (
                <div className="mt-3 border rounded-xl overflow-hidden">
                  <div className="bg-muted/30 p-3 min-h-[140px] max-h-[220px] overflow-y-auto space-y-2">
                    {chatLog.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center mt-8">Envie uma mensagem para testar o agente</p>
                    )}
                    {chatLog.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] px-3 py-1.5 rounded-xl text-sm ${
                          m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {testAI.isPending && (
                      <div className="flex justify-start">
                        <div className="bg-card border px-3 py-1.5 rounded-xl text-sm text-muted-foreground">Digitando...</div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 p-2 border-t">
                    <Input placeholder="Digite uma mensagem de teste..." value={chatMsg}
                      onChange={e => setChatMsg(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendTest()}
                      className="text-sm" />
                    <Button size="sm" onClick={sendTest} disabled={testAI.isPending || !chatMsg.trim()}>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

          </>)}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-card shrink-0 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button className="flex-1" disabled={update.isPending} onClick={handleSave}>
            {update.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE MODAL
// ─────────────────────────────────────────────────────────────────────────────
function CreateModal({ onCreated, onClose }: {
  onCreated: (bot: BotWithInstance) => void;
  onClose: () => void;
}) {
  type Step = "choose" | "ai_form" | "manual_form";
  const [step, setStep]         = useState<Step>("choose");
  const [businessName, setName] = useState("");
  const [description, setDesc]  = useState("");
  const [error, setError]       = useState("");

  const createWithAI = trpc.bots.createWithAI.useMutation({
    onSuccess: (bot) => onCreated(bot as any),
    onError: (e) => { setError(e.message); },
  });
  const createBlank = trpc.bots.createBlank.useMutation({
    onSuccess: (bot) => onCreated(bot as any),
    onError: (e) => setError(e.message),
  });

  const loading = createWithAI.isPending || createBlank.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">
            {step === "choose" ? "Criar novo agente"
              : step === "ai_form" ? "✨ Assistente de Criação"
              : "🎯 Controle Total"}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Step 1 — Choose */}
          {step === "choose" && (
            <div className="grid gap-3">
              <button onClick={() => setStep("ai_form")}
                className="w-full p-4 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all text-left group">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-semibold">✨ Assistente de Criação</span>
                  <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Recomendado</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  A IA cria automaticamente o prompt, saudação e regras com base na descrição do seu negócio. Pronto em menos de 2 minutos.
                </p>
              </button>
              <button onClick={() => setStep("manual_form")}
                className="w-full p-4 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all text-left">
                <div className="flex items-center gap-2 mb-1">
                  <Settings2 className="w-5 h-5 text-primary" />
                  <span className="font-semibold">🎯 Controle Total</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure manualmente o prompt, personalidade e regras do agente desde o início. Para usuários avançados.
                </p>
              </button>
            </div>
          )}

          {/* Step 2a — AI form */}
          {step === "ai_form" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome da empresa</label>
                <Input placeholder="Ex: Clínica Vida Saudável" value={businessName}
                  onChange={e => setName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descrição da empresa</label>
                <textarea
                  className="w-full border rounded-xl p-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                  placeholder="Ex: Somos uma clínica odontológica especializada em implantes e ortodontia em Santos, SP. Atendemos de segunda a sábado das 8h às 18h."
                  value={description}
                  onChange={e => setDesc(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Quanto mais detalhes, melhor o agente gerado.
                </p>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep("choose")} className="flex-1">Voltar</Button>
                <Button
                  className="flex-1"
                  disabled={loading || !businessName || description.length < 10}
                  onClick={() => { setError(""); createWithAI.mutate({ businessName, businessDescription: description }); }}>
                  {loading
                    ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Gerando com IA...</>
                    : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Criar Agente</>}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2b — Manual form */}
          {step === "manual_form" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome da empresa</label>
                <Input placeholder="Ex: Imobiliária Top" value={businessName}
                  onChange={e => setName(e.target.value)} autoFocus />
              </div>
              <p className="text-sm text-muted-foreground">
                O agente será criado com todos os campos em branco para você configurar manualmente.
              </p>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep("choose")} className="flex-1">Voltar</Button>
                <Button
                  className="flex-1"
                  disabled={loading || !businessName}
                  onClick={() => { setError(""); createBlank.mutate({ businessName }); }}>
                  {loading ? "Criando..." : <><Settings2 className="w-3.5 h-3.5 mr-1.5" />Criar e Configurar</>}
                </Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QR MODAL (unchanged)
// ─────────────────────────────────────────────────────────────────────────────
function QRModal({ botId, onClose }: { botId: number; onClose: () => void }) {
  type Step = "select" | "phone_input" | "qr" | "pairing";
  const [step, setStep] = useState<Step>("select");
  const [phone, setPhone] = useState("");
  const [timedOut, setTimedOut] = useState(false);

  const isPolling = step === "qr" || step === "pairing";
  const statusQuery = trpc.whatsapp.status.useQuery({ botId }, { refetchInterval: isPolling ? 2000 : false });
  const generateQRMut = trpc.whatsapp.generateQR.useMutation({ onSuccess: () => { setStep("qr"); setTimedOut(false); } });
  const requestPairingMut = trpc.whatsapp.requestPairing.useMutation({ onSuccess: () => setStep("pairing") });

  const { status, qr, pairingCode, lastError } = statusQuery.data ?? {};
  const connected = status === "connected";
  const isReconnecting = status === "reconnecting";
  const isError = status === "error";

  useEffect(() => {
    if (step !== "qr") return;
    const t = setTimeout(() => setTimedOut(true), 30000);
    return () => clearTimeout(t);
  }, [step]);
  useEffect(() => { if (qr || connected) setTimedOut(false); }, [qr, connected]);
  useEffect(() => {
    if (!connected) return;
    const t = setTimeout(onClose, 1800);
    return () => clearTimeout(t);
  }, [connected, onClose]);

  const failed = isPolling && (isError || (step === "qr" && timedOut && !qr && !connected && !isReconnecting));
  const formatCode = (code: string) => { const c = code.replace(/-/g, ""); return c.length >= 8 ? `${c.slice(0, 4)}-${c.slice(4)}` : code; };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">
            {connected ? "✅ Conectado!" : failed ? "❌ Falha" : step === "select" ? "Conectar WhatsApp"
              : step === "phone_input" ? "Código de Pareamento" : step === "qr" ? "Escanear QR" : "Código de Pareamento"}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected && (
            <div className="py-6 text-center">
              <p className="text-emerald-600 font-semibold text-lg">WhatsApp conectado!</p>
              <p className="text-sm text-muted-foreground mt-1">Fechando em instantes...</p>
            </div>
          )}
          {!connected && failed && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">A conexão foi rejeitada pelo WhatsApp.</p>
              {lastError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-mono text-red-700">Código: <strong>{lastError.code}</strong></p>
                  <p className="text-xs font-mono text-red-700 break-words">{lastError.reason}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setStep("select"); setTimedOut(false); }}>Voltar</Button>
                <Button className="flex-1" onClick={() => step === "qr" ? generateQRMut.mutate({ botId }) : requestPairingMut.mutate({ botId, phoneNumber: phone })}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}
          {!connected && !failed && step === "select" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">Escolha como conectar:</p>
              <button onClick={() => generateQRMut.mutate({ botId })} disabled={generateQRMut.isPending}
                className="w-full p-4 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-50">
                <QrCode className="w-5 h-5 text-primary mb-1.5" />
                <p className="font-medium text-sm">QR Code</p>
                <p className="text-xs text-muted-foreground">Escaneie com o WhatsApp no celular</p>
              </button>
              <button onClick={() => setStep("phone_input")}
                className="w-full p-4 rounded-xl border border-primary/40 bg-primary/5 hover:border-primary transition-all text-left relative">
                <span className="absolute top-2 right-2 text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Recomendado</span>
                <PhoneCall className="w-5 h-5 text-primary mb-1.5" />
                <p className="font-medium text-sm">Código de pareamento</p>
                <p className="text-xs text-muted-foreground">Digite um código no WhatsApp (mais confiável)</p>
              </button>
            </div>
          )}
          {!connected && !failed && step === "phone_input" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">Número do WhatsApp com DDI + DDD:</p>
              <Input placeholder="Ex: 5511999998888" value={phone} onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === "Enter" && requestPairingMut.mutate({ botId, phoneNumber: phone })} />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep("select")}>Voltar</Button>
                <Button className="flex-1"
                  disabled={phone.replace(/\D/g, "").length < 10 || requestPairingMut.isPending}
                  onClick={() => requestPairingMut.mutate({ botId, phoneNumber: phone })}>
                  {requestPairingMut.isPending ? "Aguardando..." : "Gerar código"}
                </Button>
              </div>
            </div>
          )}
          {!connected && !failed && step === "qr" && (
            <div className="text-center">
              {qr ? (
                <>
                  <p className="text-sm text-muted-foreground mb-3"><strong>WhatsApp → Dispositivos vinculados → Vincular dispositivo</strong></p>
                  <img src={qr} alt="QR Code" className="mx-auto w-64 h-64 rounded-lg border" />
                </>
              ) : isReconnecting ? (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Reconectando...</p>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Aguardando QR Code...</p>
                </div>
              )}
              <Button variant="outline" className="w-full mt-2" onClick={onClose}>Cancelar</Button>
            </div>
          )}
          {!connected && !failed && step === "pairing" && (
            <div className="text-center">
              {pairingCode ? (
                <>
                  <p className="text-sm text-muted-foreground mb-4"><strong>WhatsApp → Dispositivos vinculados → Vincular com número</strong></p>
                  <div className="bg-muted rounded-2xl py-6 px-4 mb-3">
                    <p className="text-4xl font-mono font-bold tracking-widest text-primary">{formatCode(pairingCode)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Válido por ~60 segundos.</p>
                </>
              ) : (
                <div className="py-8 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Gerando código...</p>
                </div>
              )}
              <Button variant="outline" className="w-full mt-4" onClick={onClose}>Cancelar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Bots() {
  const [showCreate, setShowCreate] = useState(false);
  const [qrModal, setQrModal]       = useState<{ botId: number } | null>(null);
  const [editorBot, setEditorBot]   = useState<BotWithInstance | null>(null);

  const botsQuery = trpc.bots.list.useQuery();
  const deleteBot = trpc.bots.delete.useMutation({ onSuccess: () => botsQuery.refetch() });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agentes</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus agentes de atendimento</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Agente
        </Button>
      </div>

      {botsQuery.isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : botsQuery.data?.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Bot className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum agente ainda. Crie o primeiro!</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-1" /> Criar Agente
          </Button>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {botsQuery.data?.map(bot => (
            <Card key={bot.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      {bot.agentMode === "ai" ? <Brain className="w-5 h-5 text-primary" /> : <Bot className="w-5 h-5 text-primary" />}
                    </div>
                    <div>
                      <p className="font-medium">{bot.name}</p>
                      <p className="text-sm text-muted-foreground">{bot.businessName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${bot.agentMode === "ai" ? "bg-purple-50 text-purple-600" : "bg-blue-50 text-blue-600"}`}>
                      {bot.agentMode === "ai" ? "🤖 IA" : "⚡ Fluxo"}
                    </span>
                    {bot.instance?.status === "connected" ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <Wifi className="w-3 h-3" /> Conectado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        <WifiOff className="w-3 h-3" /> Desconectado
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => setQrModal({ botId: bot.id })}>
                    <QrCode className="w-3.5 h-3.5 mr-1" />
                    {bot.instance?.status === "connected" ? "Reconectar" : "Conectar WhatsApp"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditorBot(bot as BotWithInstance)}>
                    <Brain className="w-3.5 h-3.5 mr-1" /> Configurar Agente
                  </Button>
                  <Link to={`/bots/${bot.id}/flow`}>
                    <Button size="sm" variant="outline">
                      <Zap className="w-3.5 h-3.5 mr-1" /> Fluxo
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => confirm("Excluir este agente?") && deleteBot.mutate({ id: bot.id })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(bot) => {
            botsQuery.refetch();
            setShowCreate(false);
            setEditorBot(bot);
          }}
        />
      )}

      {qrModal && <QRModal botId={qrModal.botId} onClose={() => { setQrModal(null); botsQuery.refetch(); }} />}
      {editorBot && <AgentEditorModal bot={editorBot} onClose={() => { setEditorBot(null); botsQuery.refetch(); }} />}
    </div>
  );
}
