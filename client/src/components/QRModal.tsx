import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { QrCode, X, PhoneCall } from "lucide-react";

export default function QRModal({ botId, onClose }: { botId: number; onClose: () => void }) {
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
