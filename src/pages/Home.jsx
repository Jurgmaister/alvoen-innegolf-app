import { useEffect, useState } from 'react';
import Topbar from '../components/Topbar.jsx';
import Icon from '../components/Icon.jsx';
import { BOOKING_URL, categoryLabel, SHOW_INFO_PAGES } from '../config.js';
import { useQuery, fetchMessages, fetchTournament, fetchInfoPages, lastSeenMessageId, formatWhen } from '../data.js';
import { isIos, isStandalone } from '../push.js';

const INFO_ICONS = { simulator: 'info', adgang: 'lock' };

function InstallHint() {
  const [prompt, setPrompt] = useState(null);
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('alvoen.hideInstall') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (hidden || isStandalone()) return null;
  if (!prompt && !isIos()) return null;

  const hide = () => {
    try { localStorage.setItem('alvoen.hideInstall', '1'); } catch { /* ignorer */ }
    setHidden(true);
  };

  return (
    <div className="card install">
      <div className="install-text">
        <strong>Legg appen på hjemskjermen</strong>
        {prompt
          ? <span className="small muted">Raskere tilgang og push-varsler.</span>
          : <span className="small muted">Trykk <Icon name="share" size={15} /> Del og velg «Legg til på Hjem-skjerm».</span>}
      </div>
      <div className="row gap8">
        {prompt && (
          <button className="btn btn-primary btn-sm" onClick={async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); }}>
            Installer
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={hide}>Lukk</button>
      </div>
    </div>
  );
}

export default function Home() {
  const messages = useQuery(fetchMessages(2), []);
  const tournament = useQuery(fetchTournament, []);
  const pages = useQuery(SHOW_INFO_PAGES ? fetchInfoPages : async () => ({ data: [] }), []);
  const seen = lastSeenMessageId();
  const hasUnread = (messages.data || []).some((m) => m.id > seen);
  const t = tournament.data;

  return (
    <main className="page">
      <Topbar>
        <a href="#/meldinger" className="icon-btn" aria-label={hasUnread ? 'Meldinger, nye' : 'Meldinger'}>
          <Icon name="bell" />
          {hasUnread && <span className="dot dot-badge" />}
        </a>
      </Topbar>

      <InstallHint />

      <section className="hero">
        <h1 className="hero-title">Klar for en runde?</h1>
        <p className="hero-text">Book simulatoren hos Albaplay.</p>
        <a className="btn btn-accent btn-lg" href={BOOKING_URL} target="_blank" rel="noopener">
          Book tid <Icon name="external" size={18} strokeWidth={2} />
        </a>
        <p className="hero-note">Åpner Albaplay i nettleseren</p>
      </section>

      {t && (
        <section className="stack gap10">
          <h2 className="label">NESTE EVENT</h2>
          <a href="#/turnering" className="card card-link">
            <div className="date-chip"><Icon name="trophy" color="#284659" /></div>
            <div className="grow stack gap3">
              <strong className="t16">{t.title} – {t.next_round_title}</strong>
              <span className="small muted">{[t.next_round_course, t.next_round_dates].filter(Boolean).join(' · ') || 'Order of Merit'}</span>
            </div>
            <Icon name="chevron" color="#5B6B75" size={20} strokeWidth={2} />
          </a>
        </section>
      )}

      <section className="stack gap10">
        <div className="row between baseline">
          <h2 className="label">SISTE MELDINGER</h2>
          <a href="#/meldinger" className="link">Se alle</a>
        </div>
        <div className="card list">
          {messages.loading && <p className="muted small pad12">Henter …</p>}
          {messages.error && <p className="error small pad12">Kunne ikke hente meldinger.</p>}
          {messages.data?.length === 0 && <p className="muted small pad12">Ingen meldinger ennå.</p>}
          {messages.data?.map((m) => (
            <a key={m.id} href="#/meldinger" className="list-item">
              <div className="row between gap8">
                <strong className="t15">{m.title}</strong>
                {m.id > seen && <span className="dot" />}
              </div>
              <span className="small muted">{categoryLabel(m.category)} · {formatWhen(m.created_at).toLowerCase()}</span>
            </a>
          ))}
        </div>
      </section>

      {SHOW_INFO_PAGES && pages.data?.length > 0 && (
        <section className="grid2">
          {pages.data.map((p) => (
            <a key={p.slug} href={`#/info/${p.slug}`} className="card tile">
              <Icon name={INFO_ICONS[p.slug] || 'info'} color="#284659" size={24} />
              <strong className="t14">{p.title}</strong>
            </a>
          ))}
        </section>
      )}

      <footer className="footer">
        <a href="#/admin" className="small muted-link">Til admin-side</a>
      </footer>
    </main>
  );
}
