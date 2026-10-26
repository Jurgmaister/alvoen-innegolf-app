import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from './config.js';

export const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      // 'implicit': innloggingslenken virker uansett hvilken nettleser e-posten åpnes i
      // (Gmail-appen, Safari eller appen på hjemskjermen).
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
    })
  : null;

// Kaller push-funksjonen. Admin-handlinger sender med innloggingen.
export async function callPush(action, body = {}) {
  let token = SUPABASE_ANON_KEY;
  if (['send', 'stats', 'admin-alerts', 'admin-alerts-status', 'email-players', 'email-status'].includes(action)) {
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
    if (!token) throw new Error('Du må logge inn på nytt.');
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Feil fra server (${res.status})`);
  return data;
}
