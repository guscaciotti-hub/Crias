import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getDb, type Db } from "../db.js";
import { flowNodes, flowEdges, autoMessages, conversationStates, bots, workspaceMembers } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { NICHE_TEMPLATES, type Niche } from "../../shared/plans.js";

// ─── Flow cache ──────────────────────────────────────────────────────────────
type CachedFlow = { nodes: typeof flowNodes.$inferSelect[]; edges: typeof flowEdges.$inferSelect[]; cachedAt: number };
const flowCacheMap = new Map<number, CachedFlow>();
const FLOW_CACHE_TTL_MS = 30_000;

function invalidateFlowCache(botId: number) { flowCacheMap.delete(botId); }

function getFlowFromCache(botId: number): CachedFlow | null {
  const cached = flowCacheMap.get(botId);
  if (cached && Date.now() - cached.cachedAt < FLOW_CACHE_TTL_MS) return cached;
  flowCacheMap.delete(botId);
  return null;
}

function setFlowCache(botId: number, nodes: typeof flowNodes.$inferSelect[], edges: typeof flowEdges.$inferSelect[]) {
  flowCacheMap.set(botId, { nodes, edges, cachedAt: Date.now() });
}

// ─── Build default flow ──────────────────────────────────────────────────────
export async function buildDefaultFlow(db: Db, wsId: number, botId: number, niche: Niche, businessName: string) {
  const template = NICHE_TEMPLATES[niche];

  // Clear existing flow
  db.delete(flowEdges).where(eq(flowEdges.botId, botId)).run();
  db.delete(flowNodes).where(eq(flowNodes.botId, botId)).run();

  const welcomeMsg = template.welcomeMessage.replace("{businessName}", businessName);

  // Create nodes
  const startNode = db.insert(flowNodes).values({
    botId, workspaceId: wsId, type: "start",
    content: welcomeMsg, posX: 100, posY: 100,
  }).returning().get();

  const menuNode = db.insert(flowNodes).values({
    botId, workspaceId: wsId, type: "menu",
    content: "Escolha uma opção:",
    metadata: {
      options: template.menuOptions.map((opt, i) => ({
        label: opt.label, value: String(i + 1), emoji: opt.emoji,
      })),
    },
    posX: 100, posY: 300,
  }).returning().get();

  const handoffNode = db.insert(flowNodes).values({
    botId, workspaceId: wsId, type: "handoff",
    content: "Vou te conectar com um atendente. Aguarde! 🙏",
    posX: 100, posY: 500,
  }).returning().get();

  const endNode = db.insert(flowNodes).values({
    botId, workspaceId: wsId, type: "end",
    content: "Obrigado pelo contato! 😊 Até logo!",
    posX: 400, posY: 500,
  }).returning().get();

  // Create edges: start → menu
  db.insert(flowEdges).values({ botId, workspaceId: wsId, sourceNodeId: startNode.id, targetNodeId: menuNode.id }).run();

  // Menu options 1,2,3 → handoff; option 4 → end
  const optCount = template.menuOptions.length;
  for (let i = 1; i <= optCount; i++) {
    const target = i === optCount ? endNode.id : handoffNode.id;
    db.insert(flowEdges).values({
      botId, workspaceId: wsId,
      sourceNodeId: menuNode.id, targetNodeId: target,
      condition: String(i), label: template.menuOptions[i - 1]?.label ?? `Opção ${i}`,
    }).run();
  }

  invalidateFlowCache(botId);
}

// ─── Build node response text ────────────────────────────────────────────────
function buildNodeResponse(node: typeof flowNodes.$inferSelect): string {
  if (node.type === "menu" && node.metadata?.options) {
    const opts = node.metadata.options
      .map((o: { value: string; emoji?: string; label: string }) => `${o.value}. ${o.emoji ?? ""} ${o.label}`.trim())
      .join("\n");
    return `${node.content ?? ""}\n\n${opts}`;
  }
  return node.content ?? "";
}

// ─── Execute flow step ────────────────────────────────────────────────────────
export async function executeFlowStep(
  db: Db, wsId: number, conversationId: number, botId: number, userMessage: string
): Promise<{ reply: string; isHandoff: boolean; nextNodeId: number | null }> {
  const fallback = { reply: "Olá! Como posso te ajudar?", isHandoff: false, nextNodeId: null };

  // Get/create conversation state
  let state = db.select().from(conversationStates)
    .where(eq(conversationStates.conversationId, conversationId)).get();

  if (!state) {
    db.insert(conversationStates).values({
      conversationId, botId, workspaceId: wsId,
      currentNodeId: null, collectedData: {}, attempts: 0,
      updatedAt: new Date(),
    }).run();
    state = db.select().from(conversationStates)
      .where(eq(conversationStates.conversationId, conversationId)).get()!;
  }

  // Load flow (with cache)
  let cached = getFlowFromCache(botId);
  if (!cached) {
    const nodes = db.select().from(flowNodes).where(eq(flowNodes.botId, botId)).all();
    const edges = db.select().from(flowEdges).where(eq(flowEdges.botId, botId)).all();
    setFlowCache(botId, nodes, edges);
    cached = { nodes, edges, cachedAt: Date.now() };
  }
  const { nodes, edges } = cached;

  if (nodes.length === 0) return fallback;

  const updateState = (nodeId: number | null, attempts = 0) => {
    db.update(conversationStates)
      .set({ currentNodeId: nodeId, attempts, updatedAt: new Date() })
      .where(eq(conversationStates.conversationId, conversationId))
      .run();
  };

  // First message
  if (state.currentNodeId === null) {
    const startNode = nodes.find(n => n.type === "start");
    if (!startNode) return fallback;
    const startEdge = edges.find(e => e.sourceNodeId === startNode.id);
    const nextNode = startEdge ? nodes.find(n => n.id === startEdge.targetNodeId) : null;

    if (nextNode) {
      updateState(nextNode.id);
      const combined = `${buildNodeResponse(startNode)}\n\n${buildNodeResponse(nextNode)}`;
      return { reply: combined, isHandoff: nextNode.type === "handoff", nextNodeId: nextNode.id };
    }
    updateState(startNode.id);
    return { reply: buildNodeResponse(startNode), isHandoff: false, nextNodeId: startNode.id };
  }

  // Subsequent messages
  const currentNode = nodes.find(n => n.id === state!.currentNodeId);
  if (!currentNode) {
    updateState(null);
    return fallback;
  }

  const nodeEdges = edges.filter(e => e.sourceNodeId === currentNode.id);

  if (currentNode.type === "menu") {
    const trimmed = userMessage.trim();
    const matched = nodeEdges.find(e => e.condition === trimmed);
    if (matched) {
      const target = nodes.find(n => n.id === matched.targetNodeId);
      if (target) {
        if (target.type === "end") { updateState(null); }
        else { updateState(target.id); }
        return {
          reply: buildNodeResponse(target),
          isHandoff: target.type === "handoff",
          nextNodeId: target.type === "end" ? null : target.id,
        };
      }
    }
    // Invalid option
    const newAttempts = (state.attempts ?? 0) + 1;
    updateState(currentNode.id, newAttempts);
    const optNums = (currentNode.metadata?.options ?? []).map((o: { value: string }) => o.value).join(", ");
    return {
      reply: `Opção inválida. Por favor escolha: ${optNums}\n\n${buildNodeResponse(currentNode)}`,
      isHandoff: false,
      nextNodeId: currentNode.id,
    };
  }

  if (currentNode.type === "input") {
    const saveAs = currentNode.metadata?.saveAs;
    if (saveAs) {
      const collected = { ...(state.collectedData ?? {}), [saveAs]: userMessage };
      db.update(conversationStates)
        .set({ collectedData: collected, updatedAt: new Date() })
        .where(eq(conversationStates.conversationId, conversationId))
        .run();
    }
    const edge = nodeEdges[0];
    if (edge) {
      const target = nodes.find(n => n.id === edge.targetNodeId);
      if (target) {
        updateState(target.id);
        return { reply: buildNodeResponse(target), isHandoff: target.type === "handoff", nextNodeId: target.id };
      }
    }
    return fallback;
  }

  if (currentNode.type === "condition") {
    const keyword = currentNode.metadata?.keyword ?? "";
    const matches = userMessage.toLowerCase().includes(keyword.toLowerCase());
    const edge = matches ? nodeEdges[0] : nodeEdges[1] ?? nodeEdges[0];
    if (edge) {
      const target = nodes.find(n => n.id === edge.targetNodeId);
      if (target) {
        updateState(target.id);
        return { reply: buildNodeResponse(target), isHandoff: target.type === "handoff", nextNodeId: target.id };
      }
    }
    return fallback;
  }

  if (currentNode.type === "handoff") {
    return { reply: buildNodeResponse(currentNode), isHandoff: true, nextNodeId: currentNode.id };
  }

  if (currentNode.type === "end") {
    updateState(null);
    return { reply: buildNodeResponse(currentNode), isHandoff: false, nextNodeId: null };
  }

  if (currentNode.type === "message") {
    const edge = nodeEdges[0];
    if (edge) {
      const target = nodes.find(n => n.id === edge.targetNodeId);
      if (target) {
        updateState(target.id);
        return { reply: buildNodeResponse(target), isHandoff: target.type === "handoff", nextNodeId: target.id };
      }
    }
    return { reply: buildNodeResponse(currentNode), isHandoff: false, nextNodeId: currentNode.id };
  }

  return fallback;
}

// ─── Router ───────────────────────────────────────────────────────────────────
async function getWsId(userId: number): Promise<number> {
  const db = getDb();
  const member = db.select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).get();
  if (!member) throw new TRPCError({ code: "NOT_FOUND" });
  return member.workspaceId;
}

export const flowsRouter = router({
  getFlow: protectedProcedure
    .input(z.object({ botId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      const nodes = db.select().from(flowNodes).where(and(eq(flowNodes.botId, input.botId), eq(flowNodes.workspaceId, wsId))).all();
      const edges = db.select().from(flowEdges).where(and(eq(flowEdges.botId, input.botId), eq(flowEdges.workspaceId, wsId))).all();
      const msgs = db.select().from(autoMessages).where(and(eq(autoMessages.botId, input.botId), eq(autoMessages.workspaceId, wsId))).all();
      return { nodes, edges, autoMessages: msgs };
    }),

  saveFlow: protectedProcedure
    .input(z.object({
      botId: z.number(),
      nodes: z.array(z.object({
        id: z.number().optional(),
        type: z.enum(["start", "message", "menu", "input", "condition", "handoff", "end"]),
        content: z.string().optional(),
        metadata: z.any().optional(),
        posX: z.number().default(0),
        posY: z.number().default(0),
      })),
      edges: z.array(z.object({
        sourceNodeId: z.number(),
        targetNodeId: z.number(),
        label: z.string().optional(),
        condition: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);

      db.delete(flowEdges).where(and(eq(flowEdges.botId, input.botId), eq(flowEdges.workspaceId, wsId))).run();
      db.delete(flowNodes).where(and(eq(flowNodes.botId, input.botId), eq(flowNodes.workspaceId, wsId))).run();

      const savedNodes = input.nodes.map(n =>
        db.insert(flowNodes).values({ ...n, botId: input.botId, workspaceId: wsId }).returning().get()
      );

      for (const e of input.edges) {
        db.insert(flowEdges).values({
          botId: input.botId, workspaceId: wsId,
          sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId,
          label: e.label, condition: e.condition,
        }).run();
      }

      invalidateFlowCache(input.botId);
      return { ok: true };
    }),

  initDefaultFlow: protectedProcedure
    .input(z.object({
      botId: z.number(),
      niche: z.enum(["clinic", "law", "realestate", "beauty", "restaurant", "ecommerce", "education", "freelancer", "custom"]),
      businessName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      await buildDefaultFlow(db, wsId, input.botId, input.niche as Niche, input.businessName);
      return { ok: true };
    }),

  processMessage: protectedProcedure
    .input(z.object({ conversationId: z.number(), botId: z.number(), userMessage: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);
      return executeFlowStep(db, wsId, input.conversationId, input.botId, input.userMessage);
    }),

  previewMessage: protectedProcedure
    .input(z.object({ botId: z.number(), currentNodeId: z.number().optional(), userMessage: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const wsId = await getWsId(ctx.user.id);

      // Use a fake conversationId for preview (-1 * botId)
      const fakeConvId = -(input.botId);

      // Check if preview conversation state exists, create if not
      const existing = db.select().from(conversationStates)
        .where(eq(conversationStates.conversationId, fakeConvId)).get();

      if (!existing) {
        // Create a fake conversation record if needed
        // For preview, we bypass real conversation and just simulate
      }

      // For preview, create a temporary state
      if (input.currentNodeId !== undefined) {
        if (existing) {
          db.update(conversationStates)
            .set({ currentNodeId: input.currentNodeId, updatedAt: new Date() })
            .where(eq(conversationStates.conversationId, fakeConvId))
            .run();
        }
      }

      // Load flow and simulate
      const nodes = db.select().from(flowNodes).where(and(eq(flowNodes.botId, input.botId), eq(flowNodes.workspaceId, wsId))).all();
      const edges = db.select().from(flowEdges).where(and(eq(flowEdges.botId, input.botId), eq(flowEdges.workspaceId, wsId))).all();

      if (nodes.length === 0) return { reply: "Nenhum fluxo configurado.", isHandoff: false, nextNodeId: null };

      const startNode = nodes.find(n => n.type === "start");
      if (!startNode) return { reply: "Nó inicial não encontrado.", isHandoff: false, nextNodeId: null };

      // Simple simulation: return start + menu
      const startEdge = edges.find(e => e.sourceNodeId === startNode.id);
      const nextNode = startEdge ? nodes.find(n => n.id === startEdge.targetNodeId) : null;

      const combined = nextNode
        ? `${buildNodeResponse(startNode)}\n\n${buildNodeResponse(nextNode)}`
        : buildNodeResponse(startNode);

      return { reply: combined, isHandoff: false, nextNodeId: nextNode?.id ?? startNode.id };
    }),
});
