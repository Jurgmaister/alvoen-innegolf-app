import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Enkel datakrok: henter fra Supabase og gir tilbake { data, loading, error, reload }.
export function useQuery(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data, error } = await fn(supabase);
      if (error) throw error;
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState({ data: null, loading: false, error: e.message || 'Noe gikk galt' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}

export const fetchMessages = (limit) => (sb) => {
  let q = sb.from('messages').select('*').order('created_at', { ascending: false });
  if (limit) q = q.limit(limit);
  return q;
};
export const fetchTournament = (sb) => sb.from('tournament').select('*').eq('id', 1).single();
export const fetchStandings = (sb) => sb.from('standings').select('*').order('position');
export const fetchInfoPages = (sb) => sb.from('info_pages').select('*').order('sort');

const SEEN_KEY = 'alvoen.lastSeenMessage';
export const lastSeenMessageId = () => {
  try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; }
};
export const markMessagesSeen = (id) => {
  try { localStorage.setItem(SEEN_KEY, String(id)); } catch { /* ignorer */ }
};

export function formatWhen(iso) {
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (days === 0) return 'I dag';
  if (days === 1) return 'I går';
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}
