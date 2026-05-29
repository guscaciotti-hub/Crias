import { createRequire } from "module";
import { EventEmitter } from "events";
import { rmSync } from "fs";
import { getDb } from "../db.js";
import { whatsappInstances } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import pino from "pino";
import QRCode from "qrcode";

const require = createRequire(import.meta.url);

// Build an HTTP/SOCKS proxy agent from WHATSAPP_PROXY env var, if set.
// WhatsApp blocks datacenter IPs (AWS/Render/etc) — routing through a
// residential proxy makes the connection look like a normal home user.
// Example: WHATSAPP_PROXY=http://user:pass@host:port
//          WHATSAPP_PROXY=socks5://user:pass@host:port
function buildProxyAgent(): any {
  const url = process.env.WHATSAPP_PROXY;
  if (!url) return undefined;
  try {
    if (url.startsWith("socks")) {
      const { SocksProxyAgent } = require("socks-proxy-agent");
      return new SocksProxyAgent(url);
    }
    const { HttpsProxyAgent } = require("https-proxy-agent");
    return new HttpsProxyAgent(url);
  } catch (e) {
    console.error("[Baileys] Failed to build proxy agent:", e);
    return undefined;
  }
}

// Active instances map: botId → socket
const instances = new Map<number, any>();

// Pending QR codes: botId → base64 data URL
const qrCodes = new Map<number, string>();

// Instance status: botId → status string
const instanceStatus = new Map<number, string>();

// Reconnect attempt counter: botId → count (reset on QR scan or manual restart)
const reconnectAttempts = new Map<number, number>();

// Last disconnect diagnostic: botId → { code, reason }
const lastError = new Map<number, { code: number | string; reason: string }>();

// Phone pairing: botId → phone digits (set before startInstance)
const pairingPhones = new Map<number, string>();

// Pairing codes returned by WhatsApp: botId → "XXXX-YYYY"
const pairingCodes = new Map<number, string>();

// Message handler (injected by message-bridge)
let messageHandler: ((botId: number, from: string, text: string) => Promise<string | null>) | null = null;

export function setMessageHandler(handler: typeof messageHandler) {
  messageHandler = handler;
}

export function getInstanceStatus(botId: number): string | undefined {
  return instanceStatus.get(botId);
}

export function getLastError(botId: number): { code: number | string; reason: string } | null {
  return lastError.get(botId) ?? null;
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
  pairingCodes.delete(botId);
  pairingPhones.delete(botId);
  reconnectAttempts.delete(botId);
  lastError.delete(botId);
  instanceStatus.set(botId, "connecting");
  clearSession(botId);
  startInstance(botId).catch(console.error);
}

export function startPairingInstance(botId: number, phoneNumber: string) {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  instances.delete(botId);
  qrCodes.delete(botId);
  pairingCodes.delete(botId);
  reconnectAttempts.delete(botId);
  lastError.delete(botId);
  pairingPhones.set(botId, cleanPhone);
  instanceStatus.set(botId, "connecting");
  clearSession(botId);
  startInstance(botId).catch(console.error);
}

export function getPairingCode(botId: number): string | null {
  return pairingCodes.get(botId) ?? null;
}

export async function disconnectInstance(botId: number) {
  const sock = instances.get(botId);
  if (sock) {
    try { await sock.logout(); } catch {}
    instances.delete(botId);
  }
  instanceStatus.set(botId, "disconnected");
  qrCodes.delete(botId);
  pairingCodes.delete(botId);
  pairingPhones.delete(botId);
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

    let fetchLatestBaileysVersion: any, Browsers: any;
    try {
      const baileys = require("@whiskeysockets/baileys");
      // Baileys 6.x exports named exports via CJS
      makeWASocket = baileys.makeWASocket ?? baileys.default?.makeWASocket;
      useMultiFileAuthState = baileys.useMultiFileAuthState ?? baileys.default?.useMultiFileAuthState;
      fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion ?? baileys.default?.fetchLatestBaileysVersion;
      Browsers = baileys.Browsers ?? baileys.default?.Browsers;
      if (!makeWASocket || !useMultiFileAuthState) throw new Error("makeWASocket not found in module");
    } catch (e) {
      console.error("[Baileys] Failed to load library:", e);
      instanceStatus.set(botId, "error");
      clearTimeout(timeout);
      return;
    }

    // Fetch the current WhatsApp Web version so Baileys isn't rejected for being outdated
    let waVersion: [number, number, number] | undefined;
    try {
      const { version, isLatest } = await fetchLatestBaileysVersion();
      waVersion = version;
      console.log(`[Baileys] Bot ${botId} WA version ${version.join(".")} (isLatest=${isLatest})`);
    } catch (e) {
      console.warn("[Baileys] Could not fetch latest version, using built-in:", (e as Error).message);
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessDir(botId));

    const proxyAgent = buildProxyAgent();
    if (proxyAgent) console.log(`[Baileys] Bot ${botId} using proxy from WHATSAPP_PROXY`);

    const sock = makeWASocket({
      version: waVersion,
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: Browsers ? Browsers.ubuntu("Desktop") : ["Ubuntu", "Desktop", "22.04.4"],
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      retryRequestDelayMs: 2000,
      ...(proxyAgent ? { agent: proxyAgent, fetchAgent: proxyAgent } : {}),
    });

  instances.set(botId, sock);
  instanceStatus.set(botId, "connecting");

  // Phone pairing: request code shortly after socket creation if a phone was provided
  const pairingPhone = pairingPhones.get(botId);
  if (pairingPhone && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(pairingPhone);
        pairingCodes.set(botId, code);
        instanceStatus.set(botId, "pairing");
        clearTimeout(timeout);
        console.log(`[Baileys] Bot ${botId} pairing code: ${code}`);
      } catch (e) {
        console.error(`[Baileys] Bot ${botId} pairing code failed:`, e);
        instanceStatus.set(botId, "error");
        lastError.set(botId, { code: "pairing_failed", reason: (e as Error).message });
        clearTimeout(timeout);
      }
    }, 3000);
  }

  sock.ev.on("creds.update", () => {
    reconnectAttempts.delete(botId); // QR was scanned — reset retry counter
    saveCreds();
  });

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
      pairingCodes.delete(botId);
      pairingPhones.delete(botId);
      reconnectAttempts.delete(botId);
      lastError.delete(botId);
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
      qrCodes.delete(botId); // always clear stale QR on close
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const reason = (lastDisconnect?.error as any)?.message ?? "unknown";
      lastError.set(botId, { code: statusCode ?? "?", reason });
      console.log(`[Baileys] Bot ${botId} disconnected — code ${statusCode}, reason: ${reason}`);

      // 515 = restartRequired: NORMAL after a successful QR scan. Reconnect fast
      // reusing the just-saved credentials. This is the expected happy path.
      if (statusCode === 515) {
        const attempts = (reconnectAttempts.get(botId) ?? 0) + 1;
        reconnectAttempts.set(botId, attempts);
        if (attempts > 5) {
          // Looping on 515 means the session is being rejected after scan —
          // classic datacenter-IP block by WhatsApp. Stop and report.
          clearTimeout(timeout);
          clearSession(botId);
          reconnectAttempts.delete(botId);
          instanceStatus.set(botId, "error");
          console.error(`[Baileys] Bot ${botId} stuck in 515 loop — likely IP blocked by WhatsApp`);
        } else {
          console.log(`[Baileys] Bot ${botId} restart required (515), reconnecting #${attempts}`);
          instanceStatus.set(botId, "reconnecting");
          setTimeout(() => startInstance(botId), 1500);
        }
        return;
      }

      // 401/403/405 = rejected, 500 = badSession (corrupted/invalid signature).
      // All mean the session can't be reused — clear it and wait for a fresh QR.
      const sessionInvalid =
        statusCode === 401 || statusCode === 403 || statusCode === 405 || statusCode === 500;

      if (sessionInvalid) {
        clearTimeout(timeout);
        clearSession(botId);
        reconnectAttempts.delete(botId);
        instanceStatus.set(botId, "error");
        const db = getDb();
        db.update(whatsappInstances)
          .set({ status: "disconnected", updatedAt: new Date() })
          .where(eq(whatsappInstances.botId, botId))
          .run();
      } else {
        // 428 connectionClosed, network blips, etc. — retry a few times
        const attempts = (reconnectAttempts.get(botId) ?? 0) + 1;
        reconnectAttempts.set(botId, attempts);
        console.log(`[Baileys] Bot ${botId} will reconnect (attempt ${attempts}/5)`);

        if (attempts >= 5) {
          clearTimeout(timeout);
          clearSession(botId);
          reconnectAttempts.delete(botId);
          instanceStatus.set(botId, "error");
          console.error(`[Baileys] Bot ${botId} giving up after ${attempts} reconnect attempts`);
        } else {
          instanceStatus.set(botId, "reconnecting");
          setTimeout(() => startInstance(botId), 5000);
        }
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
