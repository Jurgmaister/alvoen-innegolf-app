import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar.jsx';
import Icon from '../components/Icon.jsx';
import { CATEGORIES, categoryLabel } from '../config.js';
import { useQuery, fetchMessages, markMessagesSeen, formatWhen } from '../data.js';
import {
  pushSupported, needsInstallForPush, currentSubscription, enablePush, disablePush,
  savedTopics, updateTopics,
} from '../push.js';

function PushCard() {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [topics, setTopics] = useState(savedTopics);

  useEffect(() => {
    if (!pushSupported() || needsInstallForPush()) return;
    currentSubscription().then((s) => setOn(Boolean(s) && Notification.permission === 'granted')).catch(() => {});
  }, []);

  if (needsInstallForPush()) {
    return (
      <div className="card stack gap8">
        <div className="row gap12 center">
          <Icon name="bell" color="#284659" />
          <strong className="t15">Få varsler på iPhone</strong>
        </div>
        <p className="small muted">
          Legg appen på hjemskjermen først: trykk <Icon name="share" size={15} /> Del i Safari og velg
          «Legg til på Hjem-skjerm». Åpne appen derfra og slå på varsler her.
        </p>
      </div>
    );
  }

  if (!pushSupported()) {
    return <div className="card small muted">Denne nettleseren støtter ikke push-varsler.</div>;
  }

  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      if (on) { await disablePush(); setOn(false); }
      else { await enablePush(topics); setOn(true); }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleTopic = async (id) => {
    const next = topics.includes(id) ? topics.filter((t) => t !== id) : [...topics, id];
    setTopics(next);
    try { await updateTopics(next); } catch (e) { setError(e.message); }
  };

  return (
    <div className="card stack gap12">
      <div className="row gap12 center">
        <Icon name="bell" color="#284659" />
        <label htmlFor="push" className="grow stack gap2">
          <strong className="t15">Push-varsler</strong>
          <span className="small muted">{on ? 'Du får varsler om:' : 'Få beskjed med en gang noe skjer'}</span>
        </label>
        <button id="push" role="switch" aria-checked={on} disabled={busy}
          className={on ? 'switch switch-on' : 'switch'} onClick={toggle}>
          <span className="knob" />
        </button>
      </div>
      {on && (
        <div className="row wrap gap8">
          {CATEGORIES.map((c) => {
            const active = topics.includes(c.id);
            return (
              <button key={c.id} className={active ? 'chip chip-on' : 'chip'} aria-pressed={active}
                onClick={() => toggleTopic(c.id)}>
                {c.label}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}

export default function Messages() {
  const { data, loading, error } = useQuery(fetchMessages(50), []);
  const [filter, setFilter] = useState('alle');

  useEffect(() => {
    if (data?.length) markMessagesSeen(data[0].id);
  }, [data]);

  const shown = (data || []).filter((m) => filter === 'alle' || m.category === filter);

  return (
    <main className="page">
      <Topbar />
      <h1 className="h1">Meldinger</h1>
      <PushCard />
      <a href="#/kontakt" className="link small contact-link"><Icon name="mail" size={16} /> Vil du skrive til oss? Send en melding</a>

      <div className="row wrap gap8" role="group" aria-label="Filter">
        {[{ id: 'alle', label: 'Alle' }, ...CATEGORIES].map((c) => (
          <button key={c.id} className={filter === c.id ? 'chip chip-solid' : 'chip'}
            aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <section className="stack gap10">
        {loading && <p className="muted">Henter meldinger …</p>}
        {error && <p className="error">Kunne ikke hente meldinger. Prøv igjen senere.</p>}
        {!loading && !error && shown.length === 0 && <p className="muted">Ingen meldinger her ennå.</p>}
        {shown.map((m) => (
          <article key={m.id} className="card stack gap6">
            <div className="row between center gap8">
              <span className={`tag tag-${m.category}`}>{categoryLabel(m.category)}</span>
              <span className="small muted">{formatWhen(m.created_at)}</span>
            </div>
            <h2 className="t16 strong">{m.title}</h2>
            {m.body && <p className="body-text">{m.body}</p>}
          </article>
        ))}
      </section>
    </main>
  );
}
