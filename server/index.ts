import "dotenv/config";
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

// Serve static client files in production
const clientDist = path.join(__dirname, "../../client/dist");
app.use(express.static(clientDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.listen(PORT, async () => {
  console.log(`AtendêAI server running on http://localhost:${PORT}`);
  console.log(`tRPC endpoint: http://localhost:${PORT}/trpc`);

  // Initialize message bridge
  await initMessageBridge();

  // Restore connected WhatsApp instances
  try {
    const db = getDb();
    const connected = db.select({ botId: whatsappInstances.botId })
      .from(whatsappInstances)
      .where(eq(whatsappInstances.status, "connected"))
      .all();
    if (connected.length > 0) {
      console.log(`[WhatsApp] Restoring ${connected.length} connected instance(s)...`);
      await restoreInstances(connected.map(r => r.botId));
    }
  } catch (e) {
    console.warn("[WhatsApp] Could not restore instances:", e);
  }
});

export default app;
