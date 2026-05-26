import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save, Bot, Play, Plus, Trash2, ChevronRight } from "lucide-react";

type NodeType = "start" | "message" | "menu" | "input" | "condition" | "handoff" | "end";

const NODE_COLORS: Record<NodeType, string> = {
  start: "bg-emerald-100 border-emerald-300 text-emerald-800",
  message: "bg-blue-100 border-blue-300 text-blue-800",
  menu: "bg-violet-100 border-violet-300 text-violet-800",
  input: "bg-amber-100 border-amber-300 text-amber-800",
  condition: "bg-orange-100 border-orange-300 text-orange-800",
  handoff: "bg-red-100 border-red-300 text-red-800",
  end: "bg-slate-100 border-slate-300 text-slate-700",
};

const NODE_LABELS: Record<NodeType, string> = {
  start: "Início",
  message: "Mensagem",
  menu: "Menu",
  input: "Entrada",
  condition: "Condição",
  handoff: "Handoff",
  end: "Fim",
};

export default function FlowEditor() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const bid = Number(botId);

  const flowQuery = trpc.flows.getFlow.useQuery({ botId: bid });
  const saveFlow = trpc.flows.saveFlow.useMutation({ onSuccess: () => alert("Fluxo salvo!") });
  const previewMsg = trpc.flows.previewMessage.useMutation();
  const botQuery = trpc.bots.get.useQuery({ id: bid });

  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [previewInput, setPreviewInput] = useState("");
  const [previewReply, setPreviewReply] = useState("");

  useEffect(() => {
    if (flowQuery.data) {
      setNodes(flowQuery.data.nodes);
      setEdges(flowQuery.data.edges);
    }
  }, [flowQuery.data]);

  const handleSave = () => {
    saveFlow.mutate({
      botId: bid,
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        content: n.content,
        metadata: n.metadata,
        posX: n.posX ?? 0,
        posY: n.posY ?? 0,
      })),
      edges: edges.map(e => ({
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        label: e.label,
        condition: e.condition,
      })),
    });
  };

  const handlePreview = () => {
    previewMsg.mutate({ botId: bid, userMessage: previewInput || "Olá" }, {
      onSuccess: (data) => setPreviewReply(data.reply),
    });
  };

  const updateNode = (id: number, field: string, value: any) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n));
    if (selectedNode?.id === id) setSelectedNode((n: any) => ({ ...n, [field]: value }));
  };

  const deleteNode = (id: number) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.sourceNodeId !== id && e.targetNodeId !== id));
    if (selectedNode?.id === id) setSelectedNode(null);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate("/bots")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <Bot className="w-4 h-4 text-primary" />
          <span className="font-semibold">{botQuery.data?.name ?? `Bot #${bid}`} — Editor de Fluxo</span>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saveFlow.isPending}>
          <Save className="w-4 h-4 mr-1" />
          {saveFlow.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Node list (canvas area) */}
        <div className="flex-1 overflow-auto p-6 bg-muted/20">
          {flowQuery.isLoading ? (
            <p className="text-muted-foreground">Carregando fluxo...</p>
          ) : nodes.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground mb-4">Nenhum nó encontrado. O fluxo está vazio.</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-md">
              {nodes.map((node, idx) => (
                <div
                  key={node.id}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${NODE_COLORS[node.type as NodeType]} ${
                    selectedNode?.id === node.id ? "ring-2 ring-primary shadow-md" : "hover:shadow-sm"
                  }`}
                  onClick={() => setSelectedNode(node)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide opacity-60">
                        {NODE_LABELS[node.type as NodeType]}
                      </span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteNode(node.id); }}
                      className="opacity-0 hover:opacity-100 transition-opacity text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm mt-1 line-clamp-2 opacity-80">
                    {node.content ?? "(sem conteúdo)"}
                  </p>
                  {idx < nodes.length - 1 && (
                    <div className="flex justify-center mt-2">
                      <ChevronRight className="w-4 h-4 opacity-40 rotate-90" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: node editor + preview */}
        <aside className="w-80 border-l bg-card flex flex-col overflow-hidden">
          {selectedNode ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Editar Nó</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${NODE_COLORS[selectedNode.type as NodeType]}`}>
                  {NODE_LABELS[selectedNode.type as NodeType]}
                </span>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block text-muted-foreground">Conteúdo</label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={selectedNode.content ?? ""}
                  onChange={e => updateNode(selectedNode.id, "content", e.target.value)}
                />
              </div>
              {selectedNode.type === "menu" && (
                <div>
                  <p className="text-xs font-medium mb-2 text-muted-foreground">
                    Opções do menu (edite via JSON)
                  </p>
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={JSON.stringify(selectedNode.metadata?.options ?? [], null, 2)}
                    onChange={e => {
                      try {
                        const opts = JSON.parse(e.target.value);
                        updateNode(selectedNode.id, "metadata", { ...selectedNode.metadata, options: opts });
                      } catch {}
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
              Clique em um nó para editá-lo
            </div>
          )}

          {/* Preview */}
          <div className="border-t p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
            <div className="flex gap-2">
              <Input
                placeholder="Digite uma mensagem..."
                value={previewInput}
                onChange={e => setPreviewInput(e.target.value)}
                className="text-xs"
                onKeyDown={e => e.key === "Enter" && handlePreview()}
              />
              <Button size="icon" variant="outline" onClick={handlePreview} disabled={previewMsg.isPending}>
                <Play className="w-3.5 h-3.5" />
              </Button>
            </div>
            {previewReply && (
              <div className="bg-muted rounded-lg p-3 text-xs whitespace-pre-wrap">
                {previewReply}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
