import { Fragment, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { TOURNAMENT_SIGNUP_URL } from '../config.js';
import { ROUNDS, ROUND_SETTINGS, FINAL, roundStatus, currentRound, formatRange, formatDate } from '../rounds.js';
import Topbar from '../components/Topbar.jsx';
import { useQuery, fetchTournament } from '../data.js';
import { useResults, fmtIndex, fmtSigned } from '../results.js';
import { SETTINGS } from '../scoring.js';
import HcpSubmit from './HcpSubmit.jsx';

function Dots({ value }) {
  return (
    <span className="dots" role="img" aria-label={`Vanskelighetsgrad ${value} av 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= value ? 'dot-on' : 'dot-off'} />)}
    </span>
  );
}

function RoundResult({ result, provisional }) {
  const rows = result.rows.filter((x) => x.valid);
  if (!rows.length) return null;
  return (
    <div className="stack gap6">
      <div className="row between center gap8">
        <strong className="t14">{provisional ? 'Foreløpig resultat' : 'Resultat'} ({rows.length} spillere)</strong>
        {provisional && <span className="tag tag-warn">Foreløpig</span>}
      </div>
      <table className="res-table">
        <thead><tr><th>Pl.</th><th>Spiller</th><th>Brutto</th><th>HCP</th><th>Netto</th><th>Poeng</th></tr></thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.player_id}>
              <td>{x.ties > 1 ? `T${x.place}` : x.place}</td>
              <td>{x.name}{x.tee && <span className="tee-note">Tee {x.tee.name.replace(/ \(.*\)$/, '')}</span>}</td>
              <td>{x.gross}</td>
              <td>{fmtSigned(x.ph)}</td>
              <td className="strong">{x.net}</td>
              <td className="strong">{x.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <span className="small muted">HCP = playing handicap for runden (fra 50 % av Golfbox-indeks, slope og CR). T = delt plass.</span>
    </div>
  );
}

function RoundRow({ r, result }) {
  const st = roundStatus(r);
  const [open, setOpen] = useState(st === 'pagar');
  const hasResult = result && result.validCount > 0;
  const cls = ['round-item', st === 'ferdig' && 'round-done', st === 'pagar' && 'round-now', open && 'round-open'].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <button className="round" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="round-n">R{r.n}</span>
        <span className="grow stack gap2">
          <span className="t15 medium">{r.course}</span>
          <span className="small muted">{formatRange(r)}</span>
        </span>
        {st === 'pagar' && <span className="tag tag-turnering">Pågår</span>}
        {st === 'ferdig' && <span className="small muted">{hasResult ? 'Resultat' : 'Ferdig'}</span>}
        {st === 'pagar' && hasResult && <span className="sr-only">Foreløpig resultat</span>}
        <span className="chev" aria-hidden="true"><Icon name="chevron" size={18} strokeWidth={2} /></span>
      </button>
      {open && (
        <div className="round-info stack gap10">
          <p className="body-text">{r.about}</p>
          <dl className="facts">
            <div><dt>Sted</dt><dd>{r.place}</dd></div>
            <div><dt>Hull som spilles</dt><dd>{r.holes}</dd></div>
            <div><dt>Par (18 hull)</dt><dd>{r.par}</dd></div>
            <div><dt>Vanskelighet</dt><dd><Dots value={r.difficulty} /></dd></div>
            <div><dt>Tee herrer</dt><dd>{r.men}</dd></div>
            <div><dt>Tee damer</dt><dd>{r.women}</dd></div>
          </dl>
          <span className="small muted">Lengdene gjelder hele banen fra valgt tee.</span>
          {hasResult && <RoundResult result={result} provisional={st !== 'ferdig'} />}
        </div>
      )}
    </div>
  );
}

function OomRow({ t, highlight }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="round-item">
      <button className="standing plain-btn oom-row" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className={highlight && t.qualified ? 'pos pos-top' : 'pos'}>{t.place}</span>
        <span className="grow stack gap2">
          <span className="t15 medium">{t.name}</span>
          <span className="small muted">{t.played} runde{t.played === 1 ? '' : 'r'}{t.wins ? ` · ${t.wins} seier${t.wins === 1 ? '' : 'e'}` : ''}</span>
        </span>
        <span className="t15 strong">{t.counting}</span>
      </button>
      {open && (
        <div className="oom-detail">
          {ROUNDS.filter((r) => t.perRound[r.n] !== undefined).map((r) => (
            <span key={r.n} className={t.droppedRounds.includes(r.n) ? 'chip-pt dropped' : 'chip-pt'}>R{r.n}: {t.perRound[r.n]}</span>
          ))}
          <span className="small muted" style={{ width: '100%' }}>
            Indeks {fmtIndex(t.player.hcp_index)} · totalt {t.total} p{t.droppedRounds.length ? ` · ${t.droppedRounds.length} strøket (gjennomstreket)` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

function OrderOfMerit({ res }) {
  if (res.loading) return <p className="muted small">Henter resultater …</p>;
  if (res.error || !res.data) return null;
  const { table, results } = res.data;
  const shown = table.filter((t) => t.played > 0);
  const lastRound = Math.max(0, ...ROUNDS.filter((r) => results[r.n]?.validCount > 0).map((r) => r.n));
  const xmas = [...table].filter((t) => t.beforeChristmas > 0).sort((a, b) => b.beforeChristmas - a.beforeChristmas || a.order - b.order).slice(0, 3);
  const top = shown.slice(0, SETTINGS.playoffSpots);
  const finalDone = ROUNDS.every((r) => roundStatus(r) === 'ferdig');
  // Sluttspilloppsett og sluttspill-linje vises først når 7 runder er ferdig spilt.
  const showPlayoff = ROUNDS.filter((r) => roundStatus(r) === 'ferdig').length >= SETTINGS.countingRounds;
  // Foreløpig så lenge en runde med registrerte resultater ikke er ferdig spilt.
  const openRound = ROUNDS.find((r) => roundStatus(r) === 'pagar' && results[r.n]?.validCount > 0);

  return (
    <>
      <section className="stack gap10">
        <div className="row between baseline">
          <h2 className="label">LEADERBOARD / OOM</h2>
          {lastRound > 0 && <span className="small muted">{openRound ? 'Foreløpig etter' : 'Etter'} runde {lastRound}</span>}
        </div>
        {openRound && (
          <div className="notice row gap10">
            <span className="tag tag-warn">Foreløpig</span>
            <span className="small">Runde {openRound.n} pågår til {formatDate(openRound.end)}. Plasseringene kan endre seg til runden er ferdig spilt.</span>
          </div>
        )}
        <div className="card list">
          {shown.length === 0 && <p className="muted small pad12">Leaderboardet kommer når de første resultatene er registrert.</p>}
          {shown.map((t, i) => (
            <Fragment key={t.id}>
              <OomRow t={t} highlight={showPlayoff} />
              {showPlayoff && t.place === SETTINGS.playoffSpots && shown[i + 1] && <div className="cutline"><span />SLUTTSPILL<span /></div>}
            </Fragment>
          ))}
        </div>
        {shown.length > 0 && <span className="small muted">Poeng fra de {SETTINGS.countingRounds} beste rundene teller. Likt: flest seire, deretter beste runde. Trykk på en spiller for poeng per runde.</span>}
      </section>

      {showPlayoff && top.length === SETTINGS.playoffSpots && (
        <section className="stack gap10">
          <div className="row between baseline">
            <h2 className="label">SLUTTSPILL</h2>
            <span className="small muted">{finalDone ? formatDate(FINAL.date) : 'Foreløpig oppsett'}</span>
          </div>
          <div className="bracket">
            <div className="card stack gap4"><span className="small muted">Semifinale 1</span><strong className="t14">{top[0].name}</strong><span className="small muted">mot</span><strong className="t14">{top[3].name}</strong></div>
            <div className="card stack gap4"><span className="small muted">Semifinale 2</span><strong className="t14">{top[1].name}</strong><span className="small muted">mot</span><strong className="t14">{top[2].name}</strong></div>
          </div>
          <span className="small muted">Matchplay {formatDate(FINAL.date)}. Vinnerne møtes i finalen, taperne i bronsefinalen.</span>
        </section>
      )}

      {xmas.length > 0 && (
        <section className="stack gap10">
          <h2 className="label">FØR JUL (R1–R5)</h2>
          <div className="card list">
            {xmas.map((t, i) => (
              <div key={t.id} className="standing">
                <span className="pos">{i + 1}</span>
                <span className="grow t15 medium">{t.name}</span>
                <span className="t15 strong">{t.beforeChristmas}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Signup({ open }) {
  if (!open) return <p className="hero-note left">Påmeldingen er stengt.</p>;
  return (
    <>
      <a className="btn btn-accent btn-lg" href={TOURNAMENT_SIGNUP_URL} target="_blank" rel="noopener">
        Meld deg på <Icon name="external" size={18} strokeWidth={2} />
      </a>
      <p className="hero-note left">Du legger deg til turneringen i Trackman. Krever egen Trackman-konto.</p>
    </>
  );
}

export default function Tournament() {
  const t = useQuery(fetchTournament, []);
  const res = useResults();
  const tour = t.data;
  const cur = currentRound();

  if (t.loading) return <main className="page"><Topbar /><p className="muted">Henter turnering …</p></main>;
  if (t.error || !tour) return <main className="page"><Topbar /><p className="error">Kunne ikke hente turneringen.</p></main>;

  return (
    <main className="page">
      <Topbar />
      <div className="stack gap4">
        <span className="label">TURNERING</span>
        <h1 className="h1">{tour.title}</h1>
      </div>

      {tour.summary && <p className="body-text">{tour.summary}</p>}

      <section className="hero stack gap12">
        <span className="label label-light">{cur ? (roundStatus(cur) === 'pagar' ? 'PÅGÅR NÅ' : 'NESTE RUNDE') : 'SLUTTSPILL'}</span>
        <div className="stack gap4">
          <strong className="t18">{cur ? `Runde ${cur.n} · ${cur.course}` : FINAL.title}</strong>
          <span className="hero-text small">{cur ? formatRange(cur) : formatDate(FINAL.date)}</span>
        </div>
        <Signup open={tour.signup_open} />
      </section>

      <HcpSubmit />

      <section className="stack gap10">
        <div className="row between baseline">
          <h2 className="label">RUNDER</h2>
          <span className="small muted">Trykk for baneinfo og resultat</span>
        </div>
        <div className="card list">
          {ROUNDS.map((r) => <RoundRow key={r.n} r={r} result={res.data?.results[r.n]} />)}
          <div className="round">
            <span className="round-n round-final" aria-hidden="true"><Icon name="trophy" size={16} strokeWidth={2} /></span>
            <div className="grow stack gap2">
              <span className="t15 medium">{FINAL.title}</span>
              <span className="small muted">{formatDate(FINAL.date)}</span>
            </div>
          </div>
        </div>
        <div className="card stack gap6">
          <strong className="t14">Likt for alle runder</strong>
          {ROUND_SETTINGS.map(([k, v]) => (
            <div key={k} className="row between gap12 small"><span className="muted">{k}</span><span>{v}</span></div>
          ))}
        </div>
      </section>

      <OrderOfMerit res={res} />

      {tour.rules && (
        <section className="stack gap10">
          <h2 className="label">REGLER</h2>
          <p className="card body-text">{tour.rules}</p>
        </section>
      )}
    </main>
  );
}
