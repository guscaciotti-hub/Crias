import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { EventEmitter } from "events";
import { rmSync, mkdirSync, existsSync } from "fs";
import { getDb } from "../db.js";
import { whatsappInstances, bots } from "../../drizzle/schema.js";
import { eq } from "drizzle-orm";
import pino from "pino";
import QRCode from "qrcode";

const silentLogger = pino({ level: "silent" });

// Cache versão do WA
let _baileysVersion: [number, number, number] | null = null;
async function getBaileysVersion(): Promise<[number, number, number]> {
  if (_baileysVersion) return _baileysVersion;
  try {
    const { version } = await fetchLatestBaileysVersion();
    _baileysVersion = version;
    return version;
  } catch {
    _baileysVersion = [2, 3000, 1023531250];
    return _baileysVersion;
  }
}

const instances = new Map<number, any>();
const qrCodes = new Map<number, string>();
const instanceStatus = new Map<number, string>();
const reconnectAttempts = new Map<number, number>();
const lastError = new Map<number, { code: number | string; reason: string }>();
const pairingPhones = new Map<number, string>();
const pairingCodes = new Map<number, string>();
const emitter = new EventEmitter();

let messageHandler: ((botId: number, from: string, text: string) => Promise<string | null>) | null = null;

export function setMessageHandler(handler: typeof messageHandler) { messageHandler = handler; }
export function getInstanceStatus(botId: number) { return instanceStatus.get(botId); }
export function getLastError(botId: number) { return lastError.get(botId) ?? null; }
export function getCurrentQR(botId: number) { return qrCodes.get(botId) ?? null; }
export function getPairingCode(botId: number) { return pairingCodes.get(botId) ?? null; }
export function getInstance(botId: number) { return instances.get(botId); }

export async function sendMessage(botId: number, to: string, text: string) {
  const sock = instances.get(botId);
  if (!sock || instanceStatus.get(botId) !== "connected") return;
  const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
  try { await sock.sendMessage(jid, { text }); } catch (e) {
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

function clearAll(botId: number) {
  instances.delete(botId);
  qrCodes.delete(botId);
  pairingCodes.delete(botId);
  pairingPhones.delete(botId);
  reconnectAttempts.delete(botId);
  lastError.delete(botId);
}

export function forceRestartInstance(botId: number) {
  clearAll(botId);
  instanceStatus.set(botId, "connecting");
  clearSession(botId);
  startInstance(botId).catch(console.error);
}

export function startPairingInstance(botId: number, phoneNumber: string) {
  clearAll(botId);
  pairingPhones.set(botId, phoneNumber.replace(/\D/g, ""));
  instanceStatus.set(botId, "connecting");
  clearSession(botId);
  startInstance(botId).catch(console.error);
}

export async function disconnectInstance(botId: number) {
  const sock = instances.get(botId);
  if (sock) { try { await sock.logout(); } catch {} }
  clearAll(botId);
  instanceStatus.set(botId, "disconnected");
}

export async function restoreInstances(connectedBotIds: number[]) {
  for (const botId of connectedBotIds) {
    if (existsSync(sessDir(botId))) {
      startInstance(botId).catch((err) =>
        console.error(`[Baileys] Failed to restore bot ${botId}:`, err)
      );
    }
  }
}

async function buildProxyAgent() {
  const url = process.env.WHATSAPP_PROXY;
  if (!url) return undefined;
  try {
    if (url.startsWith("socks")) {
      const mod = await import("socks-proxy-agent");
      return new (mod as any).SocksProxyAgent(url);
    }
    const mod = await import("https-proxy-agent");
    return new (mod as any).HttpsProxyAgent(url);
  } catch (e) {
    console.error("[Baileys] Failed to build proxy agent:", e);
    return undefined;
  }
}

async function startInstance(botId: number) {
  if (instances.has(botId)) return;

  console.log(`[Baileys] Starting instance for bot ${botId}`);

  const dir = sessDir(botId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const version = await getBaileysVersion();
  const proxyAgent = await buildProxyAgent();
  if (proxyAgent) console.log(`[Baileys] Bot ${botId} using proxy from WHATSAPP_PROXY`);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
    },
    printQRInTerminal: false,
    logger: silentLogger,
    browser: ["AtendêAI", "Chrome", "1.0.0"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
    retryRequestDelayMs: 2000,
    ...(proxyAgent ? { agent: proxyAgent, fetchAgent: proxyAgent } : {}),
  });

  instances.set(botId, sock);
  instanceStatus.set(botId, "connecting");

  // Phone pairing
  const pairingPhone = pairingPhones.get(botId);
  if (pairingPhone && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(pairingPhone);
        pairingCodes.set(botId, code);
        instanceStatus.set(botId, "pairing");
        console.log(`[Baileys] Bot ${botId} pairing code: ${code}`);
      } catch (e) {
        console.error(`[Baileys] Bot ${botId} pairing code failed:`, e);
        instanceStatus.set(botId, "error");
        lastError.set(botId, { code: "pairing_failed", reason: (e as Error).message });
      }
    }, 3000);
  }

  sock.ev.on("creds.update", () => { reconnectAttempts.delete(botId); saveCreds(); });

  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }: any) => {
    if (qr) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        qrCodes.set(botId, qrDataUrl);
        instanceStatus.set(botId, "qr_pending");
        emitter.emit(`qr:${botId}`, qrDataUrl);
        console.log(`[Baileys] Bot ${botId} QR code ready`);
        getDb().update(whatsappInstances)
          .set({ status: "qr_pending", lastQrAt: new Date(), updatedAt: new Date() })
          .where(eq(whatsappInstances.botId, botId)).run();
      } catch {}
    }

    if (connection === "open") {
      qrCodes.delete(botId);
      pairingCodes.delete(botId);
      pairingPhones.delete(botId);
      reconnectAttempts.delete(botId);
      lastError.delete(botId);
      instanceStatus.set(botId, "connected");
      const jid = sock.user?.id ?? "";
      const phoneNumber = jid.split(":")[0].split("@")[0] ?? null;
      getDb().update(whatsappInstances)
        .set({ status: "connected", phoneNumber, connectedAt: new Date(), updatedAt: new Date() })
        .where(eq(whatsappInstances.botId, botId)).run();
      console.log(`[Baileys] Bot ${botId} connected as ${jid}`);
    }

    if (connection === "close") {
      instances.delete(botId);
      qrCodes.delete(botId);
      const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const reason = (lastDisconnect?.error as any)?.message ?? "unknown";
      lastError.set(botId, { code: statusCode ?? "?", reason });
      console.log(`[Baileys] Bot ${botId} disconnected — code ${statusCode}, reason: ${reason}`);

      if (statusCode === DisconnectReason.loggedOut) {
        clearSession(botId);
        pairingPhones.delete(botId);
        pairingCodes.delete(botId);
        reconnectAttempts.delete(botId);
        instanceStatus.set(botId, "disconnected");
        getDb().update(whatsappInstances)
          .set({ status: "disconnected", updatedAt: new Date() })
          .where(eq(whatsappInstances.botId, botId)).run();
        return;
      }

      const attempts = (reconnectAttempts.get(botId) ?? 0) + 1;
      reconnectAttempts.set(botId, attempts);
      if (attempts >= 5) {
        clearSession(botId);
        reconnectAttempts.delete(botId);
        instanceStatus.set(botId, "error");
        console.error(`[Baileys] Bot ${botId} giving up after ${attempts} attempts`);
      } else {
        instanceStatus.set(botId, "reconnecting");
        const delay = statusCode === 515 ? 1500 : 5000;
        console.log(`[Baileys] Bot ${botId} reconnecting in ${delay}ms (attempt ${attempts}/5)`);
        setTimeout(() => startInstance(botId), delay);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages: msgs, type }: any) => {
    if (type !== "notify") return;
    for (const msg of msgs) {
      if (msg.key.fromMe || !msg.message) continue;
      const from = msg.key.remoteJid ?? "";
      if (!from || from.endsWith("@g.us")) continue;
      const text =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        msg.message?.buttonsResponseMessage?.selectedDisplayText ??
        msg.message?.listResponseMessage?.title ?? "";
      if (!text.trim() || !messageHandler) continue;
      try {
        // Mark incoming message as read (looks human)
        try { await sock.readMessages([msg.key]); } catch {}

        const reply = await messageHandler(botId, from, text);
        if (reply) {
          // Tempo de Resposta configurado por agente (segundos), default 3
          const cfg = getDb().select({ d: bots.responseDelay }).from(bots).where(eq(bots.id, botId)).get();
          await humanizedSend(sock, from, reply, cfg?.d ?? 3);
        }
      } catch (e) {
        console.error(`[Baileys] Error handling message for bot ${botId}:`, e);
      }
    }
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Sends a reply the way a person would: shows "typing…" and waits before
// sending, to avoid being flagged as a bot by WhatsApp.
//
// `responseDelaySec` is the per-agent "Tempo de Resposta" (2-30s). It acts as
// the floor for the wait; the existing humanization layer (length-proportional
// typing time + ±20% jitter) operates on top and may extend it for long texts.
async function humanizedSend(sock: any, to: string, text: string, responseDelaySec = 3) {
  // Safety clamp: never below 2s, never above 30s — even if a bad value slips through.
  const baseDelayMs = Math.min(30, Math.max(2, responseDelaySec)) * 1000;

  // Humanization (unchanged behaviour): proportional typing time + jitter.
  const perChar = Number(process.env.WA_DELAY_PER_CHAR ?? 55);   // ms per character
  const maxMs   = Math.max(Number(process.env.WA_DELAY_MAX ?? 9000), baseDelayMs);

  const base = Math.min(maxMs, Math.max(baseDelayMs, text.length * perChar));
  const jitter = base * (0.8 + Math.random() * 0.4); // ±20%
  const delay = Math.round(Math.max(2000, Math.min(maxMs, jitter))); // hard floor 2s

  try {
    await sock.sendPresenceUpdate("composing", to);
    await sleep(delay);
    await sock.sendPresenceUpdate("paused", to);
  } catch {
    // presence not critical — fall through to send
  }
  await sock.sendMessage(to, { text });
}
