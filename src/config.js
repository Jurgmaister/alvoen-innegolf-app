export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
// Påmelding til vinterserien skjer ved å legge seg til turneringen i Trackman.
export const TOURNAMENT_SIGNUP_URL = 'https://tm-short.me/L4BPwzL';
export const BOOKING_URL = import.meta.env.VITE_BOOKING_URL || 'https://albaplay.com/venue/alvoen-innegolf';

export const CATEGORIES = [
  { id: 'turnering', label: 'Turnering' },
  { id: 'drift', label: 'Drift' },
];

export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label || id;

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Infosidene («Slik bruker du simulatoren», «Adgang, kiosk og regler»). Sett til true for å vise dem igjen.
export const SHOW_INFO_PAGES = false;
