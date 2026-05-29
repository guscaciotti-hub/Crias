import { setMessageHandler, sendMessage } from "./baileys-manager.js";
import { getDb } from "../db.js";
import { bots, contacts, conversations, messages } from "../../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { executeFlowStep } from "../routers/flows.js";
import { runAIAgent } from "./ai-agent.js";

const botWsCache = new Map<number, number>();
const convCache  = new Map<string, number>();

// How long to wait after the last message before replying (ms).
// Users often send 2-4 short messages in a burst — we collect them all and
// respond once with a single, coherent answer.
const BATCH_WINDOW = Number(process.env.WA_BATCH_WINDOW_MS ?? 4000);

type BatchState = {
  texts: string[];
  convId: number;
  wsId: number;
  timer: ReturnType<typeof setTimeout>;
  resolvers: ((v: string | null) => void)[];
};
const pendingBatch = new Map<string, BatchState>();

export function clearBotConvCache(botId: number) {
  for (const key of [...convCache.keys()]) {
    if (key.startsWith(`${botId}:`)) convCache.delete(key);
  }
  // Abort any pending batches for this bot so stale context doesn't linger.
  for (const key of [...pendingBatch.keys()]) {
    if (key.startsWith(`${botId}:`)) {
      const b = pendingBatch.get(key)!;
      clearTimeout(b.timer);
      b.resolvers.forEach(r => r(null));
      pendingBatch.delete(key);
    }
  }
  botWsCache.delete(botId);
}

export async function initMessageBridge() {
  setMessageHandler(async (botId, from, text) => {
    try {
      const db = getDb();
      const phone = from.split("@")[0];

      // Resolve workspaceId (cached — workspace never changes for a bot)
      let wsId = botWsCache.get(botId);
      let botRow: typeof bots.$inferSelect | undefined;
      if (wsId === undefined) {
        botRow = db.select().from(bots).where(eq(bots.id, botId)).get();
        if (!botRow) return null;
        wsId = botRow.workspaceId;
        botWsCache.set(botId, wsId);
      }
      const resolvedWsId: number = wsId;
      if (!botRow) {
        botRow = db.select().from(bots).where(eq(bots.id, botId)).get();
        if (!botRow) return null;
      }

      // Resolve or create contact
      let contact = db.select().from(contacts)
        .where(and(eq(contacts.botId, botId), eq(contacts.phone, phone))).get();
      if (!contact) {
        contact = db.insert(contacts).values({
          botId, workspaceId: resolvedWsId, phone, name: phone,
          firstSeenAt: new Date(), lastSeenAt: new Date(), messageCount: 0,
        }).returning().get();
      } else {
        db.update(contacts)
          .set({ lastSeenAt: new Date(), messageCount: (contact.messageCount ?? 0) + 1 })
          .where(eq(contacts.id, contact.id)).run();
      }

      // Resolve or create active conversation
      const cacheKey = `${botId}:${phone}`;
      let convId = convCache.get(cacheKey);
      if (convId === undefined) {
        const existing = db.select().from(conversations)
          .where(and(
            eq(conversations.botId, botId),
            eq(conversations.contactId, contact.id),
            eq(conversations.status, "active"),
          )).get();
        convId = existing
          ? existing.id
          : db.insert(conversations).values({
              botId, workspaceId: resolvedWsId, contactId: contact.id, status: "active",
            }).returning().get().id;
        convCache.set(cacheKey, convId);
      }
      const resolvedConvId: number = convId;

      // ── Flow mode: stateful/sequential — process immediately ─────────────
      if (botRow.agentMode !== "ai") {
        db.insert(messages).values({
          conversationId: resolvedConvId, workspaceId: resolvedWsId, role: "user", content: text,
        }).run();
        const result = await executeFlowStep(db, resolvedWsId, resolvedConvId, botId, text);
        db.insert(messages).values({
          conversationId: resolvedConvId, workspaceId: resolvedWsId, role: "bot", content: result.reply,
        }).run();
        if (result.isHandoff) {
          db.update(conversations).set({ status: "handoff", updatedAt: new Date() })
            .where(eq(conversations.id, resolvedConvId)).run();
          convCache.delete(cacheKey);
        }
        return result.reply;
      }

      // ── AI mode: debounce rapid-fire messages, reply once ─────────────────
      // When someone sends 3-4 short messages in a row, we wait BATCH_WINDOW ms
      // after the last one, join all texts, and answer with a single response.
      return new Promise<string | null>((resolve) => {
        const batchKey = `${botId}:${phone}`;
        let batch = pendingBatch.get(batchKey);
        if (batch) {
          clearTimeout(batch.timer);
          batch.texts.push(text);
          batch.resolvers.push(resolve);
        } else {
          batch = {
            texts: [text],
            convId: resolvedConvId,
            wsId: resolvedWsId,
            timer: null!,
            resolvers: [resolve],
          };
          pendingBatch.set(batchKey, batch);
        }

        const b = batch;
        b.timer = setTimeout(async () => {
          pendingBatch.delete(batchKey);
          // Join all buffered texts into one turn (newline-separated)
          const combined = b.texts.join("\n");

          try {
            const freshBot = db.select().from(bots).where(eq(bots.id, botId)).get();
            if (!freshBot) { b.resolvers.forEach(r => r(null)); return; }

            // Save the full user turn ONCE before calling AI so the AI sees it
            // in context, but only one DB record for the whole burst.
            db.insert(messages).values({
              conversationId: b.convId, workspaceId: b.wsId, role: "user", content: combined,
            }).run();

            const result = await runAIAgent(db, botId, b.convId, combined);

            db.insert(messages).values({
              conversationId: b.convId, workspaceId: b.wsId, role: "bot", content: result.reply,
            }).run();

            if (result.isHandoff) {
              db.update(conversations).set({ status: "handoff", updatedAt: new Date() })
                .where(eq(conversations.id, b.convId)).run();
              convCache.delete(batchKey);

              const alertNums = (freshBot.alertNumbers ?? []) as string[];
              if (alertNums.length > 0) {
                const alertText =
                  `🔔 *Novo atendimento humano* — ${freshBot.businessName}\n` +
                  `👤 Cliente: ${phone}\n` +
                  `💬 Última mensagem: "${b.texts.at(-1)}"\n\n` +
                  `Acesse o painel para continuar o atendimento.`;
                for (const num of alertNums) sendMessage(botId, num, alertText).catch(() => {});
              }
            }

            // The LAST resolver in the batch delivers the reply via humanizedSend.
            // Earlier ones return null — no duplicate sends.
            for (let i = 0; i < b.resolvers.length - 1; i++) b.resolvers[i](null);
            b.resolvers[b.resolvers.length - 1](result.reply);

          } catch (e) {
            console.error("[MessageBridge] Batch error:", e);
            b.resolvers.forEach(r => r(null));
          }
        }, BATCH_WINDOW);
      });

    } catch (e) {
      console.error("[MessageBridge] Error:", e);
      return null;
    }
  });
}
