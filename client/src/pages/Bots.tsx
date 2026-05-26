import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Bot, Plus, Wifi, WifiOff, Settings, Zap, Trash2,
  QrCode, RefreshCw, ChevronRight
} from "lucide-react";
import { NICHE_TEMPLATES, type Niche } from "../../../shared/plans";

export default function Bots() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [qrModal, setQrModal] = useState<{ botId: number; qr: string } | null>(null);

  const botsQuery = trpc.bots.list.useQuery();
  const createBot = trpc.bots.createFromTemplate.useMutation({
    onSuccess: () => {
      botsQuery.refetch();
      setShowCreate(false);
      setSelectedNiche(null);
      setBusinessName("");
    },
  });
  const deleteBot = trpc.bots.delete.useMutation({
    onSuccess: () => botsQuery.refetch(),
  });
  const generateQR = trpc.whatsapp.generateQR.useMutation({
    onSuccess: (data, vars) => {
      setQrModal({ botId: vars.botId, qr: data.qr });
    },
  });

  const niches = Object.entries(NICHE_TEMPLATES).map(([key, val]) => ({
    key: key as Niche,
    label: val.nicheLabel,
    emoji: val.nicheEmoji,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bots</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus chatbots do WhatsApp</p>
        </div>
        <Button onClick={() => setShowCreate(v => !v)}>
          <Plus className="w-4 h-4 mr-1" />
          Novo Bot
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Criar novo bot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Escolha o segmento</p>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {niches.map(n => (
                  <button
                    key={n.key}
                    onClick={() => setSelectedNiche(n.key)}
                    className={`p-2 rounded-lg border text-center text-xs transition-all ${
                      selectedNiche === n.key
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-xl mb-1">{n.emoji}</div>
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nome do negócio</label>
              <Input
                placeholder="Ex: Clínica Vida Saudável"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setShowCreate(false); setSelectedNiche(null); setBusinessName(""); }}
              >
                Cancelar
              </Button>
              <Button
                disabled={!selectedNiche || !businessName || createBot.isPending}
                onClick={() => selectedNiche && createBot.mutate({ niche: selectedNiche, businessName })}
              >
                {createBot.isPending ? "Criando..." : "Criar Bot"}
                <Zap className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bot list */}
      {botsQuery.isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : botsQuery.data?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Bot className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Nenhum bot ainda. Crie o primeiro!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {botsQuery.data?.map(bot => (
            <Card key={bot.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{bot.name}</p>
                      <p className="text-sm text-muted-foreground">{bot.businessName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
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
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={generateQR.isPending}
                    onClick={() => generateQR.mutate({ botId: bot.id })}
                  >
                    <QrCode className="w-3.5 h-3.5 mr-1" />
                    {bot.instance?.status === "connected" ? "Reconectar" : "Conectar WhatsApp"}
                  </Button>
                  <Link to={`/bots/${bot.id}/flow`}>
                    <Button size="sm" variant="outline">
                      <Zap className="w-3.5 h-3.5 mr-1" />
                      Fluxo
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => confirm("Excluir este bot?") && deleteBot.mutate({ id: bot.id })}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle className="text-center">Escanear QR Code</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Abra o WhatsApp no seu celular e escaneie o QR Code
              </p>
              <img src={qrModal.qr} alt="QR Code" className="mx-auto w-64 h-64 rounded-lg border" />
              <Button variant="outline" onClick={() => setQrModal(null)}>Fechar</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
