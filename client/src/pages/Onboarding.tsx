import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Bot, Building2, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { NICHE_TEMPLATES, type Niche } from "../../../shared/plans";

const niches = Object.entries(NICHE_TEMPLATES).map(([key, val]) => ({
  key: key as Niche,
  label: val.nicheLabel,
  emoji: val.nicheEmoji,
  botName: val.botName,
}));

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessDesc, setBusinessDesc] = useState("");
  const [error, setError] = useState("");

  const createWorkspace = trpc.workspace.create.useMutation();
  const createBot = trpc.bots.createFromTemplate.useMutation();
  const updateOnboarding = trpc.workspace.updateOnboarding.useMutation();

  const handleFinish = async () => {
    if (!selectedNiche || !businessName || !workspaceName) return;
    setError("");

    try {
      const ws = await createWorkspace.mutateAsync({ name: workspaceName });
      localStorage.setItem("atendeai_wsid", String(ws.id));

      await createBot.mutateAsync({
        niche: selectedNiche,
        businessName,
        businessDescription: businessDesc || undefined,
      });

      await updateOnboarding.mutateAsync({ completed: true });
      navigate("/dashboard");
    } catch (e: any) {
      setError(e.message ?? "Erro ao criar bot. Tente novamente.");
    }
  };

  const isLoading = createWorkspace.isPending || createBot.isPending || updateOnboarding.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-2xl">AtendêAI</span>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`h-1.5 w-16 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Workspace name */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Qual o nome do seu negócio?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Ex: Clínica Vida Saudável"
                value={workspaceName}
                onChange={e => setWorkspaceName(e.target.value)}
                autoFocus
              />
              <Button
                className="w-full"
                disabled={!workspaceName.trim()}
                onClick={() => setStep(2)}
              >
                Próximo
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Choose niche */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Qual é o seu segmento?</CardTitle>
              <p className="text-sm text-muted-foreground">
                Vamos criar um bot personalizado para o seu negócio
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {niches.map(n => (
                  <button
                    key={n.key}
                    onClick={() => setSelectedNiche(n.key)}
                    className={`p-3 rounded-lg border text-center text-xs transition-all ${
                      selectedNiche === n.key
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="text-2xl mb-1">{n.emoji}</div>
                    {n.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  disabled={!selectedNiche}
                  onClick={() => setStep(3)}
                >
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Bot details */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>Configure seu bot</CardTitle>
              <p className="text-sm text-muted-foreground">
                Segmento: {selectedNiche ? NICHE_TEMPLATES[selectedNiche].nicheLabel : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Nome do negócio</label>
                <Input
                  placeholder="Ex: Clínica Vida Saudável"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Descrição (opcional)</label>
                <Input
                  placeholder="Breve descrição do seu negócio..."
                  value={businessDesc}
                  onChange={e => setBusinessDesc(e.target.value)}
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Voltar
                </Button>
                <Button
                  className="flex-1"
                  disabled={!businessName.trim() || isLoading}
                  onClick={handleFinish}
                >
                  {isLoading ? "Criando..." : "Criar meu bot"}
                  <Sparkles className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
