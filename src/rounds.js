// Runder i Alvøen Innegolf Vinterserie 2026/27 (fra Trackman-turneringen).
// Endre her hvis Trackman-oppsettet endres. Datoer er første og siste spilledag.
export const ROUNDS = [
  { n: 1, course: 'Te Arai Links – South Course', start: '2026-10-19', end: '2026-11-01' },
  { n: 2, course: 'Bernardus Golf', start: '2026-11-02', end: '2026-11-15' },
  { n: 3, course: 'WGC London', start: '2026-11-16', end: '2026-11-29' },
  { n: 4, course: 'Karlstads Golfklubb', start: '2026-11-30', end: '2026-12-13' },
  { n: 5, course: 'Riverside Country Club', start: '2026-12-14', end: '2026-12-20' },
  { n: 6, course: 'The Hideaway – Pete Dye Course', start: '2027-01-04', end: '2027-01-17' },
  { n: 7, course: 'Adare Manor', start: '2027-01-18', end: '2027-01-31' },
  { n: 8, course: 'Makena Golf & Beach Club', start: '2027-02-01', end: '2027-02-14' },
  { n: 9, course: 'PGA National', start: '2027-02-15', end: '2027-02-28' },
  { n: 10, course: 'Brocket Hall Palmerston', start: '2027-03-08', end: '2027-03-21' },
];

export const FINAL = { title: 'Sluttspill matchplay (topp 4)', date: '2027-04-11' };

const day = (iso) => new Date(`${iso}T00:00:00`);
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

export function roundStatus(r, now = todayStart()) {
  if (now > day(r.end)) return 'ferdig';
  if (now >= day(r.start)) return 'pagar';
  return 'kommer';
}

// Runden som pågår nå, ellers den neste som kommer. null når serien er ferdig.
export function currentRound(now = todayStart()) {
  return ROUNDS.find((r) => roundStatus(r, now) !== 'ferdig') || null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const fmt = (iso, withYear) => {
  const d = day(iso);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
};

export function formatRange(r) {
  const s = day(r.start); const e = day(r.end);
  return `${fmt(r.start)} – ${fmt(r.end, s.getFullYear() !== e.getFullYear())}`;
}

export const formatDate = (iso) => day(iso).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' });
