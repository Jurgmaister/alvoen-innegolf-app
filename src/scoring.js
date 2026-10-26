// Beregninger for vinterserien – samme regler som regnearket «Vinterserie_2026-27_resultater_v4».
//
// HCP-indeks brukt = 50 % av Golfbox-indeks (én desimal). Uten Golfbox: 50 % av egen indeks, maks 36.
// Playing handicap: 18 hull = indeks × Slope/113 + (CR − Par); 9 hull = (indeks/2) × Slope/113 + (CR − Par), avrundet.
// Netto = brutto − playing handicap. Plass etter netto; lik netto = delt plass med delte poeng.
// Poeng: plass 1–4 får 100/85/75/65 % av vinnerpoeng (100 på 18 hull, 90 på 9 hull),
// deretter lineært ned til 10 poeng for siste plass.
// Order of Merit: 7 beste runder teller. Likt: flest seire, så beste runde, så påmeldingsrekkefølge.

export const SETTINGS = {
  shares: [1, 0.85, 0.75, 0.65], // plass 1–4
  lastPlacePoints: 10,
  winnerPoints18: 100,
  winnerPoints9: 90,
  countingRounds: 7,
  playoffSpots: 4,
  hcpShare: 0.5,
};

// Excel ROUND: halvparten rundes bort fra null.
export function xround(x, digits = 0) {
  const f = 10 ** digits;
  const v = Math.abs(x) * f;
  const r = Math.round(v + 1e-9);
  return (Math.sign(x) * r) / f;
}

export function hcpIndexUsed({ golfboxHcp, indexNoGolfbox }) {
  if (golfboxHcp !== null && golfboxHcp !== undefined && golfboxHcp !== '') {
    return xround(Number(golfboxHcp) * SETTINGS.hcpShare, 1);
  }
  if (indexNoGolfbox !== null && indexNoGolfbox !== undefined && indexNoGolfbox !== '') {
    return xround(Math.min(Number(indexNoGolfbox), 36) * SETTINGS.hcpShare, 1);
  }
  return null;
}

// rating: { par, cr, slope } for spillerens kjønn. nineHoles: true for 9-hullsrunder.
export function playingHandicap(index, rating, nineHoles) {
  if (index === null || index === undefined || !rating) return null;
  const { par, cr, slope } = rating;
  if ([par, cr, slope].some((v) => v === null || v === undefined || v === '')) return null;
  const idx = nineHoles ? Number(index) / 2 : Number(index);
  return xround(idx * Number(slope) / 113 + (Number(cr) - Number(par)), 0);
}

function rawPoints(place, n, winner) {
  const s = SETTINGS;
  if (place <= 4) return winner * s.shares[place - 1];
  const p4 = winner * s.shares[3];
  return p4 - (place - 4) * (p4 - s.lastPlacePoints) / (n - 4);
}

// Poeng for plass med eventuell deling (tieCount = antall på samme netto), som i regnearket.
export function pointsFor(place, tieCount, n, winner) {
  const s = SETTINGS;
  if (place >= 4) {
    if (n <= 4) return xround(winner * s.shares[3], 0);
    const p4 = winner * s.shares[3];
    return xround(p4 - ((place + (tieCount - 1) / 2) - 4) * (p4 - s.lastPlacePoints) / (n - 4), 0);
  }
  const k = Math.min(tieCount, 4);
  let sum = 0;
  for (let i = 0; i < k; i++) sum += rawPoints(place + i, n, winner);
  return xround(sum / k, 0);
}

export function ratingFor(ratings, gender) {
  if (!ratings) return null;
  return gender === 'D'
    ? { par: ratings.par_w, cr: ratings.cr_w, slope: ratings.slope_w }
    : { par: ratings.par_m, cr: ratings.cr_m, slope: ratings.slope_m };
}

// Regner ut én runde.
// players: [{ id, name, gender, hcp_index }], scores: [{ player_id, gross, struck }]
// Returnerer rader med ph, net, valid, check, place, points – sortert etter plass.
// tees (valgfritt): { [tee_id]: tee } – brukes når scoren har tee_id (spilleren valgte annen tee).
export function computeRound({ scores, players, ratings, nineHoles, tees = {} }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const rows = scores.map((s) => {
    const p = byId.get(s.player_id);
    const tee = s.tee_id ? tees[s.tee_id] : null;
    const rating = p ? ratingFor(tee || ratings, p.gender) : null;
    const ph = p ? playingHandicap(p.hcp_index, rating, nineHoles) : null;
    const gross = s.gross === null || s.gross === undefined || s.gross === '' ? null : Number(s.gross);
    const net = gross !== null && ph !== null ? gross - ph : null;
    let check = 'OK';
    if (!p) check = 'Ukjent spiller';
    else if (p.hcp_index === null || p.hcp_index === undefined) check = 'Mangler HCP';
    else if (ph === null) check = 'Mangler CR/slope';
    else if (gross === null) check = 'Mangler brutto';
    const valid = check === 'OK' && net !== null && !s.struck;
    const par = rating && rating.par !== null && rating.par !== undefined && rating.par !== '' ? Number(rating.par) : null;
    const toPar = net !== null && par !== null ? net - par : null; // netto i forhold til banepar (for valgt tee og kjønn)
    return { ...s, player: p, tee: tee || null, name: p?.name ?? '?', hcp_index: p?.hcp_index ?? null, ph, gross, net, par, toPar, check, valid, place: null, points: null, ties: 0 };
  });
  const valid = rows.filter((r) => r.valid);
  const n = valid.length;
  const winner = nineHoles ? SETTINGS.winnerPoints9 : SETTINGS.winnerPoints18;
  for (const r of valid) {
    r.place = 1 + valid.filter((o) => o.net < r.net).length;
    r.ties = valid.filter((o) => o.net === r.net).length;
    r.points = pointsFor(r.place, r.ties, n, winner);
  }
  rows.sort((a, b) => (a.valid === b.valid ? (a.place ?? 999) - (b.place ?? 999) || a.name.localeCompare(b.name, 'nb') : a.valid ? -1 : 1));
  return { rows, validCount: n, winnerPoints: winner };
}

// Order of Merit over alle runder.
// rounds: [{ n, nineHoles, ratings, scores }]
export function computeOrderOfMerit({ players, rounds }) {
  const results = {}; // round n -> computeRound-resultat
  for (const r of rounds) {
    results[r.n] = computeRound({ scores: r.scores, players, ratings: r.ratings, nineHoles: r.nineHoles, tees: r.teesById || {} });
  }
  const order = [...players].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id - b.id);
  const table = order.map((p, idx) => {
    const perRound = {};
    let wins = 0;
    for (const r of rounds) {
      const row = results[r.n].rows.find((x) => x.player_id === p.id && x.valid);
      if (row) { perRound[r.n] = row.points; if (row.place === 1) wins++; }
    }
    const pts = Object.values(perRound);
    const sorted = [...pts].sort((a, b) => a - b);
    const drop = Math.max(0, pts.length - SETTINGS.countingRounds);
    const struckPoints = sorted.slice(0, drop).reduce((a, b) => a + b, 0);
    const total = pts.reduce((a, b) => a + b, 0);
    // Hvilke runder er strøket (de laveste utover 7)? Ved like poeng strykes den tidligste runden.
    const droppedRounds = Object.entries(perRound)
      .sort((a, b) => a[1] - b[1] || Number(a[0]) - Number(b[0]))
      .slice(0, drop).map(([k]) => Number(k));
    return {
      player: p, id: p.id, name: p.name, order: idx,
      perRound, droppedRounds, played: pts.length, total, counting: total - struckPoints,
      wins, best: pts.length ? Math.max(...pts) : 0,
      beforeChristmas: [1, 2, 3, 4, 5].reduce((a, n) => a + (perRound[n] || 0), 0),
    };
  });
  table.sort((a, b) => b.counting - a.counting || b.wins - a.wins || b.best - a.best || a.order - b.order);
  table.forEach((t, i) => { t.place = i + 1; t.qualified = t.place <= SETTINGS.playoffSpots && t.played > 0; });
  return { table, results };
}
