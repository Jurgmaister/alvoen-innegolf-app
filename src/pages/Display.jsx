import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../supabase.js';
import { BOOKING_URL, TOURNAMENT_SIGNUP_URL, categoryLabel } from '../config.js';
import { ROUNDS, FINAL, roundStatus, currentRound, formatRange, formatDate } from '../rounds.js';
import { useResults, fmtToPar, fmtSigned } from '../results.js';
import { SETTINGS } from '../scoring.js';

// Skjermvisning for TV i lokalet: app.alvoeninnegolf.no/#/skjerm
// Valg i adressen: ?sek=20 (sekunder per visning), ?vis=leaderboard,runde,neste,terminliste,velkommen,meldinger
const APP_URL = 'https://app.alvoeninnegolf.no';
const ALL = ['leaderboard', 'runde', 'neste', 'velkommen', 'terminliste', 'meldinger'];
const W = 1920; const H = 1080;

function useParams() {
  const q = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const sek = Math.max(8, Math.min(120, Number(q.get('sek')) || 20));
  const vis = (q.get('vis') || '').split(',').map((s) => s.trim()).filter((s) => ALL.includes(s));
  return { sek, vis: vis.length ? vis : ALL };
}

function useScale() {
  const [s, setS] = useState(1);
  useEffect(() => {
    const fit = () => setS(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit(); window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return s;
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  return now;
}

function Qr({ url, size = 260 }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 0, width: size * 2, color: { dark: '#19261C', light: '#FFFFFF' }, errorCorrectionLevel: 'M' }).then(setSrc).catch(() => {});
  }, [url, size]);
  return <div className="d-qr" style={{ width: size + 48, height: size + 48 }}>{src && <img src={src} alt="" width={size} height={size} />}</div>;
}

function Dots({ value }) {
  return <span className="d-dots" aria-label={`Vanskelighet ${value} av 5`}>{[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= value ? 'on' : ''} />)}</span>;
}

// ---------- Visningene ----------
function Leaderboard({ res, title }) {
  const { table, results } = res;
  const shown = table.filter((t) => t.played > 0);
  const lastRound = Math.max(0, ...ROUNDS.filter((r) => results[r.n]?.validCount > 0).map((r) => r.n));
  const provisional = ROUNDS.some((r) => roundStatus(r) === 'pagar' && results[r.n]?.validCount > 0);
  const playoff = ROUNDS.filter((r) => roundStatus(r) === 'ferdig').length >= SETTINGS.countingRounds;
  const top = shown.slice(0, 20);
  const half = Math.ceil(top.length / 2);
  const cols = top.length > 10 ? [top.slice(0, half), top.slice(half)] : [top];
  return (
    <div className="d-slide">
      <div className="d-head">
        <div>
          <div className="d-kicker">{title}</div>
          <h1 className="d-title">Leaderboard / OoM</h1>
        </div>
        {lastRound > 0 && <div className={provisional ? 'd-pill d-pill-warn' : 'd-pill'}>{provisional ? 'Foreløpig etter' : 'Etter'} runde {lastRound}</div>}
      </div>
      {shown.length === 0 ? (
        <div className="d-empty">Leaderboardet kommer når de første resultatene er registrert.</div>
      ) : (
        <div className="d-cols">
          {cols.map((col, ci) => (
            <table key={ci} className="d-table">
              <thead><tr><th className="pl">Pl.</th><th className="name">Spiller</th><th>Runder</th><th>Seire</th><th>Poeng</th></tr></thead>
              <tbody>
                {col.map((t) => (
                  <tr key={t.id} className={playoff && t.qualified ? 'q' : ''}>
                    <td className="pl"><span className={t.place <= 3 ? `d-pos p${t.place}` : 'd-pos'}>{t.place}</span></td>
                    <td className="name">{t.name}</td>
                    <td>{t.played}</td>
                    <td>{t.wins || '–'}</td>
                    <td className="pts">{t.counting}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      )}
      <div className="d-foot-note">{SETTINGS.countingRounds} beste runder teller · topp {SETTINGS.playoffSpots} til sluttspill {formatDate(FINAL.date)}</div>
    </div>
  );
}

function RoundSlide({ round, result, title }) {
  const rows = result.rows.filter((x) => x.valid).slice(0, 10);
  const prov = roundStatus(round) !== 'ferdig';
  return (
    <div className="d-slide">
      <div className="d-head">
        <div>
          <div className="d-kicker">{title} · Runde {round.n}</div>
          <h1 className="d-title">{round.course}</h1>
        </div>
        <div className={prov ? 'd-pill d-pill-warn' : 'd-pill'}>{prov ? `Foreløpig resultat · spilles til ${formatRange(round).split(' – ')[1]}` : 'Resultat'}</div>
      </div>
      <table className="d-table d-table-wide">
        <thead><tr><th className="pl">Pl.</th><th className="name">Spiller</th><th>Score</th><th>Brutto</th><th>HCP</th><th>Netto</th><th>Poeng</th></tr></thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.player_id}>
              <td className="pl"><span className={x.place <= 3 ? `d-pos p${x.place}` : 'd-pos'}>{x.ties > 1 ? `T${x.place}` : x.place}</span></td>
              <td className="name">{x.name}</td>
              <td className={x.toPar < 0 ? 'topar under' : 'topar'}>{fmtToPar(x.toPar)}</td>
              <td>{x.gross}</td>
              <td>{fmtSigned(x.ph)}</td>
              <td className="pts">{x.net}</td>
              <td className="pts">{x.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="d-foot-note">{result.validCount} spillere{result.validCount > 10 ? ' · topp 10 vises' : ''} · Score = netto mot par · hele listen finner du i appen</div>
    </div>
  );
}

function NextRound({ round, title }) {
  const st = roundStatus(round);
  return (
    <div className="d-slide">
      <div className="d-head">
        <div>
          <div className="d-kicker">{title} · {st === 'pagar' ? 'Pågår nå' : 'Neste runde'}</div>
          <h1 className="d-title">Runde {round.n} · {round.course}</h1>
        </div>
        <div className="d-pill">{formatRange(round)}</div>
      </div>
      <div className="d-split">
        <div className="d-col-main">
          <p className="d-lead">{round.about}</p>
          <div className="d-facts">
            <div><span>Sted</span><strong>{round.place}</strong></div>
            <div><span>Hull</span><strong>{round.holes}</strong></div>
            <div><span>Tee herrer</span><strong>{round.men}</strong></div>
            <div><span>Tee damer</span><strong>{round.women}</strong></div>
            <div><span>Par (18 hull)</span><strong>{round.par}</strong></div>
            <div><span>Vanskelighet</span><strong><Dots value={round.difficulty} /></strong></div>
          </div>
        </div>
        <div className="d-qr-card">
          <Qr url={TOURNAMENT_SIGNUP_URL} size={250} />
          <strong>Bli med i vinterserien</strong>
          <span>Legg deg til turneringen i Trackman, og meld inn Golfbox-HCP i appen</span>
        </div>
      </div>
    </div>
  );
}

function Schedule({ title }) {
  const cur = currentRound();
  return (
    <div className="d-slide">
      <div className="d-head">
        <div>
          <div className="d-kicker">{title}</div>
          <h1 className="d-title">Terminliste</h1>
        </div>
        <div className="d-pill">{SETTINGS.countingRounds} av 10 runder teller</div>
      </div>
      <div className="d-sched">
        {ROUNDS.map((r) => {
          const st = roundStatus(r);
          return (
            <div key={r.n} className={`d-sched-row ${st}${cur && cur.n === r.n ? ' cur' : ''}`}>
              <span className="n">R{r.n}</span>
              <span className="c"><strong>{r.course}</strong><span>{r.holes}</span></span>
              <span className="when">{formatRange(r)}</span>
              <span className="st">{st === 'pagar' ? 'Pågår' : st === 'ferdig' ? 'Ferdig' : ''}</span>
            </div>
          );
        })}
        <div className="d-sched-row final">
          <span className="n"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9H4a2 2 0 0 1 0-4h2M18 9h2a2 2 0 0 0 0-4h-2" /><path d="M6 3h12v6a6 6 0 0 1-12 0z" /><path d="M12 15v4M8 21h8" /></svg></span>
          <span className="c"><strong>Sluttspill matchplay</strong><span>Topp 4 · semifinaler og finale</span></span>
          <span className="when">{formatDate(FINAL.date)}</span>
          <span className="st" />
        </div>
      </div>
    </div>
  );
}

function Welcome() {
  return (
    <div className="d-slide">
      <div className="d-head">
        <div>
          <div className="d-kicker">Velkommen til Alvøen Innegolf</div>
          <h1 className="d-title">Ha oss i lomma</h1>
        </div>
      </div>
      <div className="d-qr-row">
        <div className="d-qr-card">
          <Qr url={APP_URL} size={270} />
          <strong>Last ned appen</strong>
          <span>Varsler, vinterserien og kontakt med oss</span>
        </div>
        <div className="d-qr-card">
          <Qr url={BOOKING_URL} size={270} />
          <strong>Book neste runde</strong>
          <span>Ledige tider hos Albaplay</span>
        </div>
        <div className="d-qr-card">
          <Qr url={`${APP_URL}/#/kontakt`} size={270} />
          <strong>Noe som ikke virker?</strong>
          <span>Send oss en melding, så ordner vi det</span>
        </div>
      </div>
      <div className="d-foot-note">Skann med kameraet på mobilen · app.alvoeninnegolf.no</div>
    </div>
  );
}

function MessagesSlide({ messages }) {
  return (
    <div className="d-slide">
      <div className="d-head">
        <div>
          <div className="d-kicker">Fra Alvøen Innegolf</div>
          <h1 className="d-title">Siste nytt</h1>
        </div>
      </div>
      <div className="d-msgs">
        {messages.map((m) => (
          <div key={m.id} className="d-msg">
            <div className="d-msg-top"><span className="d-tag">{categoryLabel(m.category)}</span><span>{new Date(m.created_at).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' })}</span></div>
            <strong>{m.title}</strong>
            {m.body && <p>{m.body.length > 220 ? `${m.body.slice(0, 217)}…` : m.body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Skjermen ----------
export default function Display() {
  const { sek, vis } = useParams();
  const scale = useScale();
  const now = useClock();
  const res = useResults();
  const [tour, setTour] = useState(null);
  const [messages, setMessages] = useState([]);
  const [idx, setIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const timer = useRef(null);

  // Hent nye data hvert 2. minutt.
  useEffect(() => {
    const load = () => {
      supabase.from('tournament').select('title').eq('id', 1).single().then(({ data }) => data && setTour(data));
      supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(3)
        .then(({ data }) => setMessages((data || []).filter((m) => Date.now() - new Date(m.created_at).getTime() < 21 * 86400000)));
    };
    load();
    const t = setInterval(() => { load(); res.reload(); }, 120000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Skjul musepeker og hold skjermen våken (der nettleseren tillater det).
  useEffect(() => {
    document.body.classList.add('display-mode');
    let lock = null;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => { document.body.classList.remove('display-mode'); lock?.release?.().catch(() => {}); };
  }, []);

  const title = tour?.title || 'Vinterserien 2026/27';
  const data = res.data;
  const cur = currentRound();
  const resultRound = data ? [...ROUNDS].reverse().find((r) => roundStatus(r) !== 'kommer' && data.results[r.n]?.validCount > 0) : null;

  const slides = useMemo(() => vis.map((id) => {
    if (id === 'leaderboard') return data ? { id, el: <Leaderboard res={data} title={title} /> } : null;
    if (id === 'runde') return resultRound ? { id, el: <RoundSlide round={resultRound} result={data.results[resultRound.n]} title={title} /> } : null;
    if (id === 'neste') return cur ? { id, el: <NextRound round={cur} title={title} /> } : null;
    if (id === 'terminliste') return { id, el: <Schedule title={title} /> };
    if (id === 'velkommen') return { id, el: <Welcome /> };
    if (id === 'meldinger') return messages.length ? { id, el: <MessagesSlide messages={messages} /> } : null;
    return null;
  }).filter(Boolean), [vis, data, title, resultRound, cur, messages]);

  const count = slides.length;
  const active = count ? idx % count : 0;

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setIdx((i) => i + 1), sek * 1000);
    return () => clearTimeout(timer.current);
  }, [idx, sek, tick]);

  // Piltaster / klikk for å bla manuelt (nyttig ved oppsett).
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { setIdx((i) => i + 1); setTick((t) => t + 1); }
      if (e.key === 'ArrowLeft') { setIdx((i) => i - 1 + count); setTick((t) => t + 1); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [count]);

  return (
    <div className="d-viewport" onClick={() => { setIdx((i) => i + 1); setTick((t) => t + 1); }}>
      <div className="d-stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <header className="d-bar">
          <img src="/logo.png" alt="Alvøen innegolf" className="d-logo" />
          <div className="d-clock">
            <strong>{now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}</strong>
            <span>{now.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
        </header>
        <main className="d-main">
          {slides.map((s, i) => (
            <div key={s.id} className={i === active ? 'd-frame on' : 'd-frame'} aria-hidden={i !== active}>{s.el}</div>
          ))}
          {!count && <div className="d-empty">Laster …</div>}
        </main>
        <footer className="d-progress">
          {slides.map((s, i) => (
            <span key={s.id} className={i === active ? 'on' : ''}>
              {i === active && <i key={`${idx}-${tick}`} style={{ animationDuration: `${sek}s` }} />}
            </span>
          ))}
        </footer>
      </div>
    </div>
  );
}
