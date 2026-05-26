import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { MessageSquare, User, Clock, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type ConvStatus = "active" | "handoff" | "closed";

const STATUS_CONFIG: Record<ConvStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: "Ativo", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  handoff: { label: "Handoff", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  closed: { label: "Encerrado", color: "bg-slate-100 text-slate-600", icon: Clock },
};

export default function Inbox() {
  const [filter, setFilter] = useState<ConvStatus | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const listQuery = trpc.conversations.list.useQuery({ limit: 50, status: filter });
  const convQuery = trpc.conversations.get.useQuery(
    { id: selectedId! },
    { enabled: selectedId !== null }
  );
  const updateStatus = trpc.conversations.updateStatus.useMutation({
    onSuccess: () => { listQuery.refetch(); convQuery.refetch(); },
  });

  const conversations = listQuery.data ?? [];
  const conv = convQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Caixa de Entrada</h1>
          <p className="text-muted-foreground text-sm">Gerencie suas conversas</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => listQuery.refetch()}>
          <RefreshCw className="w-4 h-4 mr-1" />
          Atualizar
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {([undefined, "active", "handoff", "closed"] as (ConvStatus | undefined)[]).map(s => (
          <Button
            key={s ?? "all"}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s ? STATUS_CONFIG[s].label : "Todos"}
          </Button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4 h-[calc(100vh-220px)]">
        {/* Conversation list */}
        <div className="overflow-y-auto space-y-2">
          {listQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : conversations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma conversa encontrada</p>
              </CardContent>
            </Card>
          ) : (
            conversations.map(c => {
              const statusCfg = STATUS_CONFIG[c.status as ConvStatus];
              return (
                <Card
                  key={c.id}
                  className={cn(
                    "cursor-pointer hover:border-primary/50 transition-colors",
                    selectedId === c.id ? "border-primary" : ""
                  )}
                  onClick={() => setSelectedId(c.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{c.contact?.name ?? c.contact?.phone ?? `#${c.id}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.lastMessage?.content?.slice(0, 50) ?? "Sem mensagens"}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Conversation detail */}
        <Card className="flex flex-col overflow-hidden">
          {!selectedId ? (
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Selecione uma conversa
            </CardContent>
          ) : convQuery.isLoading ? (
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Carregando...
            </CardContent>
          ) : conv ? (
            <>
              {/* Conv header */}
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{conv.contact?.name ?? conv.contact?.phone}</span>
                </div>
                <div className="flex gap-2">
                  {conv.status !== "closed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus.mutate({ id: conv.id, status: "closed" })}
                    >
                      Encerrar
                    </Button>
                  )}
                  {conv.status === "handoff" && (
                    <Button
                      size="sm"
                      onClick={() => updateStatus.mutate({ id: conv.id, status: "active" })}
                    >
                      Reativar Bot
                    </Button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {conv.messages?.map(msg => (
                  <div
                    key={msg.id}
                    className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-none"
                          : msg.role === "bot"
                          ? "bg-muted text-foreground rounded-tl-none"
                          : "bg-amber-100 text-amber-800 rounded-tl-none"
                      )}
                    >
                      {msg.content}
                      <p className="text-[10px] mt-1 opacity-60 text-right">
                        {msg.role === "bot" ? "Bot" : msg.role === "human" ? "Atendente" : "Cliente"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
