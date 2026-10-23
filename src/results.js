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
    const [p, rr, sc] = await Promise.all([
      playersQ,
      supabase.from('round_ratings').select('*'),
      supabase.from('scores').select('*'),
    ]);
    const err = p.error || rr.error || sc.error;
    if (err) { setState({ loading: false, error: err.message, data: null }); return; }
    const ratingsByRound = Object.fromEntries((rr.data || []).map((r) => [r.round_no, r]));
    const players = (p.data || []).map((x) => ({ ...x, hcp_index: x.hcp_index === null ? null : Number(x.hcp_index) }));
    const rounds = ROUNDS.map((r) => ({
      n: r.n, nineHoles: isNine(r), ratings: ratingsByRound[r.n] || null,
      scores: (sc.data || []).filter((s) => s.round_no === r.n),
    }));
    const oom = computeOrderOfMerit({ players, rounds });
    setState({ loading: false, error: null, data: { players, ratingsByRound, scores: sc.data || [], rounds, ...oom } });
  }, [admin]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export const fmtIndex = (v) => (v === null || v === undefined ? '–' : Number(v).toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
export const fmtSigned = (v) => (v === null || v === undefined ? '–' : v > 0 ? `+${v}` : String(v));
