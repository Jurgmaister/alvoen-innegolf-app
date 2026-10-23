import { Fragment, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { TOURNAMENT_SIGNUP_URL } from '../config.js';
import { ROUNDS, ROUND_SETTINGS, FINAL, roundStatus, currentRound, formatRange, formatDate } from '../rounds.js';
import Topbar from '../components/Topbar.jsx';
import { useQuery, fetchTournament, fetchStandings } from '../data.js';

const PLAYOFF_SPOTS = 4;

function Dots({ value }) {
  return (
    <span className="dots" role="img" aria-label={`Vanskelighetsgrad ${value} av 5`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= value ? 'dot-on' : 'dot-off'} />)}
    </span>
  );
}

function RoundRow({ r }) {
  const st = roundStatus(r);
  const [open, setOpen] = useState(st === 'pagar');
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
        {st === 'ferdig' && <span className="small muted">Ferdig</span>}
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
        </div>
      )}
    </div>
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
  const s = useQuery(fetchStandings, []);
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

      <section className="stack gap10">
        <div className="row between baseline">
          <h2 className="label">RUNDER</h2>
          <span className="small muted">Trykk for baneinfo</span>
        </div>
        <div className="card list">
          {ROUNDS.map((r) => <RoundRow key={r.n} r={r} />)}
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

      <section className="stack gap10">
        <div className="row between baseline">
          <h2 className="label">ORDER OF MERIT</h2>
          {tour.standings_after && <span className="small muted">{tour.standings_after}</span>}
        </div>
        <div className="card list">
          {s.loading && <p className="muted small pad12">Henter tabell …</p>}
          {s.data?.length === 0 && <p className="muted small pad12">Tabellen kommer etter første runde.</p>}
          {s.data?.map((r, i) => (
            <Fragment key={r.id}>
              <div className="standing">
                <span className={r.position <= PLAYOFF_SPOTS ? 'pos pos-top' : 'pos'}>{r.position}</span>
                <span className="grow t15 medium">{r.name}</span>
                <span className="t15 strong">{r.points}</span>
              </div>
              {r.position === PLAYOFF_SPOTS && s.data[i + 1] && (
                <div className="cutline"><span />SLUTTSPILL<span /></div>
              )}
            </Fragment>
          ))}
        </div>
      </section>

      {tour.rules && (
        <section className="stack gap10">
          <h2 className="label">REGLER</h2>
          <p className="card body-text">{tour.rules}</p>
        </section>
      )}
    </main>
  );
}
