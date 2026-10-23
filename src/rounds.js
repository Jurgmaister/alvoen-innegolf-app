// Runder i Alvøen Innegolf Vinterserie 2026/27 (fra Trackman-turneringen).
// Endre her hvis Trackman-oppsettet endres. Datoer er første og siste spilledag.
// Baneinfo: fakta fra Trackmans banebibliotek; omtalene er egne, korte sammendrag.
// difficulty = Trackmans vanskelighetsgrad (1–5). Tee-lengder gjelder hele banen (18 hull).
export const ROUNDS = [
  {
    n: 1, course: 'Te Arai Links – South Course', start: '2026-10-19', end: '2026-11-01',
    place: 'Tomarata, New Zealand', par: 72, difficulty: 3, holes: 'Hull 10–18 (bakre ni)',
    men: 'Back – 5870 m', women: 'Forward Combo – 5048 m',
    about: 'Linksbane ved Stillehavet nord for Auckland, tegnet av Bill Coore og Ben Crenshaw. Sandrygger, daler og ujevne linksformasjoner gir hull med mye særpreg, blant annet flere korte par 4-hull. Seksten hull har havutsikt, og åtte går rett langs Stillehavet.',
  },
  {
    n: 2, course: 'Bernardus Golf', start: '2026-11-02', end: '2026-11-15',
    place: 'Cromvoirt, Nederland', par: 72, difficulty: 3, holes: '18 hull',
    men: '60 – 5996 m', women: '52 – 5158 m',
    about: 'Kyle Phillips-bane i lyngheia ved Den Bosch, som slynger seg gjennom sanddyner, furu og lyng. Gjennomtenkte bunkere og vannhindre belønner strategi og presisjon mer enn ren lengde. Vertskap for Dutch Open 2021–2023 og Solheim Cup 2026.',
  },
  {
    n: 3, course: 'WGC London', start: '2026-11-16', end: '2026-11-29',
    place: 'London, England', par: 69, difficulty: 3, holes: 'Hull 1–9 (fremre ni)',
    men: 'Yellow – 5321 m', women: 'Red – 5149 m',
    about: 'Parkbane i Øst-London med gamle trær og grønne omgivelser. Utfordrende nok til å by på motstand, men passer spillere på alle nivåer.',
  },
  {
    n: 4, course: 'Karlstads Golfklubb', start: '2026-11-30', end: '2026-12-13',
    place: 'Karlstad, Sverige', par: 72, difficulty: 4, holes: '18 hull',
    men: 'Gul – 5956 m', women: 'Rød – 5069 m',
    about: 'Svensk klubb fra 1957 med 27 hull. Banen som spilles er 18 hull par 72 som blander park- og skogsterreng, med varierte og utfordrende hull i fine omgivelser.',
  },
  {
    n: 5, course: 'Riverside Country Club', start: '2026-12-14', end: '2026-12-20',
    place: 'Saskatchewan, Canada', par: 72, difficulty: 3, holes: 'Hull 1–9 (fremre ni)',
    men: 'Gold/Blue – 5896 m', women: 'White – 5112 m',
    about: 'Parkbane over dalen til elven South Saskatchewan, regnet som en av Canadas mest naturskjønne og krevende baner. Terrenget og utsikten mot elvedalen preger hullene.',
  },
  {
    n: 6, course: 'The Hideaway – Pete Dye Course', start: '2027-01-04', end: '2027-01-17',
    place: 'California, USA', par: 72, difficulty: 4, holes: '18 hull',
    men: 'II – 6095 m', women: 'V – 4694 m',
    about: 'Linksinspirert ørkenbane av Pete Dye, ferdig i 2001. Bølgende fairwayer kantes av høyt gress, brede sandområder, bekker og dammer. Sand og vann ligger foran eller rundt mange av greenene og tee-stedene.',
  },
  {
    n: 7, course: 'Adare Manor', start: '2027-01-18', end: '2027-01-31',
    place: 'Limerick, Irland', par: 72, difficulty: 3, holes: 'Hull 10–18 (bakre ni)',
    men: 'White – 5948 m', women: 'Red – 4682 m',
    about: 'Parkbane på et gammelt gods ved elven Maigue, og vertskap for Ryder Cup 2027. Store, gamle trær og vakkert landskap. Banen krever presisjon, men belønner den som tør.',
  },
  {
    n: 8, course: 'Makena Golf & Beach Club', start: '2027-02-01', end: '2027-02-14',
    place: 'Maui, Hawaii', par: 72, difficulty: 3, holes: '18 hull',
    men: 'Mauka II – 5644 m', women: 'Mauka IV – 4706 m',
    about: 'Resortbane på sørvestsiden av Maui, fra strendene og opp mot skråningene av vulkanen Haleakala. Romslige fairwayer går mellom palmelunder og svarte lavasteiner.',
  },
  {
    n: 9, course: 'PGA National', start: '2027-02-15', end: '2027-02-28',
    place: 'Florida, USA', par: 70, difficulty: 5, holes: 'Hull 10–18 (bakre ni)',
    men: 'Blue – 5827 m', women: 'Red – 4705 m',
    about: 'Hjemmet til PGA of America i Palm Beach Gardens, og PGA Tour-bane gjennom mange år. Seriens vanskeligste bane. De bakre ni inneholder den beryktede «Bear Trap», en strekning på tre hull med mye vann.',
  },
  {
    n: 10, course: 'Brocket Hall Palmerston', start: '2027-03-08', end: '2027-03-21',
    place: 'Hertfordshire, England', par: 73, difficulty: 3, holes: '18 hull',
    men: 'White – 6227 m', women: 'Red – 5360 m',
    about: 'Mesterskapsbane nord for London av Donald Steel og Martin Ebert. Banen går inn og ut mellom høye furutrær, med store høydeforskjeller som rammer inn hullene fra tee. Greenområdene er faste og raske.',
  },
];

// Oppsett som er likt for alle runder i Trackman.
export const ROUND_SETTINGS = [
  ['Spilleform', 'Slag netto, ett forsøk per slag'],
  ['Vind', 'Lett bris'],
  ['Fairway og green', 'Middels harde'],
  ['Greenhastighet', 'Stimp 10'],
];

export const FINAL = { title: 'Sluttspill matchplay (topp 4)', date: '2027-04-04' };

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
