import { Redis } from "@upstash/redis";

export type SpendBucket = {
  tokens: number;
  dollars: number;
  since?: string;
};

export type ToolCall = {
  id: string;
  tool: string;
  started_at: string | null;
  duration_ms: number | null;
  status: "ok" | "error" | "running" | "runaway";
  is_error: boolean;
};

export type AlertRow = {
  fired_at: string;
  rule: string;
  summary: string;
  session_id: string | null;
};

export type SessionRow = {
  id: string;
  started_at: string;
  last_event_at: string;
  model: string;
  tokens_total: number;
  dollars_total: number;
};

export type Snapshot = {
  schema_version: number;
  updated_at: string;
  host: string;
  openclaw_active: boolean;
  status: { level: "green" | "yellow" | "red"; reason: string };
  spend: { today: SpendBucket; last_hour: SpendBucket; last_7d: SpendBucket };
  tool_calls: ToolCall[];
  alerts: AlertRow[];
  sessions: SessionRow[];
};

const SNAPSHOT_KEY = "clawwatch:snapshot";
const STALE_AFTER_MS = 3 * 60 * 1000;

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_READ_ONLY_TOKEN ?? process.env.KV_REST_API_TOKEN!,
});

export async function readSnapshot(): Promise<{ snapshot: Snapshot | null; stale: boolean }> {
  const raw = await redis.get<Snapshot | string>(SNAPSHOT_KEY);
  if (!raw) return { snapshot: null, stale: true };

  const snap: Snapshot = typeof raw === "string" ? JSON.parse(raw) : raw;
  const updatedAt = new Date(snap.updated_at).getTime();
  const stale = Date.now() - updatedAt > STALE_AFTER_MS;
  return { snapshot: snap, stale };
}
