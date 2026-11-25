// ═══════════════════════════════════════════════════════════════════════════
// Compatibility shim. WS-1F/1E import the messaging contract from here; the
// real implementation (outbox RPC + WhatsApp/SMS dispatcher, wa.me fallback)
// now lives in src/lib/messaging (WS-1C). New code should import from
// "@/lib/messaging".
// ═══════════════════════════════════════════════════════════════════════════
export { enqueueMessage, enqueueMessages } from "./messaging/enqueue";
export type { EnqueueMessageInput, EnqueueMessageResult } from "./messaging/enqueue";
export { buildWaLink, normalizePhoneForWa } from "./messaging/phone";
export type { MessageChannel, MessageTemplate } from "./messaging/types";
