import { createRequire } from "module";
import { EventEmitter } from "events";
import { rmSync } from "fs";
import { getDb } from "../db.js";
import { whatsappInstances } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import pino from "pino";
import QRCode from "qrcode";

const require = createRequire(import.meta.url);

// Active instances map: botId → socket
const instances = new Map<number, any>();

// Pending QR codes: botId → base64 data URL
const qrCodes = new Map<number, string>();

// Instance status: botId → status string
const instanceStatus = new Map<number, string>();

// Message handler (injected by message-bridge)
let messageHandler: ((botId: number, from: string, text: string) => Promise<string | null>) | null = null;

export function setMessageHandler(handler: typeof messageHandler) {
  messageHandler = handler;
}

export function getInstanceStatus(botId: number): string | undefined {
  return instanceStatus.get(botId);
}

export async function getQRCode(botId: number): Promise<string | null> {
  // Check if already connected
  if (instanceStatus.get(botId) === "connected") return null;

  // Start instance and wait for QR
  startInstance(botId).catch(console.error);

  // Wait up to 15s for QR code
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 500));
    const qr = qrCodes.get(botId);
    if (qr) return qr;
    if (instanceStatus.get(botId) === "connected") return null;
  }
  return null;
}

export function getInstance(botId: number) {
  return instances.get(botId);
}

export function getCurrentQR(botId: number): string | null {
  return qrCodes.get(botId) ?? null;
}

export async function sendMessage(botId: number, to: string, text: string): Promise<void> {
  const sock = instances.get(botId);
  if (!sock || instanceStatus.get(botId) !== "connected") return;
  const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jid, { text });
  } catch (e) {
    console.error("[BaileysManager] sendMessage failed:", e);
  }
}

function sessDir(botId: number) {
  return process.env.SESSIONS_DIR
    ? `${process.env.SESSIONS_DIR}/bot-${botId}`
    : `./sessions/bot-${botId}`;
}

function clearSession(botId: number) {
  try { rmSync(sessDir(botId), { recursive: true, force: true }); } catch {}
}

export function forceRestartInstance(botId: number) {
  instances.delete(botId);
  qrCodes.delete(botId);
  instanceStatus.set(botId, "connecting");
  clearSession(botId); // wipe stale credentials so Baileys generates a fresh QR
  startInstance(botId).catch(console.error);
}

export async function disconnectInstance(botId: number) {
  const sock = instances.get(botId);
  if (sock) {
    try { await sock.logout(); } catch {}
    instances.delete(botId);
  }
  instanceStatus.set(botId, "disconnected");
  qrCodes.delete(botId);
}

export async function restoreInstances(connectedBotIds: number[]) {
  for (const botId of connectedBotIds) {
    startInstance(botId).catch(console.error);
  }
}

async function startInstance(botId: number) {
  if (instances.has(botId)) return;

  console.log(`[Baileys] Starting instance for bot ${botId}`);

  // Timeout: if no QR and no connection in 25s, mark as error
  const timeout = setTimeout(() => {
    if (instanceStatus.get(botId) === "connecting") {
      console.error(`[Baileys] Bot ${botId} timed out waiting for QR`);
      instanceStatus.set(botId, "error");
    }
  }, 25000);

  try {
    let makeWASocket: any, useMultiFileAuthState: any;

    try {
      const baileys = require("@whiskeysockets/baileys");
      // Baileys 6.x exports named exports via CJS
      makeWASocket = baileys.makeWASocket ?? baileys.default?.makeWASocket;
      useMultiFileAuthState = baileys.useMultiFileAuthState ?? baileys.default?.useMultiFileAuthState;
      if (!makeWASocket || !useMultiFileAuthState) throw new Error("makeWASocket not found in module");
    } catch (e) {
      console.error("[Baileys] Failed to load library:", e);
      instanceStatus.set(botId, "error");
      clearTimeout(timeout);
      return;
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessDir(botId));

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["AtendêAI Bot", "Safari", "3.0"],
      syncFullHistory: false,
    });

  instances.set(botId, sock);
  instanceStatus.set(botId, "connecting");

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }: any) => {
    if (qr) {
      clearTimeout(timeout); // QR arrived — cancel the error timeout
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        qrCodes.set(botId, qrDataUrl);
        instanceStatus.set(botId, "qr_pending");
        console.log(`[Baileys] Bot ${botId} QR code ready`);

        const db = getDb();
        db.update(whatsappInstances)
          .set({ status: "qr_pending", lastQrAt: new Date(), updatedAt: new Date() })
          .where(eq(whatsappInstances.botId, botId))
          .run();
      } catch {}
    }

    if (connection === "open") {
      clearTimeout(timeout);
      qrCodes.delete(botId);
      instanceStatus.set(botId, "connected");

      const db = getDb();
      const info = sock.authState?.creds?.me;
      db.update(whatsappInstances)
        .set({
          status: "connected",
          phoneNumber: info?.id?.split(":")?.[0] ?? null,
          connectedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappInstances.botId, botId))
        .run();

      console.log(`[Baileys] Bot ${botId} connected as ${info?.id}`);
    }

    if (connection === "close") {
      instances.delete(botId);
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const reason = (lastDisconnect?.error as any)?.message ?? "unknown";
      console.log(`[Baileys] Bot ${botId} disconnected — code ${statusCode}, reason: ${reason}`);

      // 401/403 = logged out, 405 = connection failure (session rejected)
      // All three mean the session is invalid — don't retry, clear and wait for new QR
      const sessionInvalid = statusCode === 401 || statusCode === 403 || statusCode === 405;

      if (sessionInvalid) {
        clearTimeout(timeout);
        clearSession(botId);
        instanceStatus.set(botId, "error");
        const db = getDb();
        db.update(whatsappInstances)
          .set({ status: "disconnected", updatedAt: new Date() })
          .where(eq(whatsappInstances.botId, botId))
          .run();
      } else {
        instanceStatus.set(botId, "reconnecting");
        setTimeout(() => startInstance(botId), 5000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages: msgs, type }: any) => {
    if (type !== "notify") return;
    for (const msg of msgs) {
      if (msg.key.fromMe) continue; // NEVER process own messages
      const from = msg.key.remoteJid ?? "";
      if (!from || from.includes("@g.us")) continue; // ignore groups

      const text =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        "";
      if (!text || !messageHandler) continue;

      try {
        const reply = await messageHandler(botId, from, text);
        if (reply) await sock.sendMessage(from, { text: reply });
      } catch (e) {
        console.error(`[Baileys] Error handling message for bot ${botId}:`, e);
      }
    }
  });

  } catch (e) {
    console.error(`[Baileys] startInstance error for bot ${botId}:`, e);
    instanceStatus.set(botId, "error");
    clearTimeout(timeout);
  }
  // Note: timeout intentionally NOT cleared in finally — it must stay active
  // until the async connection.update events fire (qr/open/close).
  // It is cleared inside connection.update on success or permanent failure.
}
