import { useState } from 'react';
import Topbar from '../components/Topbar.jsx';
import Icon from '../components/Icon.jsx';
import { callPush } from '../supabase.js';
import { deviceId } from '../track.js';

export const CONTACT_TOPICS = [
  { id: 'sporsmal', label: 'Spørsmål' },
  { id: 'feil', label: 'Feil eller problem' },
  { id: 'turnering', label: 'Turnering' },
  { id: 'annet', label: 'Annet' },
];
export const contactTopicLabel = (id) => CONTACT_TOPICS.find((t) => t.id === id)?.label || 'Annet';

const ME_KEY = 'alvoen.contactMe';
function savedMe() {
  try { return JSON.parse(localStorage.getItem(ME_KEY)) || {}; } catch { return {}; }
}

export default function Contact() {
  const me = savedMe();
  const [name, setName] = useState(me.name || '');
  const [contact, setContact] = useState(me.contact || '');
  const [topic, setTopic] = useState('sporsmal');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // skjult felt mot roboter
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await callPush('contact', { name, contact, topic, message, website, deviceId: deviceId() });
      try { localStorage.setItem(ME_KEY, JSON.stringify({ name, contact })); } catch { /* ignorer */ }
      setSent(true); setMessage('');
    } catch (err) {
      setError(/fetch|network/i.test(err.message) ? 'Får ikke kontakt med serveren. Sjekk nettet og prøv igjen.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <Topbar><a href="#/" className="link small">Til forsiden</a></Topbar>
      <div className="stack gap4">
        <span className="label">KONTAKT</span>
        <h1 className="h1">Send oss en melding</h1>
        <p className="body-text muted">Spørsmål, feil på simulatoren eller noe annet? Skriv til oss, så svarer vi så snart vi kan.</p>
      </div>

      {sent ? (
        <div className="card stack gap12">
          <strong className="t16">Takk for meldingen!</strong>
          <p className="small muted">{contact ? `Vi svarer deg på ${contact} så snart vi kan.` : 'Du la ikke igjen e-post eller mobil, så vi kan ikke svare deg direkte.'}</p>
          <div className="row gap8 wrap">
            <a href="#/" className="btn btn-primary btn-sm">Til forsiden</a>
            <button className="btn btn-ghost btn-sm" onClick={() => setSent(false)}>Send en ny melding</button>
          </div>
        </div>
      ) : (
        <form className="stack gap14" onSubmit={send}>
          <div className="stack gap8">
            <span className="field-label">Hva gjelder det?</span>
            <div className="row wrap gap8">
              {CONTACT_TOPICS.map((t) => (
                <button type="button" key={t.id} className={topic === t.id ? 'chip chip-solid' : 'chip'}
                  aria-pressed={topic === t.id} onClick={() => setTopic(t.id)}>{t.label}</button>
              ))}
            </div>
          </div>
          <label className="field">Navn<input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
          <label className="field">E-post eller mobil
            <input maxLength={120} value={contact} onChange={(e) => setContact(e.target.value)} autoComplete="email" inputMode="email" />
            <span className="small muted field-hint">Så vi kan svare deg</span>
          </label>
          <label className="field">Melding<textarea required rows={6} maxLength={2000} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
          <label className="hp" aria-hidden="true">Nettside<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
          <button className="btn btn-accent btn-lg" disabled={busy || !name.trim() || !message.trim()}>
            <Icon name="send" size={18} strokeWidth={2} /> {busy ? 'Sender …' : 'Send melding'}
          </button>
          {error && <p className="error small">{error}</p>}
          <p className="small muted">Meldingen går bare til eierne av Alvøen Innegolf.</p>
        </form>
      )}
    </main>
  );
}
