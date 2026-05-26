import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Trash2, Loader2, FileText } from "lucide-react";

export default function Knowledge() {
  const utils = trpc.useUtils();
  const { data: bots } = trpc.bots.list.useQuery();
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    type: "faq" as "faq" | "document" | "url" | "text",
    name: "",
    content: "",
  });

  const activeBotId = selectedBotId ?? (bots?.[0]?.id ?? null);

  const { data: docs, isLoading } = trpc.knowledge.list.useQuery(
    { botId: activeBotId! },
    { enabled: !!activeBotId }
  );

  const create = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      utils.knowledge.list.invalidate();
      setShowAdd(false);
      setForm({ type: "faq", name: "", content: "" });
    },
  });

  const del = trpc.knowledge.delete.useMutation({
    onSuccess: () => utils.knowledge.list.invalidate(),
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Base de Conhecimento</h1>
          <p className="text-gray-500 text-sm mt-1">FAQs e documentos para seu bot responder melhor</p>
        </div>
        <Button
          onClick={() => setShowAdd(true)}
          className="bg-green-600 hover:bg-green-700"
          disabled={!activeBotId}
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {/* Bot selector */}
      {(bots ?? []).length > 1 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {(bots ?? []).map((b: any) => (
            <button
              key={b.id}
              onClick={() => setSelectedBotId(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                activeBotId === b.id
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 hover:border-green-300"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd && activeBotId && (
        <Card className="mb-6 border-green-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Novo documento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value as any }))
                  }
                >
                  <option value="faq">FAQ</option>
                  <option value="text">Texto</option>
                  <option value="document">Documento</option>
                  <option value="url">URL</option>
                </select>
              </div>
              <div>
                <Label>
                  {form.type === "faq" ? "Pergunta" : "Nome"}
                </Label>
                <Input
                  className="mt-1"
                  placeholder={form.type === "faq" ? "Como faço para agendar?" : "Nome do documento"}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>
                {form.type === "faq" ? "Resposta" : "Conteúdo"}
              </Label>
              <Textarea
                className="mt-1"
                rows={4}
                placeholder={form.type === "faq" ? "Você pode agendar pelo WhatsApp..." : "Conteúdo do documento..."}
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="bg-green-600 hover:bg-green-700"
                disabled={create.isPending || !form.name || !form.content}
                onClick={() =>
                  create.mutate({ botId: activeBotId, ...form })
                }
              >
                {create.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
              <Button variant="ghost" onClick={() => setShowAdd(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Doc list */}
      {!activeBotId ? (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-sm">Crie um bot primeiro para adicionar documentos</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-green-600" />
        </div>
      ) : (docs ?? []).length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText className="w-14 h-14 mx-auto mb-4 opacity-30" />
          <p className="text-sm">Nenhum documento ainda. Adicione FAQs para o bot responder melhor!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(docs ?? []).map((doc: any) => (
            <Card key={doc.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 mb-0.5 truncate">
                      {doc.name}
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                      {doc.content}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className="text-xs capitalize">
                    {doc.type}
                  </Badge>
                  <button
                    onClick={() => {
                      if (confirm("Excluir este documento?")) del.mutate({ id: doc.id });
                    }}
                    className="text-red-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
