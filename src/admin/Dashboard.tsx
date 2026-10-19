import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { supabase } from "../lib/supabase";

// The owner's dashboard, at /#admin: who's using the closet and how. It reads
// through two database functions that only answer accounts listed in the
// `admins` table (supabase/migrations/20261020000000_analytics.sql).

type UserRow = {
  id: string;
  name: string;
  phone_end: string;
  wardrobe: string;
  joined: string;
  last_seen: string | null;
  active_days: number;
  visits: number;
  browses: number;
  dress_mes: number;
  auto_dresses: number;
  saves: number;
  quizzes: number;
  clothes_uploads: number;
  me_uploads: number;
  pieces: number;
  pixel_uses: number;
  mine_uses: number;
  last_device: string | null;
};
type EventRow = { kind: string; detail: Record<string, unknown>; device: string | null; created_at: string };

const C = {
  page: "#1d1930",
  card: "#f7f7fb",
  ink: "#141433",
  soft: "#5a5a7a",
  line: "#dedee8",
  lavender: "#c3cbf3",
  blue: "#4f56f8",
  green: "#1f7a4a",
  amber: "#9a5a00",
  red: "#a3123a",
};

const DAY = 24 * 60 * 60 * 1000;
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (d <= 0) {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
    return h <= 0 ? "just now" : `${h}h ago`;
  }
  return d === 1 ? "yesterday" : `${d} days ago`;
};
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const time = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// Where someone is: new this week, came back on another day, or tried it
// once and hasn't been back for 3+ days.
function status(u: UserRow): { label: string; color: string } {
  const quiet = !u.last_seen || Date.now() - new Date(u.last_seen).getTime() > 3 * DAY;
  if (u.active_days >= 2) return { label: "Came back", color: C.green };
  if (u.visits === 0 && u.active_days === 0) return { label: "Never opened", color: C.soft };
  if (quiet) return { label: "Tried once", color: C.red };
  return { label: "New", color: C.amber };
}

function prefers(u: UserRow): string {
  const total = u.pixel_uses + u.mine_uses;
  if (!total) return "—";
  const pixel = u.pixel_uses / total;
  if (pixel >= 0.65) return "Pixel";
  if (pixel <= 0.35) return "My clothes";
  return "Both";
}

const ACTIONS: Record<string, string> = {
  visit: "Opened the closet",
  browse: "Pressed BROWSE",
  dress_me: "Pressed DRESS ME",
  auto_dress: "Pressed AUTO DRESS",
  save_look: "Saved a look",
  style_quiz: "Finished the style quiz",
  upload_clothes: "Uploaded clothes",
  upload_me: "Made their model photo",
  switch_source: "Switched closet",
};
function describe(e: EventRow): string {
  const d = e.detail ?? {};
  const base = ACTIONS[e.kind] ?? e.kind;
  if (e.kind === "switch_source") return `${base} to ${d.to === "pixel" ? "PIXEL" : "MY CLOTHES"}`;
  if (e.kind === "upload_clothes" && d.category) return `${base} (${String(d.category)})`;
  if (e.kind === "style_quiz" && d.style) return `${base}: ${String(d.style)}`;
  if (d.source) return `${base} · ${d.source === "pixel" ? "pixel" : "my clothes"}`;
  return base;
}

const card: CSSProperties = { background: C.card, color: C.ink, border: `3px solid ${C.ink}`, boxShadow: `inset 3px 3px 0 #fff, inset -3px -3px 0 #8c8ca6`, padding: 16 };
const th: CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, fontWeight: 700, color: C.soft, borderBottom: `2px solid ${C.line}`, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" };
const td: CSSProperties = { padding: "10px", borderBottom: `1px solid ${C.line}`, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };

type SortKey = "last_seen" | "joined" | "active_days" | "visits" | "uploads" | "browses" | "dress_mes" | "auto_dresses" | "saves";

export function Dashboard() {
  const [state, setState] = useState<{ kind: "loading" } | { kind: "signedOut" } | { kind: "denied" } | { kind: "error"; message: string } | { kind: "ready"; users: UserRow[] }>({ kind: "loading" });
  const [picked, setPicked] = useState<UserRow | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [sort, setSort] = useState<SortKey>("last_seen");

  const load = useCallback(async () => {
    if (!supabase) return setState({ kind: "error", message: "Supabase isn't set up in this build." });
    setState({ kind: "loading" });
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return setState({ kind: "signedOut" });
    const { data, error } = await supabase.rpc("admin_users");
    if (error) {
      if (error.code === "42501" || /not an admin/.test(error.message)) return setState({ kind: "denied" });
      if (/admin_users/.test(error.message)) return setState({ kind: "error", message: "The analytics tables aren't set up yet: run supabase/migrations/20261020000000_analytics.sql in the Supabase SQL editor." });
      return setState({ kind: "error", message: error.message });
    }
    setState({ kind: "ready", users: (data ?? []) as UserRow[] });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!picked || !supabase) return;
    setEvents(null);
    supabase.rpc("admin_events", { who: picked.id }).then(({ data }) => setEvents((data ?? []) as EventRow[]));
  }, [picked]);

  const users = state.kind === "ready" ? state.users : [];
  const sorted = useMemo(() => {
    const v = (u: UserRow): number =>
      sort === "last_seen" ? (u.last_seen ? new Date(u.last_seen).getTime() : 0)
      : sort === "joined" ? new Date(u.joined).getTime()
      : sort === "uploads" ? u.clothes_uploads + u.me_uploads
      : Number(u[sort]);
    return [...users].sort((a, b) => v(b) - v(a));
  }, [users, sort]);

  const summary = useMemo(() => {
    const week = users.filter((u) => u.last_seen && Date.now() - new Date(u.last_seen).getTime() < 7 * DAY).length;
    const back = users.filter((u) => u.active_days >= 2).length;
    const once = users.filter((u) => status(u).label === "Tried once").length;
    const uploaders = users.filter((u) => u.clothes_uploads > 0 || u.pieces > 0).length;
    const pixel = users.reduce((n, u) => n + u.pixel_uses, 0);
    const mine = users.reduce((n, u) => n + u.mine_uses, 0);
    const phones = users.filter((u) => u.last_device === "phone").length;
    const computers = users.filter((u) => u.last_device === "computer").length;
    const pct = (a: number, b: number) => (a + b ? `${Math.round((a / (a + b)) * 100)}%` : "—");
    return [
      { label: "People", value: String(users.length), note: `${week} active this week` },
      { label: "Came back", value: String(back), note: users.length ? `${Math.round((back / users.length) * 100)}% used it on 2+ days` : "" },
      { label: "Tried once", value: String(once), note: "one day, nothing for 3+ days" },
      { label: "Uploaded clothes", value: String(uploaders), note: users.length ? `${Math.round((uploaders / users.length) * 100)}% of people` : "" },
      { label: "Pixel vs my clothes", value: `${pct(pixel, mine)} pixel`, note: `${pixel} pixel · ${mine} my clothes actions` },
      { label: "Phone vs computer", value: `${pct(phones, computers)} phone`, note: `${phones} phone · ${computers} computer` },
    ];
  }, [users]);

  const page: CSSProperties = { position: "fixed", inset: 0, overflow: "auto", background: C.page, color: C.ink, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", padding: "24px 16px 48px", boxSizing: "border-box" };
  const head = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <div style={{ color: C.lavender, fontSize: 13, letterSpacing: 2, fontWeight: 700 }}>CHER'S CLOSET</div>
        <h1 style={{ margin: "4px 0 0", color: "#fff", fontSize: 26 }}>Who's using it</h1>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={load} style={{ padding: "10px 16px", background: C.blue, color: "#fff", border: "3px solid", borderColor: "#9aa0ff #20248a #20248a #9aa0ff", fontWeight: 700, cursor: "pointer" }}>Refresh</button>
        <a href="/" style={{ padding: "10px 16px", background: "#9a9db4", color: C.ink, border: "3px solid", borderColor: "#d8daea #4a4d66 #4a4d66 #d8daea", fontWeight: 700, textDecoration: "none" }}>Back to the closet</a>
      </div>
    </div>
  );

  if (state.kind !== "ready")
    return (
      <main style={page}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {head}
          <div style={{ ...card, maxWidth: 560 }}>
            {state.kind === "loading" && "Loading…"}
            {state.kind === "signedOut" && (
              <>
                Sign in first: open <a href="/">the closet</a>, sign in with your phone number, then come back to this page.
              </>
            )}
            {state.kind === "denied" && "This account isn't on the admin list, so the dashboard stays locked. Add it in the Supabase SQL editor (see the README)."}
            {state.kind === "error" && state.message}
          </div>
        </div>
      </main>
    );

  const sortable = (key: SortKey, label: string) => (
    <th style={{ ...th, color: sort === key ? C.blue : C.soft }} onClick={() => setSort(key)} aria-sort={sort === key ? "descending" : "none"}>
      {label}
      {sort === key ? " ↓" : ""}
    </th>
  );

  return (
    <main style={page}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {head}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
          {summary.map((s) => (
            <div key={s.label} style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.soft, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 2px" }}>{s.value}</div>
              <div style={{ fontSize: 13, color: C.soft }}>{s.note}</div>
            </div>
          ))}
        </section>

        <section style={{ ...card, padding: 0 }}>
          <div style={{ padding: "14px 16px 6px", fontWeight: 700 }}>People <span style={{ color: C.soft, fontWeight: 400, fontSize: 14 }}>· tap someone to see what they did</span></div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Status</th>
                  {sortable("joined", "Joined")}
                  {sortable("last_seen", "Last seen")}
                  {sortable("active_days", "Days used")}
                  {sortable("visits", "Visits")}
                  {sortable("uploads", "Uploads")}
                  {sortable("browses", "Browse")}
                  {sortable("dress_mes", "Dress me")}
                  {sortable("auto_dresses", "Auto dress")}
                  {sortable("saves", "Saved looks")}
                  <th style={th}>Prefers</th>
                  <th style={th}>Device</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((u) => {
                  const st = status(u);
                  const on = picked?.id === u.id;
                  return (
                    <tr key={u.id} onClick={() => setPicked(on ? null : u)} style={{ cursor: "pointer", background: on ? "#e8ebff" : undefined }}>
                      <td style={{ ...td, fontWeight: 700 }}>
                        <button type="button" onClick={(e) => (e.stopPropagation(), setPicked(on ? null : u))} style={{ all: "unset", cursor: "pointer" }}>
                          {u.name || "(no name)"}
                        </button>
                        <div style={{ fontWeight: 400, fontSize: 12, color: C.soft }}>{u.phone_end ? `•••${u.phone_end}` : ""}{u.wardrobe ? ` · ${u.wardrobe}` : ""}</div>
                      </td>
                      <td style={td}>
                        <span style={{ color: "#fff", background: st.color, padding: "3px 8px", fontSize: 12, fontWeight: 700 }}>{st.label}</span>
                      </td>
                      <td style={td}>{date(u.joined)}</td>
                      <td style={td}>{ago(u.last_seen)}</td>
                      <td style={td}>{u.active_days}</td>
                      <td style={td}>{u.visits}</td>
                      <td style={td}>
                        {u.clothes_uploads}
                        <span style={{ color: C.soft, fontSize: 12 }}> · {u.pieces} in closet{u.me_uploads ? " · model photo" : ""}</span>
                      </td>
                      <td style={td}>{u.browses}</td>
                      <td style={td}>{u.dress_mes}</td>
                      <td style={td}>{u.auto_dresses}</td>
                      <td style={td}>{u.saves}</td>
                      <td style={td}>{prefers(u)}</td>
                      <td style={td}>{u.last_device ?? "—"}</td>
                    </tr>
                  );
                })}
                {!sorted.length && (
                  <tr>
                    <td style={td} colSpan={13}>
                      Nobody yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {picked && (
          <section style={{ ...card, marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{picked.name || "(no name)"}</h2>
              <div style={{ color: C.soft, fontSize: 14 }}>
                Joined {date(picked.joined)} · used on {picked.active_days} {picked.active_days === 1 ? "day" : "days"} · {picked.quizzes ? "took the style quiz" : "no style quiz yet"}
              </div>
            </div>
            {!events && <p>Loading…</p>}
            {events && !events.length && <p>Nothing logged yet.</p>}
            {events && events.length > 0 && (
              <ol style={{ listStyle: "none", padding: 0, margin: "14px 0 0" }}>
                {events.map((e, i) => (
                  <li key={i} style={{ display: "flex", gap: 14, padding: "8px 0", borderTop: i ? `1px solid ${C.line}` : undefined, fontSize: 14 }}>
                    <span style={{ color: C.soft, minWidth: 130, fontVariantNumeric: "tabular-nums" }}>{time(e.created_at)}</span>
                    <span style={{ flex: 1 }}>{describe(e)}</span>
                    <span style={{ color: C.soft }}>{e.device ?? ""}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
