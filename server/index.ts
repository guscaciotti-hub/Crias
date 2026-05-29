import dotenv from "dotenv";
import { existsSync as _existsSync } from "fs";
// Load env from a persistent location first (survives git pull / rebuild),
// then fall back to the local .env in the app directory.
const PERSISTENT_ENV = process.env.ENV_FILE || "/root/atendeai/data/.env";
if (_existsSync(PERSISTENT_ENV)) dotenv.config({ path: PERSISTENT_ENV });
dotenv.config();
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers.js";
import { createContext } from "./trpc.js";
import { getDb } from "./db.js";
import { initMessageBridge } from "./whatsapp/message-bridge.js";
import { restoreInstances } from "./whatsapp/baileys-manager.js";
import { startReactivationTimer } from "./whatsapp/reactivation-timer.js";
import { whatsappInstances } from "../drizzle/schema.js";
import { eq } from "drizzle-orm";
import { mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure sessions directory exists
try { mkdirSync("./sessions", { recursive: true }); } catch {}

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: true, credentials: true }));

// tRPC (must come BEFORE express.json so it can parse raw body)
app.use(
  "/trpc",
  createExpressMiddleware({ router: appRouter, createContext })
);

// JSON body parsing for other routes
app.use(express.json());

// Serve static client files — detect the right path automatically
import { existsSync } from "fs";
const prodPath = path.join(__dirname, "../../../client/dist");
const devPath = path.join(__dirname, "../../client/dist");
const clientDist = existsSync(prodPath) ? prodPath : devPath;
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, async () => {
  console.log(`AtendêAI server running on http://localhost:${PORT}`);
  console.log(`tRPC endpoint: http://localhost:${PORT}/trpc`);

  // Initialize message bridge
  await initMessageBridge();
  startReactivationTimer();

  // Note: on free tier (ephemeral filesystem) sessions are lost on restart,
  // so we mark all instances as disconnected and let users reconnect manually.
  // On paid tier with persistent disk, restore will work correctly.
  try {
    const db = getDb();
    const sessionsDir = process.env.SESSIONS_DIR ?? "./sessions";
    const { existsSync } = await import("fs");

    const connected = db.select({ botId: whatsappInstances.botId, id: whatsappInstances.id })
      .from(whatsappInstances)
      .where(eq(whatsappInstances.status, "connected"))
      .all();

    for (const inst of connected) {
      const hasSession = existsSync(`${sessionsDir}/bot-${inst.botId}/creds.json`);
      if (hasSession) {
        console.log(`[WhatsApp] Restoring bot ${inst.botId}...`);
        restoreInstances([inst.botId]).catch(console.error);
      } else {
        // No session file — mark disconnected so user can reconnect
        db.update(whatsappInstances)
          .set({ status: "disconnected", updatedAt: new Date() })
          .where(eq(whatsappInstances.id, inst.id))
          .run();
        console.log(`[WhatsApp] Bot ${inst.botId} has no session, marked disconnected`);
      }
    }
  } catch (e) {
    console.warn("[WhatsApp] Could not restore instances:", e);
  }
});

export default app;
