import { VAPID_PUBLIC_KEY, CATEGORIES } from './config.js';
import { callPush } from './supabase.js';

const TOPICS_KEY = 'alvoen.topics';

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

// iPhone kan bare få push når appen er lagt til på Hjem-skjermen.
export const needsInstallForPush = () => isIos() && !isStandalone();

export function savedTopics() {
  try {
    const t = JSON.parse(localStorage.getItem(TOPICS_KEY));
    if (Array.isArray(t)) return t;
  } catch { /* ingen lagrede valg */ }
  return CATEGORIES.map((c) => c.id);
}

function storeTopics(topics) {
  try { localStorage.setItem(TOPICS_KEY, JSON.stringify(topics)); } catch { /* ignorer */ }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(topics = savedTopics()) {
  if (!pushSupported()) throw new Error('Denne nettleseren støtter ikke push-varsler.');
  if (!VAPID_PUBLIC_KEY) throw new Error('Push er ikke satt opp ennå.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Varsler er ikke tillatt. Slå det på i innstillingene til telefonen.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await callPush('subscribe', { subscription: sub.toJSON(), topics });
  storeTopics(topics);
  return sub;
}

export async function updateTopics(topics) {
  storeTopics(topics);
  const sub = await currentSubscription();
  if (sub) await callPush('subscribe', { subscription: sub.toJSON(), topics });
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  await callPush('unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
