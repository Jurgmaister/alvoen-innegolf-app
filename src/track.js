// Anonym telling av enheter som bruker appen (ingen personopplysninger).
import { supabase } from './supabase.js';
import { isStandalone } from './push.js';

const ID_KEY = 'alvoen.deviceId';
const LAST_KEY = 'alvoen.lastTracked';
const INTERVAL = 30 * 60 * 1000;

function deviceId() {
  try {
    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }
    return id;
  } catch {
    return null; // privat modus e.l.: telles ikke
  }
}

function platform() {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  if (/windows|macintosh|linux/i.test(ua)) return 'pc';
  return 'annet';
}

async function track() {
  if (!supabase) return;
  const id = deviceId();
  if (!id) return;
  const installed = isStandalone();
  try {
    const last = Number(localStorage.getItem(LAST_KEY)) || 0;
    // Ny registrering når det har gått 30 min, eller første gang appen åpnes fra hjemskjermen.
    const key = `${LAST_KEY}.installed`;
    const firstInstalled = installed && !localStorage.getItem(key);
    if (Date.now() - last < INTERVAL && !firstInstalled) return;
    localStorage.setItem(LAST_KEY, String(Date.now()));
    if (installed) localStorage.setItem(key, '1');
  } catch { /* ignorer */ }
  try {
    await supabase.rpc('track_device', { device_id: id, is_installed: installed, device_platform: platform() });
  } catch { /* telling er ikke viktig nok til å vise feil */ }
}

export function startTracking() {
  if (!import.meta.env.PROD) return;
  track();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') track();
  });
}
