import { Fragment, useState } from 'react';
import { supabase } from '../supabase.js';
import { useQuery, fetchTournament, fetchStandings } from '../data.js';

const PLAYOFF_SPOTS = 4;

// Handicapindeks i vinterserien: 50 % av Golfbox-HCP, én desimal.
export const lockedIndex = (hcp) => Math.round(Number(hcp) * 0.5 * 10) / 10;

function Signup({ open }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', hcp: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  if (!open) return <p className="hero-note left">Påmeldingen er stengt.</p>;
  if (status === 'done') return <p className="signup-done">Du er påmeldt. Vi tar kontakt om noe mangler.</p>;
  if (!show) return <button className="btn btn-accent btn-lg" onClick={() => setShow(true)}>Meld meg på</button>;

  const hcpNum = Number(String(form.hcp).replace(',', '.'));
  const hcpValid = form.hcp !== '' && Number.isFinite(hcpNum) && hcpNum >= -10 && hcpNum <= 54;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!hcpValid) { setError('Skriv inn Golfbox-handicap, f.eks. 14,3.'); return; }
    setStatus('busy');
    setError('');
    const { error: err } = await supabase.from('signups').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      golfbox_hcp: hcpNum,
      locked_index: lockedIndex(hcpNum),
    });
    if (err) { setStatus('idle'); setError('Påmeldingen feilet. Prøv igjen, eller ta kontakt.'); return; }
    setStatus('done');
  };

  return (
    <form className="signup stack gap10" onSubmit={submit}>
      <label className="field-dark">Navn<input required value={form.name} onChange={set('name')} autoComplete="name" /></label>
      <label className="field-dark">E-post<input required type="email" value={form.email} onChange={set('email')} autoComplete="email" /></label>
      <label className="field-dark">Mobil<input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" /></label>
      <label className="field-dark">Handicap i Golfbox
        <input required inputMode="decimal" value={form.hcp} onChange={set('hcp')} placeholder="f.eks. 14,3" />
      </label>
      {hcpValid && (
        <p className="hero-note left">Din indeks i vinterserien blir {lockedIndex(hcpNum).toLocaleString('nb-NO', { minimumFractionDigits: 1 })} (50 %), låst ved påmelding.</p>
      )}
      {error && <p className="error-light small">{error}</p>}
      <button className="btn btn-accent btn-lg" disabled={status === 'busy'}>
        {status === 'busy' ? 'Sender …' : 'Send påmelding'}
      </button>
    </form>
  );
}

export default function Tournament() {
  const t = useQuery(fetchTournament, []);
  const s = useQuery(fetchStandings, []);
  const tour = t.data;

  if (t.loading) return <main className="page"><p className="muted">Henter turnering …</p></main>;
  if (t.error || !tour) return <main className="page"><p className="error">Kunne ikke hente turneringen.</p></main>;

  return (
    <main className="page">
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
