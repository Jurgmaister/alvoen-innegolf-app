// Henter spillere, baneverdier og score og regner ut resultater (felles for admin og turneringsfanen).
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import { ROUNDS } from './rounds.js';
import { computeOrderOfMerit } from './scoring.js';

export const isNine = (r) => !/^18/.test(r.holes);

export function useResults({ admin = false } = {}) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  const load = useCallback(async () => {
    const playersQ = admin
      ? supabase.from('players').select('*').order('created_at')
      : supabase.from('players_public').select('*').order('created_at');
    const [p, rr, sc, tt] = await Promise.all([
      playersQ,
      supabase.from('round_ratings').select('*'),
      supabase.from('scores').select('*'),
      supabase.from('round_tees').select('*').order('round_no').order('sort').order('id'),
    ]);
    const allTees = tt.error ? [] : (tt.data || []); // tee.sql ikke kjørt ennå: bare standardverdier
    const err = p.error || rr.error || sc.error;
    if (err) { setState({ loading: false, error: err.message, data: null }); return; }
    const ratingsByRound = Object.fromEntries((rr.data || []).map((r) => [r.round_no, r]));
    const players = (p.data || []).map((x) => ({ ...x, hcp_index: x.hcp_index === null ? null : Number(x.hcp_index) }));
    const rounds = ROUNDS.map((r) => ({
      n: r.n, nineHoles: isNine(r), ratings: ratingsByRound[r.n] || null,
      scores: (sc.data || []).filter((s) => s.round_no === r.n),
      tees: allTees.filter((t) => t.round_no === r.n),
      teesById: Object.fromEntries(allTees.filter((t) => t.round_no === r.n).map((t) => [t.id, t])),
    }));
    const oom = computeOrderOfMerit({ players, rounds });
    setState({ loading: false, error: null, data: { players, ratingsByRound, scores: sc.data || [], rounds, tees: allTees, teesReady: !tt.error, ...oom } });
  }, [admin]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// Plusshandicap (negativ indeks) vises med + som i Golfbox.
export const fmtIndex = (v) => {
  if (v === null || v === undefined || v === '') return '–';
  const n = Number(v);
  const t = Math.abs(n).toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return n < 0 ? `+${t}` : t;
};
export const fmtSigned = (v) => (v === null || v === undefined ? '–' : v > 0 ? `+${v}` : String(v));

// Score i forhold til par som på et leaderboard: E, +3, −2.
export const fmtToPar = (v) => (v === null || v === undefined ? '–' : v === 0 ? 'E' : v > 0 ? `+${v}` : `−${Math.abs(v)}`);
