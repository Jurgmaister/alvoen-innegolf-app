// Alvøen Innegolf – push-funksjon (Supabase Edge Function, navn: "push")
// Handlinger:
//   subscribe   – lagrer/oppdaterer et push-abonnement med valgte kategorier (åpen)
//   unsubscribe – fjerner et abonnement (åpen)
//   send        – lagrer meldingen og sender push til alle som abonnerer på kategorien (kun admin)
//
// Hemmeligheter som må være satt (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (f.eks. mailto:post@alvoeninnegolf.no)
// SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY settes automatisk av Supabase.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const CATEGORIES = ["turnering", "drift", "tilbud"];

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

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:post@alvoeninnegolf.no",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

async function requireAdmin(req: Request): Promise<string | null> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) return null;
  const { data: row } = await supabase.from("admins").select("email").ilike("email", email).maybeSingle();
  return row ? email : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Kun POST" }, 405);

  let payload: Record<string, any>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Ugyldig forespørsel" }, 400);
  }

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
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  if (action === "unsubscribe") {
    if (typeof payload.endpoint !== "string") return json({ error: "Mangler endpoint" }, 400);
    await supabase.from("push_subscriptions").delete().eq("endpoint", payload.endpoint);
    return json({ ok: true });
  }

  if (action === "send") {
    const admin = await requireAdmin(req);
    if (!admin) return json({ error: "Ikke innlogget som administrator" }, 401);

    const category = String(payload.category ?? "");
    const title = String(payload.title ?? "").trim().slice(0, 120);
    const body = String(payload.body ?? "").trim().slice(0, 2000);
    if (!CATEGORIES.includes(category) || !title) {
      return json({ error: "Velg kategori og skriv en tittel" }, 400);
    }

    const { data: msg, error: insertError } = await supabase
      .from("messages").insert({ category, title, body }).select().single();
    if (insertError) return json({ error: insertError.message }, 500);

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions").select("endpoint, p256dh, auth").contains("topics", [category]);
    if (subsError) return json({ error: subsError.message }, 500);

    const notification = JSON.stringify({
      title,
      body: body.length > 140 ? body.slice(0, 137) + "…" : body,
      url: "/#/meldinger",
      tag: `melding-${msg.id}`,
    });

    let sent = 0;
    const gone: string[] = [];
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notification,
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.endpoint);
      }
    }));
    if (gone.length) await supabase.from("push_subscriptions").delete().in("endpoint", gone);

    return json({ ok: true, sent, total: subs?.length ?? 0 });
  }

  if (action === "stats") {
    const admin = await requireAdmin(req);
    if (!admin) return json({ error: "Ikke innlogget som administrator" }, 401);
    const { count } = await supabase.from("push_subscriptions").select("*", { count: "exact", head: true });
    return json({ ok: true, subscribers: count ?? 0 });
  }

  return json({ error: "Ukjent handling" }, 400);
});
