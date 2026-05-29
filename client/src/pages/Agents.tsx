import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { trpc } from "@/lib/trpc";
import QRModal from "@/components/QRModal";
import {
  Brain, Plus, Wifi, WifiOff, Trash2, QrCode, X, Send,
  Bell, PhoneCall, Sparkles, Settings2, RefreshCw, ChevronDown, ChevronUp, Clock,
} from "lucide-react";

type BotWithInstance = {
  id: number; name: string; businessName: string; businessDescription?: string | null;
  agentMode: string; aiSystemPrompt?: string | null; systemPrompt?: string | null;
  tone: string; alertNumbers?: string[] | null; forbiddenTopics?: string[] | null;
  responseDelay?: number | null; handoffCondition?: string | null;
  reactivationEnabled?: boolean | null; reactivationMessage?: string | null;
  reactivationTimeoutMin?: number | null;
  instance: { status: string } | null;
};

const MIN_DELAY = 4, MAX_DELAY = 30, DEFAULT_DELAY = 4;
const clampDelay = (v: number) => Math.min(MAX_DELAY, Math.max(MIN_DELAY, Math.round(v || DEFAULT_DELAY)));

// ─────────────────────────────────────────────────────────────────────────────
// AGENT EDITOR MODAL (IA only — no mode toggle)
// ─────────────────────────────────────────────────────────────────────────────
function AgentEditorModal({ bot, onClose }: { bot: BotWithInstance; onClose: () => void }) {
  const [prompt, setPrompt]       = useState(bot.aiSystemPrompt ?? "");
  const [desc, setDesc]           = useState(bot.businessDescription ?? "");
  const [tone, setTone]           = useState<"formal"|"friendly"|"professional"|"casual">(bot.tone as any ?? "friendly");
  const [doRules, setDoRules]     = useState(bot.systemPrompt ?? "");
  const [dontRules, setDontRules] = useState((bot.forbiddenTopics ?? []).join("\n"));
  const [handoffCondition, setHandoffCondition] = useState(bot.handoffCondition ?? "");
  const [alertNumbers, setAlertNumbers] = useState<string[]>(bot.alertNumbers ?? []);
  const [alertInput, setAlertInput]     = useState("");
  const [responseDelay, setResponseDelay] = useState<number>(bot.responseDelay ?? DEFAULT_DELAY);
  const [reactivationEnabled, setReactivationEnabled] = useState(bot.reactivationEnabled ?? false);
  const [reactivationMessage, setReactivationMessage] = useState(bot.reactivationMessage ?? "");
  const [reactivationTimeoutMin, setReactivationTimeoutMin] = useState(bot.reactivationTimeoutMin ?? 30);
  const [chatMsg, setChatMsg]     = useState("");
  const [chatLog, setChatLog]     = useState<{ role: string; text: string }[]>([]);
  const [syncBanner, setSyncBanner] = useState(false);
  const [expandTest, setExpandTest] = useState(false);
  const savedConfig = useRef({ tone, doRules, dontRules, desc });

  useEffect(() => {
    const c = savedConfig.current;
    setSyncBanner(tone !== c.tone || doRules !== c.doRules || dontRules !== c.dontRules || desc !== c.desc);
  }, [tone, doRules, dontRules, desc]);

  const update    = trpc.bots.update.useMutation({ onSuccess: onClose });
  const genPrompt = trpc.bots.generatePrompt.useMutation({
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
      id: bot.id, agentMode: "ai", aiSystemPrompt: prompt, systemPrompt: doRules,
      businessDescription: desc, tone,
      forbiddenTopics: dontRules.split("\n").map(s => s.trim()).filter(Boolean),
      handoffCondition,
      alertNumbers,
      responseDelay: clampDelay(responseDelay),
      reactivationEnabled,
      reactivationMessage,
      reactivationTimeoutMin,
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
        <div className="flex items-center justify-between px-6 py-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold">{bot.name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Prompt Principal */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Prompt Principal</p>
              <span className="text-xs text-muted-foreground">Fonte do comportamento do agente</span>
            </div>
            <textarea
              className="w-full border rounded-xl p-3 text-sm min-h-[160px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background font-mono"
              placeholder={"Você é a Ana, assistente virtual da [Empresa]. Responda de forma amigável, ajude com dúvidas sobre produtos/serviços. Se o cliente pedir para falar com humano, informe que vai transferir."}
              value={prompt} onChange={e => setPrompt(e.target.value)} />
          </div>

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

          {/* Conhecimento */}
          <div>
            <p className="text-sm font-semibold mb-2">Conhecimento da Empresa</p>
            <textarea
              className="w-full border rounded-xl p-3 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
              placeholder="Descreva o negócio, serviços, horários, diferenciais... Quanto mais detalhes, melhor o agente responde."
              value={desc} onChange={e => setDesc(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Para documentos e PDFs, use a seção <Link to="/knowledge" className="text-primary hover:underline">Base de Conhecimento</Link>.
            </p>
          </div>

          {/* Personalidade */}
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

          {/* Regras */}
          <div>
            <p className="text-sm font-semibold mb-3">Regras</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-green-700 mb-1.5">✅ O que fazer</p>
                <textarea
                  className="w-full border border-green-200 rounded-xl p-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-green-300 bg-background"
                  placeholder={"Sempre se apresentar pelo nome\nResponder sobre horários e preços\nAgendar consultas"}
                  value={doRules} onChange={e => setDoRules(e.target.value)} />
              </div>
              <div>
                <p className="text-xs font-medium text-red-700 mb-1.5">🚫 O que NÃO fazer</p>
                <textarea
                  className="w-full border border-red-200 rounded-xl p-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-red-300 bg-background"
                  placeholder={"Dar diagnósticos médicos\nFalar sobre concorrentes\nFornecer dados pessoais de clientes"}
                  value={dontRules} onChange={e => setDontRules(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Uma regra por linha.</p>
          </div>

          {/* Tempo de Resposta */}
          <div>
            <p className="text-sm font-semibold mb-1">Tempo de Resposta</p>
            <p className="text-xs text-muted-foreground mb-3">
              Define quanto tempo o agente aguarda antes de responder uma mensagem.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="range" min={MIN_DELAY} max={MAX_DELAY} step={1}
                value={responseDelay}
                onChange={e => setResponseDelay(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <Input
                  type="number" min={MIN_DELAY} max={MAX_DELAY}
                  value={responseDelay}
                  onChange={e => setResponseDelay(Number(e.target.value))}
                  onBlur={() => setResponseDelay(d => clampDelay(d))}
                  className="w-20 text-center"
                />
                <span className="text-sm text-muted-foreground">seg</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Mínimo {MIN_DELAY}s, máximo {MAX_DELAY}s. A humanização (digitando…) atua em conjunto.
            </p>
          </div>

          {/* Transferência para Humano */}
          <div className="space-y-4">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-primary" /> Transferência para Humano
            </p>

            {/* Condição de handoff */}
            <div>
              <p className="text-xs font-medium mb-1.5">Quando transferir?</p>
              <textarea
                className="w-full border rounded-xl p-3 text-sm min-h-[72px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                placeholder={"Ex: quando o cliente quiser agendar uma call ou reunião\nquando pedir orçamento personalizado\nquando reclamar de um problema"}
                value={handoffCondition}
                onChange={e => setHandoffCondition(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Descreva a condição em linguagem natural. O agente vai seguir essa regra para decidir quando transferir — sem inventar.
              </p>
            </div>

            {/* Números de alerta */}
            <div>
              <p className="text-xs font-medium mb-1.5">Números que recebem aviso (WhatsApp)</p>
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
          </div>

          {/* Testar */}
          <div>
            <button onClick={() => setExpandTest(v => !v)} className="flex items-center gap-2 text-sm font-semibold w-full text-left">
              <Send className="w-4 h-4 text-primary" /> Testar Agente
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
                      <div className={`max-w-[80%] px-3 py-1.5 rounded-xl text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border"}`}>
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
                    onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === "Enter" && sendTest()} className="text-sm" />
                  <Button size="sm" onClick={sendTest} disabled={testAI.isPending || !chatMsg.trim()}>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

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
// CREATE MODAL — Assistente vs Controle Total
// ─────────────────────────────────────────────────────────────────────────────
function CreateAgentModal({ onCreated, onClose }: {
  onCreated: (bot: BotWithInstance) => void; onClose: () => void;
}) {
  type Step = "choose" | "ai_form" | "manual_form";
  const [step, setStep] = useState<Step>("choose");
  const [businessName, setName] = useState("");
  const [description, setDesc]  = useState("");
  const [error, setError]       = useState("");

  const createWithAI = trpc.bots.createWithAI.useMutation({
    onSuccess: (bot) => onCreated(bot as any), onError: (e) => setError(e.message),
  });
  const createBlank = trpc.bots.createBlank.useMutation({
    onSuccess: (bot) => onCreated(bot as any), onError: (e) => setError(e.message),
  });
  const loading = createWithAI.isPending || createBlank.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">
            {step === "choose" ? "Novo Agente" : step === "ai_form" ? "✨ Assistente de Criação" : "🎯 Controle Total"}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "choose" && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Escolha como deseja criar:</p>
              <button onClick={() => setStep("ai_form")}
                className="w-full p-4 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all text-left">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-semibold">✨ Assistente de Criação</span>
                  <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Recomendado</span>
                </div>
                <p className="text-sm text-muted-foreground">A IA cria uma configuração inicial para você com base na descrição do negócio.</p>
              </button>
              <button onClick={() => setStep("manual_form")}
                className="w-full p-4 rounded-xl border hover:border-primary hover:bg-primary/5 transition-all text-left">
                <div className="flex items-center gap-2 mb-1">
                  <Settings2 className="w-5 h-5 text-primary" />
                  <span className="font-semibold">🎯 Controle Total</span>
                </div>
                <p className="text-sm text-muted-foreground">Configure manualmente seu agente desde o início.</p>
              </button>
            </div>
          )}

          {step === "ai_form" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome da empresa</label>
                <Input placeholder="Ex: Clínica Vida Saudável" value={businessName} onChange={e => setName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descrição da empresa</label>
                <textarea
                  className="w-full border rounded-xl p-3 text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-background"
                  placeholder="Ex: Somos uma clínica odontológica especializada em implantes e ortodontia em Santos, SP. Atendemos de segunda a sábado das 8h às 18h."
                  value={description} onChange={e => setDesc(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Quanto mais detalhes, melhor o agente gerado.</p>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep("choose")} className="flex-1">Voltar</Button>
                <Button className="flex-1" disabled={loading || !businessName || description.length < 10}
                  onClick={() => { setError(""); createWithAI.mutate({ businessName, businessDescription: description }); }}>
                  {loading ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Gerando com IA...</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" />Criar Agente</>}
                </Button>
              </div>
            </div>
          )}

          {step === "manual_form" && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome da empresa</label>
                <Input placeholder="Ex: Imobiliária Top" value={businessName} onChange={e => setName(e.target.value)} autoFocus />
              </div>
              <p className="text-sm text-muted-foreground">O agente será criado com os campos em branco para você configurar manualmente.</p>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep("choose")} className="flex-1">Voltar</Button>
                <Button className="flex-1" disabled={loading || !businessName}
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
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Agents() {
  const [showCreate, setShowCreate] = useState(false);
  const [qrModal, setQrModal]       = useState<{ botId: number } | null>(null);
  const [editorBot, setEditorBot]   = useState<BotWithInstance | null>(null);

  const botsQuery = trpc.bots.list.useQuery();
  const deleteBot = trpc.bots.delete.useMutation({ onSuccess: () => botsQuery.refetch() });

  const agents = (botsQuery.data ?? []).filter(b => b.agentMode === "ai");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">🧠 Agentes IA</h1>
          <p className="text-muted-foreground text-sm">Atendentes inteligentes que respondem com IA</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Agente
        </Button>
      </div>

      {botsQuery.isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : agents.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Brain className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum agente ainda. Crie o primeiro!</p>
          <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Novo Agente</Button>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {agents.map(bot => (
            <Card key={bot.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Brain className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{bot.name}</p>
                      <p className="text-sm text-muted-foreground">{bot.businessName}</p>
                    </div>
                  </div>
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
                <div className="flex flex-wrap gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => setQrModal({ botId: bot.id })}>
                    <QrCode className="w-3.5 h-3.5 mr-1" />
                    {bot.instance?.status === "connected" ? "Reconectar" : "Conectar WhatsApp"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditorBot(bot as BotWithInstance)}>
                    <Brain className="w-3.5 h-3.5 mr-1" /> Configurar
                  </Button>
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
        <CreateAgentModal onClose={() => setShowCreate(false)}
          onCreated={(bot) => { botsQuery.refetch(); setShowCreate(false); setEditorBot(bot); }} />
      )}
      {qrModal && <QRModal botId={qrModal.botId} onClose={() => { setQrModal(null); botsQuery.refetch(); }} />}
      {editorBot && <AgentEditorModal bot={editorBot} onClose={() => { setEditorBot(null); botsQuery.refetch(); }} />}
    </div>
  );
}
