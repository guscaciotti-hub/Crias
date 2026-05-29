import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import QRModal from "@/components/QRModal";
import { Zap, Plus, Wifi, WifiOff, Trash2, QrCode, X } from "lucide-react";

function CreateFlowModal({ onCreated, onClose }: {
  onCreated: (botId: number) => void; onClose: () => void;
}) {
  const [businessName, setName] = useState("");
  const [error, setError] = useState("");
  const createFlow = trpc.bots.createFlow.useMutation({
    onSuccess: (bot) => onCreated(bot.id),
    onError: (e) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">⚡ Novo Fluxo</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-4 h-4" /></Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Nome do fluxo / negócio</label>
            <Input placeholder="Ex: Atendimento Loja X" value={businessName}
              onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <p className="text-sm text-muted-foreground">
            Um fluxo de atendimento com menus e botões será criado. Você poderá editá-lo no editor visual.
          </p>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
            <Button className="flex-1" disabled={createFlow.isPending || !businessName}
              onClick={() => { setError(""); createFlow.mutate({ businessName }); }}>
              {createFlow.isPending ? "Criando..." : <><Zap className="w-3.5 h-3.5 mr-1.5" />Criar Fluxo</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Flows() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [qrModal, setQrModal] = useState<{ botId: number } | null>(null);

  const botsQuery = trpc.bots.list.useQuery();
  const deleteBot = trpc.bots.delete.useMutation({ onSuccess: () => botsQuery.refetch() });

  const flows = (botsQuery.data ?? []).filter(b => b.agentMode === "flow");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">⚡ Fluxos</h1>
          <p className="text-muted-foreground text-sm">Árvores de menus, botões e respostas fixas</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Fluxo
        </Button>
      </div>

      {botsQuery.isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : flows.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Zap className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Nenhum fluxo ainda. Crie o primeiro!</p>
          <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> Novo Fluxo</Button>
        </CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {flows.map(bot => (
            <Card key={bot.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-blue-500" />
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
                  <Link to={`/bots/${bot.id}/flow`}>
                    <Button size="sm" variant="outline"><Zap className="w-3.5 h-3.5 mr-1" /> Editar Fluxo</Button>
                  </Link>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => confirm("Excluir este fluxo?") && deleteBot.mutate({ id: bot.id })}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateFlowModal onClose={() => setShowCreate(false)}
          onCreated={(botId) => { botsQuery.refetch(); setShowCreate(false); navigate(`/bots/${botId}/flow`); }} />
      )}
      {qrModal && <QRModal botId={qrModal.botId} onClose={() => { setQrModal(null); botsQuery.refetch(); }} />}
    </div>
  );
}
