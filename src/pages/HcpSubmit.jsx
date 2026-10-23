import { useState } from 'react';
import { supabase } from '../supabase.js';
import { hcpIndexUsed } from '../scoring.js';
import { fmtIndex } from '../results.js';

const parse = (v) => {
  const s = String(v).trim().replace(',', '.').replace(/^\+/, '-');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const ME_KEY = 'alvoen.hcpMe';
const savedMe = () => { try { return JSON.parse(localStorage.getItem(ME_KEY)) || {}; } catch { return {}; } };

export default function HcpSubmit() {
  const me = savedMe();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: me.name || '', trackman_name: me.trackman_name || '', gender: me.gender || 'H', hcp: '', contact: me.contact || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const hcp = parse(f.hcp);
  const hcpOk = hcp !== null && !Number.isNaN(hcp) && hcp >= -10 && hcp <= 54;
  const used = hcpOk ? hcpIndexUsed({ golfboxHcp: hcp }) : null;

  const send = async (e) => {
    e.preventDefault();
    if (!hcpOk) return;
    setBusy(true); setError('');
    const row = { name: f.name.trim(), trackman_name: f.trackman_name.trim(), gender: f.gender, golfbox_hcp: Math.round(hcp * 10) / 10, contact: f.contact.trim() };
    const { error: err } = await supabase.from('hcp_submissions').insert(row);
    setBusy(false);
    if (err) {
      setError(/hcp_submissions/.test(err.message) ? 'Innmeldingen er ikke åpnet ennå. Prøv igjen senere.' : 'Kunne ikke sende. Sjekk nettet og prøv igjen.');
      return;
    }
    try { localStorage.setItem(ME_KEY, JSON.stringify({ name: row.name, trackman_name: row.trackman_name, gender: row.gender, contact: row.contact })); } catch { /* ignorer */ }
    setSent({ hcp: row.golfbox_hcp, used });
    setF({ ...f, hcp: '' });
  };

  if (sent) {
    return (
      <section className="card stack gap8">
        <strong className="t16">Takk, handicapet er meldt inn!</strong>
        <p className="small muted">Golfbox {fmtIndex(sent.hcp)} gir indeks {fmtIndex(sent.used)} i vinterserien. Vi kontrollerer og legger det inn før resultatene regnes ut.</p>
        <button className="btn btn-ghost btn-sm self-start" onClick={() => { setSent(null); setOpen(false); }}>Ferdig</button>
      </section>
    );
  }

  return (
    <section className="card stack gap12">
      <div className="stack gap4">
        <strong className="t16">Meld inn ditt Golfbox HCP</strong>
        <span className="small muted">Du spiller på 50 % av Golfbox-indeksen din. Meld den inn når du melder deg på – den låses for hele serien.</span>
      </div>
      {!open ? (
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Meld inn HCP</button>
      ) : (
        <form className="stack gap12" onSubmit={send}>
          <label className="field">Navn<input required minLength={2} maxLength={80} value={f.name} onChange={set('name')} autoComplete="name" /></label>
          <label className="field">Navn i Trackman (hvis annerledes)<input maxLength={80} value={f.trackman_name} onChange={set('trackman_name')} /></label>
          <div className="stack gap6">
            <span className="field-label">Spiller fra</span>
            <div className="row gap8">
              {[['H', 'Herre-tee'], ['D', 'Dame-tee']].map(([v, l]) => (
                <button type="button" key={v} className={f.gender === v ? 'chip chip-solid' : 'chip'} aria-pressed={f.gender === v} onClick={() => setF({ ...f, gender: v })}>{l}</button>
              ))}
            </div>
          </div>
          <label className="field">Golfbox HCP-indeks
            <input required inputMode="decimal" placeholder="f.eks. 14,3" value={f.hcp} onChange={set('hcp')} />
            <span className={hcp !== null && !hcpOk ? 'small error field-hint' : 'small muted field-hint'}>
              {hcpOk ? <>Indeks i vinterserien: <strong>{fmtIndex(used)}</strong></> : hcp !== null ? 'Skriv et tall mellom +10 og 54, f.eks. 14,3' : 'Står i Golfbox-appen. Plusshandicap skrives med +.'}
            </span>
          </label>
          <label className="field">Mobil eller e-post (valgfritt)<input maxLength={120} value={f.contact} onChange={set('contact')} autoComplete="email" /></label>
          <div className="row gap8">
            <button className="btn btn-accent grow" disabled={busy || !hcpOk || f.name.trim().length < 2}>{busy ? 'Sender …' : 'Send inn'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Avbryt</button>
          </div>
          {error && <p className="error small">{error}</p>}
          <span className="small muted">Bare arrangørene ser kontaktinfoen din.</span>
        </form>
      )}
    </section>
  );
}
