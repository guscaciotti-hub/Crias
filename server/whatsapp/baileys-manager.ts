import { createRequire } from "module";
import { EventEmitter } from "events";
import { getDb } from "../db.js";
import { whatsappInstances } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import pino from "pino";
import QRCode from "qrcode";

const require = createRequire(import.meta.url);

// Cache WhatsApp version to avoid extra HTTP requests
let cachedVersion: [number, number, number] | null = null;

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

  let makeWASocket: any, useMultiFileAuthState: any, DisconnectReason: any, fetchLatestBaileysVersion: any;

  try {
    const baileys = require("@whiskeysockets/baileys");
    makeWASocket = baileys.default ?? baileys.makeWASocket ?? baileys;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
  } catch (e) {
    console.warn("Baileys not available:", e);
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/bot-${botId}`);

  if (!cachedVersion && fetchLatestBaileysVersion) {
    try {
      const { version } = await fetchLatestBaileysVersion();
      cachedVersion = version;
    } catch {
      cachedVersion = [2, 3000, 1015901307];
    }
  }

  const sock = makeWASocket({
    version: cachedVersion ?? [2, 3000, 1015901307],
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["AtendêAI", "Chrome", "1.0.0"],
  });

  instances.set(botId, sock);
  instanceStatus.set(botId, "connecting");

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }: any) => {
    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr);
        qrCodes.set(botId, qrDataUrl);
        instanceStatus.set(botId, "qr_pending");

        // Update DB
        const db = getDb();
        db.update(whatsappInstances)
          .set({ status: "qr_pending", lastQrAt: new Date(), updatedAt: new Date() })
          .where(eq(whatsappInstances.botId, botId))
          .run();
      } catch {}
    }

    if (connection === "open") {
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

      console.log(`[Baileys] Bot ${botId} connected`);
    }

    if (connection === "close") {
      instances.delete(botId);
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== 401; // 401 = logged out

      if (shouldReconnect) {
        instanceStatus.set(botId, "reconnecting");
        setTimeout(() => startInstance(botId), 5000);
      } else {
        instanceStatus.set(botId, "disconnected");
        const db = getDb();
        db.update(whatsappInstances)
          .set({ status: "disconnected", updatedAt: new Date() })
          .where(eq(whatsappInstances.botId, botId))
          .run();
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
}
