import { readSnapshot, type Snapshot } from "@/lib/snapshot";
import { fmtDollars, fmtDuration, fmtRelative, fmtTokens } from "@/lib/format";

export const revalidate = 30;

export default async function DashboardPage() {
  const { snapshot, stale } = await readSnapshot();

  if (!snapshot) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <Banner level="red" reason="no snapshot in KV — VPS pusher hasn't written yet" />
      </main>
    );
  }

  const effectiveLevel = stale ? "red" : snapshot.status.level;
  const effectiveReason = stale
    ? `snapshot stale (last updated ${fmtRelative(snapshot.updated_at)})`
    : snapshot.status.reason;

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">clawwatch</h1>
        <div className="text-xs text-zinc-500">
          host: {snapshot.host} · updated {fmtRelative(snapshot.updated_at)}
        </div>
      </header>

      <Banner level={effectiveLevel} reason={effectiveReason} />

      <SpendPanel snapshot={snapshot} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertsPanel alerts={snapshot.alerts} />
        <SessionsPanel sessions={snapshot.sessions} />
      </div>

      <ToolCallsPanel calls={snapshot.tool_calls} />

      <footer className="text-xs text-zinc-500 pt-4">
        Dollar values come from OpenAI&apos;s Costs API (real billed spend, includes reasoning
        tokens). Token counts come from OpenClaw trajectory data and exclude reasoning tokens —
        treat them as a visibility signal, not a billing one.
      </footer>
    </main>
  );
}

function Banner({
  level,
  reason,
}: {
  level: "green" | "yellow" | "red";
  reason: string;
}) {
  const styles = {
    green: "bg-emerald-50 border-emerald-200 text-emerald-900",
    yellow: "bg-amber-50 border-amber-200 text-amber-900",
    red: "bg-rose-50 border-rose-200 text-rose-900",
  }[level];

  const dot = {
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-rose-500",
  }[level];

  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${styles}`}>
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot}`} />
      <div>
        <div className="font-medium capitalize">{level}</div>
        <div className="text-sm opacity-80">{reason}</div>
      </div>
    </div>
  );
}

function SpendPanel({ snapshot }: { snapshot: Snapshot }) {
  const cells = [
    { label: "Last hour", b: snapshot.spend.last_hour },
    { label: "Today", b: snapshot.spend.today },
    { label: "Last 7d", b: snapshot.spend.last_7d },
  ];
  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-500 mb-2">Spend</h2>
      <div className="grid grid-cols-3 gap-3">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg border border-zinc-200 p-4">
            <div className="text-xs text-zinc-500">{c.label}</div>
            <div className="text-2xl font-semibold mt-1">
              {c.b.dollars_real == null ? (
                <span className="text-zinc-400">—</span>
              ) : (
                fmtDollars(c.b.dollars_real)
              )}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {fmtTokens(c.b.tokens)} tokens visible
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: Snapshot["alerts"] }) {
  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-500 mb-2">
        Recent alerts ({alerts.length})
      </h2>
      <div className="rounded-lg border border-zinc-200 overflow-hidden">
        {alerts.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No alerts yet.</div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {alerts.map((a, i) => (
              <li key={`${a.fired_at}-${i}`} className="p-3 text-sm">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-mono text-xs px-1.5 py-0.5 bg-zinc-100 rounded">
                    {a.rule}
                  </span>
                  <span className="text-xs text-zinc-500">{fmtRelative(a.fired_at)}</span>
                </div>
                <div className="mt-1 text-zinc-700 truncate">{a.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SessionsPanel({ sessions }: { sessions: Snapshot["sessions"] }) {
  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-500 mb-2">
        Active sessions ({sessions.length})
      </h2>
      <div className="rounded-lg border border-zinc-200 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No active sessions.</div>
        ) : (
          <ul className="divide-y divide-zinc-200">
            {sessions.map((s) => (
              <li key={s.id} className="p-3 text-sm">
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-mono text-xs truncate">{s.id}</span>
                  <span className="text-xs text-zinc-500">{fmtRelative(s.last_event_at)}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {s.model} · {fmtTokens(s.tokens_total)} tokens visible
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ToolCallsPanel({ calls }: { calls: Snapshot["tool_calls"] }) {
  const statusColor = (s: string) =>
    s === "ok"
      ? "text-emerald-700 bg-emerald-50"
      : s === "error"
      ? "text-rose-700 bg-rose-50"
      : s === "runaway"
      ? "text-amber-700 bg-amber-50"
      : "text-zinc-700 bg-zinc-50";

  return (
    <section>
      <h2 className="text-sm font-medium text-zinc-500 mb-2">
        Tool calls ({calls.length})
      </h2>
      <div className="rounded-lg border border-zinc-200 overflow-hidden">
        {calls.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No tool calls.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs text-zinc-500">
              <tr>
                <th className="text-left p-2 font-medium">When</th>
                <th className="text-left p-2 font-medium">Tool</th>
                <th className="text-left p-2 font-medium">Duration</th>
                <th className="text-left p-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {calls.map((c) => (
                <tr key={c.id}>
                  <td className="p-2 text-xs text-zinc-500 whitespace-nowrap">
                    {c.started_at ? fmtRelative(c.started_at) : "—"}
                  </td>
                  <td className="p-2 font-mono text-xs">{c.tool}</td>
                  <td className="p-2 text-xs">{fmtDuration(c.duration_ms)}</td>
                  <td className="p-2">
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded ${statusColor(
                        c.status
                      )}`}
                    >
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
