import type { DatabaseSync } from "node:sqlite";

/** Seeded templates from CONTRACT.md — real workflow JSON. Idempotent. */
export const TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  category: string;
  definition: Record<string, unknown>;
}> = [
  {
    id: "tpl-telegram-sheets",
    name: "Telegram message → Google Sheets",
    description:
      "Every Telegram message you receive is appended as a new row in Google Sheets.",
    category: "Communication",
    definition: {
      nodes: [
        {
          id: "telegram-trigger",
          type: "telegram-trigger",
          name: "Telegram Trigger",
          position: { x: 540, y: 80 },
          config: { chatId: "", keyword: "" },
        },
        {
          id: "sheets-append",
          type: "google-sheets-append",
          name: "Google Sheets Append Row",
          position: { x: 540, y: 320 },
          config: {
            spreadsheetId: "",
            sheet: "Sheet1",
            columns: ["message", "from", "date"],
          },
        },
      ],
      edges: [{ id: "e-telegram-sheets", source: "telegram-trigger", target: "sheets-append" }],
    },
  },
  {
    id: "tpl-daily-digest",
    name: "Daily digest email",
    description:
      "Every morning at 8:00, fetch the latest items and send yourself a digest email.",
    category: "Productivity",
    definition: {
      nodes: [
        {
          id: "schedule-trigger",
          type: "schedule-trigger",
          name: "Schedule Trigger",
          position: { x: 540, y: 80 },
          config: { cron: "0 8 * * *" },
        },
        {
          id: "http-request",
          type: "http-request",
          name: "HTTP Request",
          position: { x: 540, y: 320 },
          config: { url: "https://example.com/api/news", method: "GET" },
        },
        {
          id: "email-send",
          type: "email-send",
          name: "Email",
          position: { x: 540, y: 560 },
          config: { to: "", subject: "Your daily digest", body: "" },
        },
      ],
      edges: [
        { id: "e-digest-1", source: "schedule-trigger", target: "http-request" },
        { id: "e-digest-2", source: "http-request", target: "email-send" },
      ],
    },
  },
  {
    id: "tpl-webhook-discord",
    name: "Webhook → Discord notification",
    description:
      "Receive any webhook call and instantly post a notification to a Discord channel.",
    category: "Developer Tools",
    definition: {
      nodes: [
        {
          id: "webhook-trigger",
          type: "webhook-trigger",
          name: "Webhook Trigger",
          position: { x: 540, y: 80 },
          config: { path: "/webhook/discord-notify", method: "POST" },
        },
        {
          id: "discord-message",
          type: "discord-message",
          name: "Discord Message",
          position: { x: 540, y: 320 },
          config: { webhookUrl: "", content: "New event received: {{event}}" },
        },
      ],
      edges: [{ id: "e-webhook-discord", source: "webhook-trigger", target: "discord-message" }],
    },
  },
];

/** Integrations catalog — all honestly `not_configured` in Phase 1. */
export const INTEGRATIONS: Array<{
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  authType: string;
}> = [
  { id: "int-telegram", slug: "telegram", name: "Telegram", category: "Communication", description: "Send and receive Telegram messages from your workflows.", authType: "bot_token" },
  { id: "int-gmail", slug: "gmail", name: "Gmail", category: "Communication", description: "Read and send email through Gmail.", authType: "oauth2" },
  { id: "int-google-sheets", slug: "google-sheets", name: "Google Sheets", category: "Productivity", description: "Read and append rows in Google Sheets.", authType: "oauth2" },
  { id: "int-google-drive", slug: "google-drive", name: "Google Drive", category: "Productivity", description: "Access and manage files in Google Drive.", authType: "oauth2" },
  { id: "int-discord", slug: "discord", name: "Discord", category: "Communication", description: "Post messages to Discord channels via webhook.", authType: "webhook_url" },
  { id: "int-slack", slug: "slack", name: "Slack", category: "Communication", description: "Post messages and alerts to Slack channels.", authType: "oauth2" },
  { id: "int-notion", slug: "notion", name: "Notion", category: "Productivity", description: "Create and update pages and databases in Notion.", authType: "api_key" },
  { id: "int-openai", slug: "openai", name: "OpenAI", category: "AI", description: "Generate text and summaries with OpenAI models.", authType: "api_key" },
  { id: "int-http", slug: "http", name: "HTTP Request", category: "Developer Tools", description: "Call any HTTP API from a workflow step.", authType: "none" },
  { id: "int-webhook", slug: "webhook", name: "Webhook", category: "Developer Tools", description: "Trigger workflows from any incoming HTTP webhook.", authType: "none" },
];

export function seed(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const insertTemplate = db.prepare(
    "INSERT OR IGNORE INTO templates (id, name, description, category, definition, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const t of TEMPLATES) {
    insertTemplate.run(t.id, t.name, t.description, t.category, JSON.stringify(t.definition), now);
  }
  const insertIntegration = db.prepare(
    "INSERT OR IGNORE INTO integrations (id, slug, name, category, description, auth_type, status) VALUES (?, ?, ?, ?, ?, ?, 'not_configured')",
  );
  for (const i of INTEGRATIONS) {
    insertIntegration.run(i.id, i.slug, i.name, i.category, i.description, i.authType);
  }
}
