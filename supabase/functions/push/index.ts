// Alvøen Innegolf – push-funksjon (Supabase Edge Function, navn: "push")
//
// Handlinger:
//   subscribe   – lagrer/oppdaterer et push-abonnement med valgte kategorier (åpen)
//   unsubscribe – fjerner et abonnement (åpen)
//   send        – lagrer meldingen og sender push til alle som følger kategorien (kun admin)
//   stats       – antall enheter med varsler på (kun admin)
//   contact     – kunde sender melding via kontaktskjemaet; varsler admin (åpen, med sperre mot misbruk)
//   admin-alerts – slår av/på varsel om nye kontaktmeldinger på en admin-enhet (kun admin)
//   admin-alerts-status – om denne enheten får varsel (kun admin)
//   email-players – sender e-post fra Gmail-kontoen til alle spillere med e-post (kun admin)
//   email-status – om e-post er satt opp (kun admin)
//   alba-sync – henter nye/endrede bookinger, kunder og betalinger fra Alba Partner API (kun admin)
//   trackman-scores – henter brutto slag og tee per spiller for en runde fra Trackman-leaderboardet (kun admin)
//
// Hemmeligheter (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (f.eks. mailto:post@alvoeninnegolf.no)
// For Alba (valgfritt): ALBA_API_KEY (alba_sk_…, lesetilgang fra Alba → Innstillinger → API keys).
// For e-post (valgfritt): GMAIL_USER (f.eks. alvoeninnegolf@gmail.com) og GMAIL_APP_PASSWORD (app-passord fra Google).
// SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY settes automatisk av Supabase.
//
// Web Push er laget med Web Crypto (RFC 8291 / RFC 8292), uten eksterne push-bibliotek.

import { createClient } from "npm:@supabase/supabase-js@2";

const CATEGORIES = ["turnering", "drift"];
const CONTACT_TOPICS: Record<string, string> = {
  sporsmal: "Spørsmål", feil: "Feil eller problem", turnering: "Turnering", annet: "Annet",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ---------- Hjelpere ----------
const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

// Tåler at verdien er limt inn med anførselstegn, mellomrom eller «NAVN=» foran.
function secret(name: string): string {
  const unquote = (s: string) => s.trim().replace(/^["']+|["']+$/g, "").trim();
  let v = unquote(Deno.env.get(name) ?? "");
  if (v.toUpperCase().startsWith(name + "=")) v = unquote(v.slice(name.length + 1));
  return v;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

// ---------- VAPID (RFC 8292) ----------
type Vapid = { publicKey: string; signingKey: CryptoKey; subject: string };
let vapidCache: Vapid | null = null;

async function getVapid(): Promise<Vapid> {
  if (vapidCache) return vapidCache;
  const publicKey = secret("VAPID_PUBLIC_KEY");
  const privateKey = secret("VAPID_PRIVATE_KEY");
  let subject = secret("VAPID_SUBJECT") || "mailto:post@alvoeninnegolf.no";
  if (!publicKey || !privateKey) {
    throw new Error("Push-nøklene mangler. Legg inn VAPID_PUBLIC_KEY og VAPID_PRIVATE_KEY under Edge Functions → Secrets.");
  }
  if (!/^(mailto:|https:)/.test(subject)) subject = `mailto:${subject}`;
  let pub: Uint8Array, d: Uint8Array;
  try {
    pub = b64urlToBytes(publicKey);
    d = b64urlToBytes(privateKey);
  } catch {
    throw new Error("Push-nøklene har feil format. Kopier dem på nytt fra nøkkelfilen.");
  }
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID_PUBLIC_KEY er feil. Kopier den på nytt fra nøkkelfilen.");
  if (d.length !== 32) throw new Error("VAPID_PRIVATE_KEY er feil. Kopier den på nytt fra nøkkelfilen.");
  const jwk = {
    kty: "EC", crv: "P-256", ext: true,
    x: bytesToB64url(pub.slice(1, 33)), y: bytesToB64url(pub.slice(33, 65)), d: bytesToB64url(d),
  };
  let signingKey: CryptoKey;
  try {
    signingKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  } catch {
    throw new Error("Push-nøklene hører ikke sammen. Kopier begge på nytt fra samme nøkkelfil.");
  }
  vapidCache = { publicKey: bytesToB64url(pub), signingKey, subject };
  return vapidCache;
}

async function vapidHeader(endpoint: string, vapid: Vapid): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64url(enc.encode(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: vapid.subject,
  })));
  const unsigned = `${header}.${claims}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, vapid.signingKey, enc.encode(unsigned)));
  return `vapid t=${unsigned}.${bytesToB64url(sig)}, k=${vapid.publicKey}`;
}

// ---------- Kryptering av innholdet (RFC 8291, aes128gcm) ----------
export async function encryptPayload(payload: Uint8Array, p256dh: string, auth: string): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dh);
  const authSecret = b64urlToBytes(auth);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const asKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", asKeys.publicKey));
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asKeys.privateKey, 256));

  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const plaintext = concat(payload, new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));

  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string, vapid: Vapid) {
  const body = await encryptPayload(enc.encode(payload), sub.p256dh, sub.auth);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(sub.endpoint, vapid),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(60 * 60 * 24),
      Urgency: "normal",
    },
    body,
  });
}


// ---------- E-post via Gmail (SMTP over TLS, port 465) ----------
const EMAIL_RE = /[^\s,;<>()"']+@[^\s,;<>()"']+\.[a-z]{2,}/gi;

function b64utf8(text: string): string {
  const bytes = enc.encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
const wrap76 = (s: string) => s.replace(/(.{76})/g, "$1\r\n");
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`);

class Smtp {
  private conn!: Deno.TlsConn;
  private buf = "";
  private dec = new TextDecoder();
  async connect(host: string, port: number) {
    this.conn = await Deno.connectTls({ hostname: host, port });
    await this.expect(220);
  }
  private async readReply(): Promise<{ code: number; text: string }> {
    const chunk = new Uint8Array(4096);
    while (true) {
      const lines = this.buf.split("\r\n");
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i])) {
          const text = lines.slice(0, i + 1).join("\n");
          this.buf = lines.slice(i + 1).join("\r\n");
          return { code: Number(lines[i].slice(0, 3)), text };
        }
      }
      const n = await this.conn.read(chunk);
      if (n === null) throw new Error("E-postserveren lukket forbindelsen.");
      this.buf += this.dec.decode(chunk.subarray(0, n));
    }
  }
  async expect(code: number) {
    const r = await this.readReply();
    if (r.code !== code) throw new Error(`E-postserveren svarte: ${r.text.slice(0, 200)}`);
    return r;
  }
  async cmd(line: string, code: number) {
    await this.conn.write(enc.encode(line + "\r\n"));
    return this.expect(code);
  }
  async send(data: string) { await this.conn.write(enc.encode(data)); }
  close() { try { this.conn.close(); } catch { /* ignorer */ } }
}

async function sendGmail(opts: { subject: string; body: string; bcc: string[]; to: string }) {
  const user = secret("GMAIL_USER");
  const pass = secret("GMAIL_APP_PASSWORD").replace(/\s+/g, "");
  if (!user || !pass) throw new Error("E-post er ikke satt opp. Legg inn GMAIL_USER og GMAIL_APP_PASSWORD under Edge Functions → Secrets.");
  const host = Deno.env.get("SMTP_HOST") || "smtp.gmail.com";
  const port = Number(Deno.env.get("SMTP_PORT") || 465);
  const date = new Date().toUTCString().replace("GMT", "+0000");
  const msgId = `<${crypto.randomUUID()}@alvoeninnegolf>`;
  const headers = [
    `From: ${encodeHeader("Alvøen Innegolf")} <${user}>`,
    `To: ${opts.to}`,
    `Reply-To: ${user}`,
    `Subject: ${encodeHeader(opts.subject)}`,
    `Date: ${date}`,
    `Message-ID: ${msgId}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
  ].join("\r\n");
  const message = `${headers}\r\n\r\n${wrap76(b64utf8(opts.body))}\r\n`;

  // Gmail tar maks 100 mottakere per e-post: send i puljer.
  const all = [opts.to, ...opts.bcc.filter((a) => a.toLowerCase() !== opts.to.toLowerCase())];
  const batches: string[][] = [];
  for (let i = 0; i < all.length; i += 90) batches.push(all.slice(i, i + 90));

  const smtp = new Smtp();
  try {
    await smtp.connect(host, port);
    await smtp.cmd("EHLO alvoeninnegolf.no", 250);
    try {
      await smtp.cmd(`AUTH PLAIN ${b64utf8(`\0${user}\0${pass}`)}`, 235);
    } catch {
      throw new Error("Gmail godtok ikke innloggingen. Sjekk GMAIL_USER og at GMAIL_APP_PASSWORD er et app-passord (16 tegn).");
    }
    for (const rcpts of batches) {
      await smtp.cmd(`MAIL FROM:<${user}>`, 250);
      for (const r of rcpts) await smtp.cmd(`RCPT TO:<${r}>`, 250);
      await smtp.cmd("DATA", 354);
      await smtp.send(message + ".\r\n");
      await smtp.expect(250);
    }
    await smtp.cmd("QUIT", 221).catch(() => {});
  } finally {
    smtp.close();
  }
  return all.length - 1;
}


// ---------- Trackman (åpent leaderboard-API) ----------
// Vinterserien 2026/27 i Trackman. Kan overstyres med secret TRACKMAN_TOURNAMENT_ID ved ny sesong.
const TRACKMAN_TOURNAMENT = "T3JkZXJPZk1lcml0VG91cm5hbWVudApkMTE4ZjFjMmEtZTk5Ni00MDA2LTlhM2MtZjYxMDIzZmI1ZGViOlB1Ymxpc2hlZA==";

async function trackmanGql(query: string, variables: Record<string, unknown>) {
  const res = await fetch("https://api.trackmangolf.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Trackman svarte ${res.status}`);
  const data = await res.json();
  if (data.errors?.length) throw new Error(`Trackman: ${data.errors[0].message}`);
  return data.data;
}

async function trackmanScores(roundNo: number) {
  const t = secret("TRACKMAN_TOURNAMENT_ID") || TRACKMAN_TOURNAMENT;
  const info = await trackmanGql(
    `query($t: ID!) { node(id: $t) { ... on CourseTournament { name rounds { id roundNumber numberOfHoles } } } }`,
    { t },
  );
  const round = info?.node?.rounds?.find((r: any) => r.roundNumber === roundNo);
  if (!round) throw new Error(`Fant ikke runde ${roundNo} i Trackman-turneringen.`);
  const lb = await trackmanGql(
    `query($t: ID!, $r: ID!) { node(id: $t) { ... on CourseTournament { roundLeaderboard(roundId: $r, scoringFormat: STROKE) {
      records(skip: 0, take: 500) { items { playername hcp score { score state thru scorecardId } } } } } } }`,
    { t, r: round.id },
  );
  const items = lb?.node?.roundLeaderboard?.records?.items ?? [];
  const started = items.filter((i: any) => i.score && i.score.state !== "NOT_PLAYED");
  // Scorekortet gir tee og om runden er fullført. Hentes for alle som har startet.
  const cards = await Promise.all(started.map(async (i: any) => {
    if (!i.score.scorecardId) return null;
    try {
      const d = await trackmanGql(
        `query($id: ID!) { node(id: $id) { ... on Scorecard { grossScore teeName isCompleted numberOfHolesPlayed numberOfHolesToPlay } } }`,
        { id: i.score.scorecardId },
      );
      return d?.node ?? null;
    } catch { return null; }
  }));
  return {
    tournament: info.node.name,
    round: roundNo,
    holes: round.numberOfHoles ?? null,
    players: started.map((i: any, k: number) => {
      const c = cards[k];
      const holesPlayed = c?.numberOfHolesPlayed ?? i.score.thru ?? null;
      const toPlay = c?.numberOfHolesToPlay ?? round.numberOfHoles ?? null;
      const completed = c ? Boolean(c.isCompleted) && (toPlay === null || holesPlayed >= toPlay) : i.score.state === "PLAYED";
      return {
        name: String(i.playername ?? "").trim(),
        gross: c?.grossScore ?? i.score.score ?? null,
        tee: c?.teeName ?? null,
        completed,
        holesPlayed,
        toPlay,
        hcp: typeof i.hcp === "number" ? Math.round(i.hcp * 10) / 10 : null,
      };
    }),
  };
}


// ---------- Alba (Partner API, kun lesing) ----------
const ALBA_BASE = "https://api.albaplay.com/api/v1";
const ALBA_ENTITIES: Record<string, { path: string; table: string; map: (x: any) => Record<string, unknown> }> = {
  contacts: {
    path: "/contacts", table: "alba_contacts",
    map: (x) => ({
      id: String(x.id), first_name: x.first_name ?? null, last_name: x.last_name ?? null,
      email: x.email ?? null, phone: x.phone ?? null, language: x.language ?? null,
      email_on: typeof x.email_on === "boolean" ? x.email_on : null,
      created_at: x.created_at ?? null, modified_at: x.modified_at ?? null, deleted_at: x.deleted_at ?? null,
    }),
  },
  bookings: {
    path: "/bookings", table: "alba_bookings",
    map: (x) => ({
      id: String(x.id), contact_id: x.contact_id != null ? String(x.contact_id) : null, status: x.status ?? null,
      title: x.title ?? null, start_at: x.start_at ?? null, end_at: x.end_at ?? null,
      player_count: Number.isFinite(x.player_count) ? x.player_count : null, resources: x.resources ?? null,
      created_at: x.created_at ?? null, modified_at: x.modified_at ?? null, deleted_at: x.deleted_at ?? null,
    }),
  },
  orders: {
    path: "/orders", table: "alba_orders",
    map: (x) => ({
      id: String(x.id), contact_id: x.contact_id != null ? String(x.contact_id) : null, reference: x.reference ?? null,
      category: x.category ?? null, currency: x.currency ?? null,
      total_amount_minor: x.total_amount_minor ?? null, refunded_amount_minor: x.refunded_amount_minor ?? null,
      payment_status: x.payment_status ?? null, line_items: x.line_items ?? null,
      ordered_at: x.ordered_at ?? null, modified_at: x.modified_at ?? null, deleted_at: x.deleted_at ?? null,
    }),
  },
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function albaGet(path: string, params: Record<string, string>, key: string) {
  const url = new URL(ALBA_BASE + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" } });
    if (res.status === 429) { await sleep(Math.min(30, Number(res.headers.get("Retry-After") || 5)) * 1000); continue; }
    if (res.status >= 500) { await sleep(1000 * 2 ** attempt); continue; }
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new Error(`Alba avviste nøkkelen (${res.status}). Sjekk ALBA_API_KEY.`);
    if (!res.ok) throw new Error(`Alba svarte ${res.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text) as { data: any[]; next_cursor: string | null };
  }
  throw new Error("Alba svarer ikke nå. Prøv igjen om litt.");
}

// Henter i maks ~100 sekunder per kall. Er det mer igjen, returneres done=false og appen kaller igjen.
async function albaSync(supabase: ReturnType<typeof db>) {
  const key = secret("ALBA_API_KEY");
  if (!key) throw new Error("ALBA_API_KEY mangler under Edge Functions → Secrets.");
  const started = Date.now();
  const report: Record<string, number> = {};
  let done = true;
  for (const [entity, cfg] of Object.entries(ALBA_ENTITIES)) {
    const { data: st } = await supabase.from("alba_sync").select("*").eq("entity", entity).maybeSingle();
    let cursor: string | null = st?.cursor ?? null;
    // Ny gjennomgang: start fra siste endring minus 5 minutter (eller fra starten første gang).
    const since: string | null = cursor ? st?.walk_since ?? null
      : st?.last_modified ? new Date(new Date(st.last_modified).getTime() - 5 * 60_000).toISOString() : null;
    let maxSeen: string | null = cursor ? st?.walk_max ?? null : null;
    let count = 0;
    let finished = false;
    try {
      while (true) {
        if (Date.now() - started > 100_000) break;
        const page = await albaGet(cfg.path, { limit: "200", modified_since: since ?? "", cursor: cursor ?? "" }, key);
        const rows = (page.data ?? []).map(cfg.map);
        if (rows.length) {
          const { error } = await supabase.from(cfg.table).upsert(rows, { onConflict: "id" });
          if (error) throw new Error(`Kunne ikke lagre ${entity}: ${error.message}`);
          for (const r of rows) if (r.modified_at && (!maxSeen || String(r.modified_at) > maxSeen)) maxSeen = String(r.modified_at);
          count += rows.length;
        }
        cursor = page.next_cursor ?? null;
        if (!cursor) { finished = true; break; }
      }
      await supabase.from("alba_sync").upsert({
        entity,
        last_modified: finished ? (maxSeen ?? st?.last_modified ?? null) : st?.last_modified ?? null,
        cursor: finished ? null : cursor,
        walk_since: finished ? null : since,
        walk_max: finished ? null : maxSeen,
        last_run: new Date().toISOString(),
        last_error: null,
        rows_total: (st?.rows_total ?? 0) + count,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabase.from("alba_sync").upsert({ entity, last_run: new Date().toISOString(), last_error: message,
        last_modified: st?.last_modified ?? null, cursor: st?.cursor ?? null, walk_since: st?.walk_since ?? null,
        walk_max: st?.walk_max ?? null, rows_total: st?.rows_total ?? 0 });
      throw e;
    }
    report[entity] = count;
    if (!finished) { done = false; break; }
  }
  return { done, fetched: report };
}

// ---------- Database ----------
function db() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase-oppsettet mangler i funksjonen.");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function requireAdmin(req: Request, supabase: ReturnType<typeof db>): Promise<string | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return null;
  const { data: row } = await supabase.from("admins").select("email").ilike("email", email).maybeSingle();
  return row ? email : null;
}

// ---------- Forespørsler ----------
async function handle(req: Request): Promise<Response> {
  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Ugyldig forespørsel" }, 400);
  }

  const supabase = db();
  const action = payload.action;

  if (action === "subscribe") {
    const sub = payload.subscription;
    const endpoint = sub?.endpoint;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;
    if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || !p256dh || !auth) {
      return json({ error: "Mangler abonnementsdata" }, 400);
    }
    const topics = Array.isArray(payload.topics)
      ? payload.topics.filter((t: unknown) => CATEGORIES.includes(String(t)))
      : CATEGORIES;
    const { error } = await supabase.from("push_subscriptions").upsert({
      endpoint, p256dh, auth, topics, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Kunne ikke lagre abonnementet: ${error.message}`);
    return json({ ok: true });
  }

  if (action === "unsubscribe") {
    if (typeof payload.endpoint !== "string") return json({ error: "Mangler endpoint" }, 400);
    await supabase.from("push_subscriptions").delete().eq("endpoint", payload.endpoint);
    return json({ ok: true });
  }

  if (action === "contact") {
    // Honningkrukke: skjult felt som bare roboter fyller ut. Svar «ok» uten å lagre.
    if (payload.website) return json({ ok: true });
    const name = String(payload.name ?? "").trim().slice(0, 80);
    const contact = String(payload.contact ?? "").trim().slice(0, 120);
    const message = String(payload.message ?? "").trim().slice(0, 2000);
    const topic = CONTACT_TOPICS[String(payload.topic)] ? String(payload.topic) : "annet";
    const deviceId = typeof payload.deviceId === "string" ? payload.deviceId.slice(0, 64) : null;
    if (!name || !message) return json({ error: "Skriv navn og melding." }, 400);

    // Sperre: maks 5 meldinger per enhet per time og 30 totalt per 10 minutter.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    if (deviceId) {
      const { count } = await supabase.from("contact_messages").select("id", { count: "exact", head: true })
        .eq("device_id", deviceId).gte("created_at", hourAgo);
      if ((count ?? 0) >= 5) return json({ error: "Du har sendt mange meldinger nå. Prøv igjen senere." }, 429);
    }
    const tenMinAgo = new Date(Date.now() - 600_000).toISOString();
    const { count: recent } = await supabase.from("contact_messages").select("id", { count: "exact", head: true })
      .gte("created_at", tenMinAgo);
    if ((recent ?? 0) >= 30) return json({ error: "Mange meldinger akkurat nå. Prøv igjen om litt." }, 429);

    const { data: row, error } = await supabase.from("contact_messages")
      .insert({ name, contact, topic, message, device_id: deviceId }).select("id").single();
    if (error) throw new Error(`Kunne ikke lagre meldingen: ${error.message}`);

    // Varsel til admin-enheter. Feil her skal ikke stoppe kunden.
    try {
      const { data: subs } = await supabase.from("admin_push_subscriptions").select("endpoint, p256dh, auth");
      if (subs?.length) {
        const vapid = await getVapid();
        const note = JSON.stringify({
          title: `Ny melding fra ${name}`,
          body: `${CONTACT_TOPICS[topic]}: ${message.length > 120 ? message.slice(0, 117) + "…" : message}`,
          url: "/#/admin/innboks",
          tag: `kontakt-${row.id}`,
        });
        const gone: string[] = [];
        await Promise.all(subs.map(async (s) => {
          try {
            const res = await sendPush(s, note, vapid);
            if (res.status === 404 || res.status === 410) gone.push(s.endpoint);
          } catch (e) { console.error("Admin-varsel feilet:", e); }
        }));
        if (gone.length) await supabase.from("admin_push_subscriptions").delete().in("endpoint", gone);
      }
    } catch (e) {
      console.error("Admin-varsel feilet:", e);
    }
    return json({ ok: true });
  }

  if (action === "admin-alerts" || action === "admin-alerts-status") {
    const email = await requireAdmin(req, supabase);
    if (!email) return json({ error: "Ikke innlogget som administrator" }, 401);
    const sub = payload.subscription;
    const endpoint = sub?.endpoint ?? payload.endpoint;
    if (action === "admin-alerts-status") {
      const { count } = await supabase.from("admin_push_subscriptions").select("endpoint", { count: "exact", head: true });
      let here = false;
      if (typeof endpoint === "string") {
        const { data } = await supabase.from("admin_push_subscriptions").select("endpoint").eq("endpoint", endpoint).maybeSingle();
        here = Boolean(data);
      }
      return json({ ok: true, here, total: count ?? 0 });
    }
    if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) return json({ error: "Mangler abonnementsdata" }, 400);
    if (payload.on) {
      if (!sub?.keys?.p256dh || !sub?.keys?.auth) return json({ error: "Mangler abonnementsdata" }, 400);
      const { error } = await supabase.from("admin_push_subscriptions").upsert({
        endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, email,
      });
      if (error) throw new Error(`Kunne ikke lagre: ${error.message}`);
    } else {
      await supabase.from("admin_push_subscriptions").delete().eq("endpoint", endpoint);
    }
    return json({ ok: true });
  }

  if (action === "email-status") {
    if (!(await requireAdmin(req, supabase))) return json({ error: "Ikke innlogget som administrator" }, 401);
    return json({ ok: true, configured: Boolean(secret("GMAIL_USER") && secret("GMAIL_APP_PASSWORD")), from: secret("GMAIL_USER") || null });
  }

  if (action === "email-players") {
    const adminEmail = await requireAdmin(req, supabase);
    if (!adminEmail) return json({ error: "Ikke innlogget som administrator" }, 401);
    const subject = String(payload.subject ?? "").trim().slice(0, 150);
    const body = String(payload.body ?? "").trim().slice(0, 10000);
    if (!subject || !body) return json({ error: "Skriv emne og tekst." }, 400);
    const from = secret("GMAIL_USER");
    if (payload.test) {
      await sendGmail({ subject: `[TEST] ${subject}`, body, bcc: [], to: adminEmail });
      return json({ ok: true, sent: 0, test: adminEmail });
    }
    const { data: players, error } = await supabase.from("players").select("contact");
    if (error) throw new Error(`Kunne ikke hente spillere: ${error.message}`);
    const emails = [...new Set((players ?? []).map((p) => (String(p.contact ?? "").match(EMAIL_RE)?.[0] ?? "").toLowerCase()).filter(Boolean))];
    if (!emails.length) return json({ error: "Ingen spillere har e-post registrert." }, 400);
    const sent = await sendGmail({ subject, body, bcc: emails, to: from });
    return json({ ok: true, sent });
  }

  if (action === "alba-sync") {
    if (!(await requireAdmin(req, supabase))) return json({ error: "Ikke innlogget som administrator" }, 401);
    try {
      return json({ ok: true, ...(await albaSync(supabase)) });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 502);
    }
  }

  if (action === "trackman-scores") {
    if (!(await requireAdmin(req, supabase))) return json({ error: "Ikke innlogget som administrator" }, 401);
    const roundNo = Number(payload.roundNo);
    if (!Number.isInteger(roundNo) || roundNo < 1 || roundNo > 20) return json({ error: "Ugyldig runde" }, 400);
    try {
      return json({ ok: true, ...(await trackmanScores(roundNo)) });
    } catch (e) {
      return json({ error: `Kunne ikke hente fra Trackman: ${e instanceof Error ? e.message : e}` }, 502);
    }
  }

  if (action === "stats") {
    if (!(await requireAdmin(req, supabase))) return json({ error: "Ikke innlogget som administrator" }, 401);
    const { count } = await supabase.from("push_subscriptions").select("*", { count: "exact", head: true });
    return json({ ok: true, subscribers: count ?? 0 });
  }

  if (action === "send") {
    if (!(await requireAdmin(req, supabase))) return json({ error: "Ikke innlogget som administrator" }, 401);

    const category = String(payload.category ?? "");
    const title = String(payload.title ?? "").trim().slice(0, 120);
    const body = String(payload.body ?? "").trim().slice(0, 2000);
    if (!CATEGORIES.includes(category) || !title) {
      return json({ error: "Velg kategori og skriv en tittel" }, 400);
    }

    const vapid = await getVapid(); // stopper før meldingen lagres hvis nøklene er feil

    const { data: msg, error: insertError } = await supabase
      .from("messages").insert({ category, title, body }).select().single();
    if (insertError) throw new Error(`Kunne ikke lagre meldingen: ${insertError.message}`);

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions").select("endpoint, p256dh, auth").contains("topics", [category]);
    if (subsError) throw new Error(`Kunne ikke hente mottakere: ${subsError.message}`);

    const notification = JSON.stringify({
      title,
      body: body.length > 140 ? body.slice(0, 137) + "…" : body,
      url: "/#/meldinger",
      tag: `melding-${msg.id}`,
    });

    let sent = 0;
    const gone: string[] = [];
    const failures: string[] = [];
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        const res = await sendPush(s, notification, vapid);
        if (res.ok) sent++;
        else if (res.status === 404 || res.status === 410) gone.push(s.endpoint);
        else failures.push(`${res.status} ${(await res.text()).slice(0, 120)}`);
      } catch (e) {
        failures.push(e instanceof Error ? e.message : String(e));
      }
    }));
    if (gone.length) await supabase.from("push_subscriptions").delete().in("endpoint", gone);
    if (failures.length) console.error("Push-feil:", failures);

    return json({ ok: true, sent, total: subs?.length ?? 0, failed: failures.length, firstFailure: failures[0] ?? null });
  }

  return json({ error: "Ukjent handling" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Kun POST" }, 405);
  try {
    return await handle(req);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(message);
    return json({ error: message }, 500);
  }
});
