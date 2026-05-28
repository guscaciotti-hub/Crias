import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Bot, Plus, Wifi, WifiOff, Zap, Trash2, QrCode, Brain, X, Send, ChevronRight, Bell, PhoneCall
} from "lucide-react";
import { NICHE_TEMPLATES, type Niche } from "../../../shared/plans";

type BotWithInstance = {
  id: number; name: string; businessName: string; agentMode: string;
  aiSystemPrompt?: string | null; tone: string;
  alertNumbers?: string[] | null;
  instance: { status: string } | null;
};

function AIConfigModal({ bot, onClose }: { bot: BotWithInstance; onClose: () => void }) {
  const [prompt, setPrompt] = useState(bot.aiSystemPrompt ?? "");
  const [chatMsg, setChatMsg] = useState("");
  const [chatLog, setChatLog] = useState<{ role: string; text: string }[]>([]);
  const [mode, setMode] = useState<"flow" | "ai">(bot.agentMode as "flow" | "ai");
  const [alertNumbers, setAlertNumbers] = useState<string[]>(bot.alertNumbers ?? []);
  const [alertInput, setAlertInput] = useState("");

  const addAlertNumber = () => {
    const num = alertInput.replace(/\D/g, "");
    if (num.length >= 10 && !alertNumbers.includes(num)) {
      setAlertNumbers(prev => [...prev, num]);
    }
    setAlertInput("");
  };

  const update = trpc.bots.update.useMutation({ onSuccess: onClose });
  const testAI = trpc.bots.testAI.useMutation({
    onSuccess: (data) => {
      setChatLog(l => [...l, { role: "bot", text: data.reply }]);
    },
  });

  const sendTest = () => {
    if (!chatMsg.trim()) return;
    setChatLog(l => [...l, { role: "user", text: chatMsg }]);
    testAI.mutate({ botId: bot.id, message: chatMsg });
    setChatMsg("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Configurar Agente — {bot.name}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Mode selector */}
          <div>
            <p className="text-sm font-medium mb-2">Modo de atendimento</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode("flow")}
                className={`p-3 rounded-lg border text-left transition-all ${mode === "flow" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <Zap className="w-4 h-4 text-primary mb-1" />
                <p className="font-medium text-sm">Fluxo</p>
                <p className="text-xs text-muted-foreground">Menus e botões fixos</p>
              </button>
              <button
                onClick={() => setMode("ai")}
                className={`p-3 rounded-lg border text-left transition-all ${mode === "ai" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <Brain className="w-4 h-4 text-primary mb-1" />
                <p className="font-medium text-sm">Agente IA</p>
                <p className="text-xs text-muted-foreground">GPT-4o mini responde naturalmente</p>
              </button>
            </div>
          </div>

          {mode === "ai" && (
            <>
              {/* Prompt do negócio */}
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Prompt do negócio
                  <span className="text-muted-foreground font-normal ml-1">(instrução para o agente)</span>
                </label>
                <textarea
                  className="w-full border rounded-lg p-3 text-sm min-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={`Exemplo:\nVocê é a Ana, assistente da ${bot.businessName}. Responda de forma amigável e ajude com agendamentos, dúvidas sobre serviços e preços. Se o cliente quiser falar com humano, diga que vai transferir.`}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Descreva quem é o bot, o que o negócio faz, como responder e quando transferir para humano.
                </p>
              </div>

              {/* Chat de teste */}
              <div>
                <p className="text-sm font-medium mb-2">Testar agente IA</p>
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 p-3 min-h-[140px] max-h-[200px] overflow-y-auto space-y-2">
                    {chatLog.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center mt-8">
                        Envie uma mensagem para testar o agente
                      </p>
                    )}
                    {chatLog.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] px-3 py-1.5 rounded-xl text-sm ${
                          m.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border"
                        }`}>
                          {m.text}
                        </div>
                      </div>
                    ))}
                    {testAI.isPending && (
                      <div className="flex justify-start">
                        <div className="bg-card border px-3 py-1.5 rounded-xl text-sm text-muted-foreground">
                          Digitando...
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 p-2 border-t">
                    <Input
                      placeholder="Digite uma mensagem de teste..."
                      value={chatMsg}
                      onChange={e => setChatMsg(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendTest()}
                      className="text-sm"
                    />
                    <Button size="sm" onClick={sendTest} disabled={testAI.isPending || !chatMsg.trim()}>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ⚠️ Requer OPENAI_API_KEY configurada no Render → Environment
                </p>
              </div>
            </>
          )}

          {/* Handoff alert numbers */}
          <div className="border-t pt-4">
            <p className="text-sm font-medium flex items-center gap-1.5 mb-1">
              <Bell className="w-4 h-4 text-primary" /> Alertas de handoff
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Quando o bot transferir para humano, os números abaixo recebem uma mensagem no WhatsApp.
            </p>
            <div className="flex gap-2 mb-2">
              <Input
                placeholder="Ex: 5511999998888"
                value={alertInput}
                onChange={e => setAlertInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAlertNumber())}
                className="text-sm"
              />
              <Button type="button" size="sm" variant="outline" onClick={addAlertNumber}>
                Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Formato: DDI + DDD + número (sem espaços ou traços). Ex: <code>5511999998888</code>
            </p>
            {alertNumbers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {alertNumbers.map(num => (
                  <span key={num} className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded-full text-xs">
                    <PhoneCall className="w-3 h-3" /> {num}
                    <button onClick={() => setAlertNumbers(prev => prev.filter(n => n !== num))} className="ml-0.5 hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button
              className="flex-1"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: bot.id, agentMode: mode, aiSystemPrompt: prompt, alertNumbers })}
            >
              {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function QRModal({ botId, onClose }: { botId: number; onClose: () => void }) {
  const statusQuery = trpc.whatsapp.status.useQuery({ botId }, { refetchInterval: 2000 });
  const { status, qr } = statusQuery.data ?? {};
  const connected = status === "connected";

  useEffect(() => {
    if (connected) {
      const t = setTimeout(onClose, 1800);
      return () => clearTimeout(t);
    }
  }, [connected]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">
            {connected ? "✅ Conectado!" : "Escanear QR Code"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {connected ? (
            <div className="py-6">
              <p className="text-emerald-600 font-semibold text-lg">WhatsApp conectado!</p>
              <p className="text-sm text-muted-foreground mt-1">Fechando em instantes...</p>
            </div>
          ) : qr ? (
            <>
              <p className="text-sm text-muted-foreground">
                No celular: <strong>WhatsApp → Dispositivos vinculados → Vincular dispositivo</strong>
              </p>
              <img src={qr} alt="QR Code" className="mx-auto w-64 h-64 rounded-lg border" />
              <p className="text-xs text-muted-foreground">
                O QR atualiza automaticamente quando expira.
              </p>
            </>
          ) : (
            <div className="py-8 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Aguardando QR Code...</p>
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={onClose}>
            {connected ? "Fechar" : "Cancelar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Bots() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [qrModal, setQrModal] = useState<{ botId: number } | null>(null);
  const [aiModal, setAiModal] = useState<BotWithInstance | null>(null);

  const botsQuery = trpc.bots.list.useQuery();
  const createBot = trpc.bots.createFromTemplate.useMutation({
    onSuccess: () => { botsQuery.refetch(); setShowCreate(false); setSelectedNiche(null); setBusinessName(""); },
  });
  const deleteBot = trpc.bots.delete.useMutation({ onSuccess: () => botsQuery.refetch() });
  const generateQR = trpc.whatsapp.generateQR.useMutation({
    onSuccess: (_data, vars) => setQrModal({ botId: vars.botId }),
  });

  const niches = Object.entries(NICHE_TEMPLATES).map(([key, val]) => ({
    key: key as Niche, label: val.nicheLabel, emoji: val.nicheEmoji,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bots</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus chatbots do WhatsApp</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Bot
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">Criar novo bot</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Escolha o segmento</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {niches.map(n => (
                  <button key={n.key} onClick={() => setSelectedNiche(n.key)}
                    className={`p-2 rounded-lg border text-center text-xs transition-all ${
                      selectedNiche === n.key ? "border-primary bg-primary/5 text-primary font-medium" : "border-border hover:border-primary/50"
                    }`}>
                    <div className="text-xl mb-1">{n.emoji}</div>
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nome do negócio</label>
              <Input placeholder="Ex: Clínica Vida Saudável" value={businessName} onChange={e => setBusinessName(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); setSelectedNiche(null); setBusinessName(""); }}>Cancelar</Button>
              <Button disabled={!selectedNiche || !businessName || createBot.isPending}
                onClick={() => selectedNiche && createBot.mutate({ niche: selectedNiche, businessName })}>
                {createBot.isPending ? "Criando..." : "Criar Bot"} <Zap className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {botsQuery.isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : botsQuery.data?.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Bot className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhum bot ainda. Crie o primeiro!</p>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {botsQuery.data?.map(bot => (
            <Card key={bot.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      {bot.agentMode === "ai"
                        ? <Brain className="w-5 h-5 text-primary" />
                        : <Bot className="w-5 h-5 text-primary" />
                      }
                    </div>
                    <div>
                      <p className="font-medium">{bot.name}</p>
                      <p className="text-sm text-muted-foreground">{bot.businessName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      bot.agentMode === "ai"
                        ? "bg-purple-50 text-purple-600"
                        : "bg-blue-50 text-blue-600"
                    }`}>
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
                  <Button size="sm" variant="outline" disabled={generateQR.isPending}
                    onClick={() => generateQR.mutate({ botId: bot.id })}>
                    <QrCode className="w-3.5 h-3.5 mr-1" />
                    {bot.instance?.status === "connected" ? "Reconectar" : "Conectar WhatsApp"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAiModal(bot as BotWithInstance)}>
                    <Brain className="w-3.5 h-3.5 mr-1" /> Agente IA
                  </Button>
                  <Link to={`/bots/${bot.id}/flow`}>
                    <Button size="sm" variant="outline">
                      <Zap className="w-3.5 h-3.5 mr-1" /> Fluxo
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => confirm("Excluir este bot?") && deleteBot.mutate({ id: bot.id })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {qrModal && (
        <QRModal
          botId={qrModal.botId}
          onClose={() => { setQrModal(null); botsQuery.refetch(); }}
        />
      )}

      {aiModal && <AIConfigModal bot={aiModal} onClose={() => { setAiModal(null); botsQuery.refetch(); }} />}
    </div>
  );
}
