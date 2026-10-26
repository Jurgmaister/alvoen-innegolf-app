import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

const EMAIL_RE = /[^\s,;<>()"']+@[^\s,;<>()"']+\.[a-z]{2,}/gi;

// E-post til alle spillere i vinterserien som har e-post i kontaktfeltet.
// Åpner e-postprogrammet med spillerne i blindkopi (de ser ikke hverandres adresser).
export default function PlayerEmail() {
  const [players, setPlayers] = useState(null);
  const [me, setMe] = useState('');
  const [subject, setSubject] = useState('Vinterserien – ');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState('');
  const [showMissing, setShowMissing] = useState(false);

  useEffect(() => {
    supabase.from('players').select('id, name, contact').order('name').then(({ data, error }) => setPlayers(error ? [] : data));
    supabase.auth.getSession().then(({ data }) => setMe(data.session?.user?.email || ''));
  }, []);

  if (!players) return null;
  const withEmail = players.map((p) => ({ ...p, email: (p.contact || '').match(EMAIL_RE)?.[0]?.toLowerCase() })).filter((p) => p.email);
  const emails = [...new Set(withEmail.map((p) => p.email))];
  const missing = players.filter((p) => !withEmail.some((w) => w.id === p.id));

  const addr = (a) => encodeURIComponent(a).replace(/%40/g, '@');
  const mailto = `mailto:${addr(me)}?bcc=${emails.map(addr).join(',')}`
    + `&subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;

  const copy = async () => {
    setMsg('');
    try {
      await navigator.clipboard.writeText(emails.join(', '));
      setMsg(`${emails.length} adresser er kopiert. Lim dem inn i Bcc-feltet (blindkopi).`);
    } catch {
      setMsg('Kunne ikke kopiere. Marker adressene under og kopier dem selv.');
      setShowMissing('alle');
    }
  };

  return (
    <section className="stack gap12">
      <h2 className="label">E-POST TIL SPILLERNE</h2>
      <div className="card stack gap12">
        <p className="small">
          <strong>{emails.length} av {players.length} spillere</strong> har e-post registrert.
          {missing.length > 0 && <> <button className="inline-link small" onClick={() => setShowMissing(showMissing === true ? false : true)}>{showMissing === true ? 'Skjul' : 'Vis'} hvem som mangler</button></>}
        </p>
        {showMissing === true && <p className="small muted">{missing.map((p) => p.name).join(', ')}. Legg til e-post under Resultater → Spillere.</p>}
        {showMissing === 'alle' && <p className="small selectable">{emails.join(', ')}</p>}
        <label className="field">Emne<input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} /></label>
        <label className="field">Tekst (kan også skrives i e-postprogrammet)<textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <div className="row gap8 wrap">
          <a className={emails.length ? 'btn btn-primary' : 'btn btn-primary disabled'} href={emails.length ? mailto : undefined} aria-disabled={!emails.length}>Skriv e-post til {emails.length} spillere</a>
          <button className="btn btn-ghost" disabled={!emails.length} onClick={copy}>Kopier adressene</button>
        </div>
        <span className="small muted">E-posten sendes fra ditt eget e-postprogram, med deg som mottaker og spillerne i blindkopi. Svar kommer til deg. Åpnes ikke e-postprogrammet, bruker du «Kopier adressene».</span>
        {msg && <p className="success small">{msg}</p>}
      </div>
    </section>
  );
}
