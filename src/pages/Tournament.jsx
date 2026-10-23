import { Fragment } from 'react';
import Icon from '../components/Icon.jsx';
import { TOURNAMENT_SIGNUP_URL } from '../config.js';
import Topbar from '../components/Topbar.jsx';
import { useQuery, fetchTournament, fetchStandings } from '../data.js';

const PLAYOFF_SPOTS = 4;

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
        <span className="label label-light">NESTE RUNDE</span>
        <div className="stack gap4">
          <strong className="t18">{[tour.next_round_title, tour.next_round_course].filter(Boolean).join(' · ')}</strong>
          {tour.next_round_dates && <span className="hero-text small">{tour.next_round_dates}</span>}
        </div>
        <Signup open={tour.signup_open} />
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
