import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { supabase, callPush } from '../supabase.js';
import { CATEGORIES, categoryLabel } from '../config.js';
import { useQuery, fetchMessages, fetchTournament, fetchStandings, fetchInfoPages, formatWhen } from '../data.js';

// ---------- Innlogging ----------
function norskFeil(message = '') {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Feil e-post eller passord.';
  if (m.includes('email not confirmed')) return 'Brukeren er ikke bekreftet ennå. Huk av «Auto Confirm User» når brukeren lages i Supabase.';
  if (m.includes('rate limit') || m.includes('too many')) return 'For mange forsøk. Vent litt og prøv igjen.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Får ikke kontakt med serveren. Sjekk nettet og prøv igjen.';
  return message || 'Noe gikk galt. Prøv igjen.';
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const login = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(norskFeil(err.message));
  };

  return (
    <main className="page narrow">
      <a href="#/" className="back-link"><Icon name="back" size={20} strokeWidth={2} /> Til appen</a>
      <span className="label">INTERNT</span>
      <h1 className="h1">Logg inn</h1>
      <form className="stack gap12" onSubmit={login}>
        <label className="field">E-post<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label className="field">Passord<input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Logger inn …' : 'Logg inn'}</button>
      </form>
      {error && <p className="error small">{error}</p>}
      <p className="small muted">Glemt passordet? Jørgen kan sette nytt i Supabase.</p>
    </main>
  );
}

// ---------- Send melding ----------
function SendMessage() {
  const [category, setCategory] = useState('drift');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [subscribers, setSubscribers] = useState(null);
  const recent = useQuery(fetchMessages(20), []);

  useEffect(() => {
    callPush('stats').then((r) => setSubscribers(r.subscribers)).catch(() => {});
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Sende «${title}» som push-varsel til alle som følger ${categoryLabel(category).toLowerCase()}?`)) return;
    setBusy(true); setError(''); setResult('');
    try {
      const r = await callPush('send', { category, title, body });
      setResult(`Sendt. Varsel levert til ${r.sent} av ${r.total} enheter.`);
      setTitle(''); setBody('');
      recent.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Slette «${m.title}» fra meldingslisten? Varsler som er sendt, kan ikke trekkes tilbake.`)) return;
    await supabase.from('messages').delete().eq('id', m.id);
    recent.reload();
  };

  return (
    <div className="stack gap20">
      <form className="stack gap14" onSubmit={send}>
        <div className="stack gap8">
          <span className="field-label">Kategori</span>
          <div className="row wrap gap8">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id} className={category === c.id ? 'chip chip-solid' : 'chip'}
                aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.label}</button>
            ))}
          </div>
          <span className="small muted">Går til alle som har slått på varsler for denne kategorien{subscribers !== null ? ` (${subscribers} enheter har varsler på totalt)` : ''}.</span>
        </div>
        <label className="field">Tittel<input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="field">Melding<textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} /></label>

        {title && (
          <div className="stack gap8">
            <span className="field-label">Slik ser varselet ut</span>
            <div className="card preview">
              <img src="/icons/icon-192.png" alt="" width="38" height="38" />
              <div className="grow stack gap2">
                <div className="row between"><strong className="small">Alvøen Innegolf</strong><span className="small muted">nå</span></div>
                <strong className="t14">{title}</strong>
                {body && <span className="small muted clamp2">{body}</span>}
              </div>
            </div>
          </div>
        )}

        <button className="btn btn-accent btn-lg" disabled={busy || !title.trim()}>
          <Icon name="send" size={18} strokeWidth={2} /> {busy ? 'Sender …' : 'Send push-varsel'}
        </button>
        {result && <p className="success small">{result}</p>}
        {error && <p className="error small">{error}</p>}
      </form>

      <section className="stack gap10">
        <h2 className="label">SENDTE MELDINGER</h2>
        <div className="card list">
          {recent.data?.length === 0 && <p className="muted small pad12">Ingen meldinger ennå.</p>}
          {recent.data?.map((m) => (
            <div key={m.id} className="list-item row between center gap8">
              <div className="stack gap2 grow">
                <strong className="t15">{m.title}</strong>
                <span className="small muted">{categoryLabel(m.category)} · {formatWhen(m.created_at)}</span>
              </div>
              <button className="icon-btn" aria-label={`Slett ${m.title}`} onClick={() => remove(m)}><Icon name="trash" size={20} /></button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------- Turnering ----------
const TOUR_FIELDS = [
  ['title', 'Navn på turneringen'],
  ['summary', 'Kort beskrivelse', 'textarea'],
  ['next_round_title', 'Neste runde (f.eks. «Runde 3»)'],
  ['next_round_course', 'Bane'],
  ['next_round_dates', 'Når den spilles (f.eks. «1.–14. november»)'],
  ['standings_after', 'Tabelltekst (f.eks. «Etter runde 2»)'],
  ['rules', 'Regler', 'textarea'],
];

function TournamentAdmin() {
  const t = useQuery(fetchTournament, []);
  const s = useQuery(fetchStandings, []);
  const [form, setForm] = useState(null);
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState('');

  useEffect(() => { if (t.data) setForm(t.data); }, [t.data]);
  useEffect(() => { if (s.data) setRows(s.data.map((r) => ({ name: r.name, points: r.points }))); }, [s.data]);

  if (!form) return <p className="muted">Henter …</p>;

  const saveInfo = async () => {
    setMsg('');
    const { id, ...fields } = form;
    const { error } = await supabase.from('tournament').update(fields).eq('id', 1);
    setMsg(error ? `Feil: ${error.message}` : 'Turneringsinfo lagret.');
  };

  const saveTable = async () => {
    setMsg('');
    const clean = rows.filter((r) => r.name.trim()).map((r, i) => ({ position: i + 1, name: r.name.trim(), points: r.points.trim() }));
    const del = await supabase.from('standings').delete().gte('id', 0);
    if (del.error) { setMsg(`Feil: ${del.error.message}`); return; }
    if (clean.length) {
      const { error } = await supabase.from('standings').insert(clean);
      if (error) { setMsg(`Feil: ${error.message}`); return; }
    }
    setMsg('Tabellen er lagret.');
    s.reload();
  };

  const setRow = (i, k, v) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  return (
    <div className="stack gap20">
      <section className="stack gap12">
        <h2 className="label">TURNERINGSINFO</h2>
        {TOUR_FIELDS.map(([key, label, type]) => (
          <label key={key} className="field">{label}
            {type === 'textarea'
              ? <textarea rows={3} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              : <input value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
          </label>
        ))}
        <label className="row gap8 center t15">
          <input type="checkbox" className="checkbox" checked={form.signup_open}
            onChange={(e) => setForm({ ...form, signup_open: e.target.checked })} />
          Påmeldingen er åpen
        </label>
        <button className="btn btn-primary" onClick={saveInfo}>Lagre turneringsinfo</button>
      </section>

      <section className="stack gap12">
        <h2 className="label">ORDER OF MERIT</h2>
        <p className="small muted">Skriv inn i rekkefølge fra førsteplass. Poeng føres fra regnearket deres.</p>
        {rows.map((r, i) => (
          <div key={i} className="row gap8 center">
            <span className={i < 4 ? 'pos pos-top' : 'pos'}>{i + 1}</span>
            <input className="input grow" aria-label={`Navn plass ${i + 1}`} value={r.name} onChange={(e) => setRow(i, 'name', e.target.value)} placeholder="Navn" />
            <input className="input w80" aria-label={`Poeng plass ${i + 1}`} value={r.points} onChange={(e) => setRow(i, 'points', e.target.value)} placeholder="Poeng" />
            <button className="icon-btn sm" aria-label="Flytt opp" onClick={() => move(i, -1)}>↑</button>
            <button className="icon-btn sm" aria-label="Fjern rad" onClick={() => setRows(rows.filter((_, j) => j !== i))}><Icon name="trash" size={18} /></button>
          </div>
        ))}
        <div className="row gap8">
          <button className="btn btn-ghost" onClick={() => setRows([...rows, { name: '', points: '' }])}><Icon name="plus" size={18} /> Legg til spiller</button>
          <button className="btn btn-primary grow" onClick={saveTable}>Lagre tabell</button>
        </div>
      </section>
      {msg && <p className={msg.startsWith('Feil') ? 'error small' : 'success small'}>{msg}</p>}
    </div>
  );
}

// ---------- Påmeldte ----------
function Signups() {
  const { data, loading, error, reload } = useQuery(
    (sb) => sb.from('signups').select('*').order('created_at'), [],
  );

  const csv = () => {
    const head = 'Navn;E-post;Mobil;Golfbox-HCP;Indeks vinterserien;Påmeldt';
    const lines = (data || []).map((r) => [r.name, r.email, r.phone, String(r.golfbox_hcp).replace('.', ','),
      String(r.locked_index).replace('.', ','), new Date(r.created_at).toLocaleString('nb-NO')].join(';'));
    const blob = new Blob(['﻿' + [head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pameldte-vinterserien.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const remove = async (r) => {
    if (!window.confirm(`Fjerne påmeldingen til ${r.name}?`)) return;
    await supabase.from('signups').delete().eq('id', r.id);
    reload();
  };

  if (loading) return <p className="muted">Henter …</p>;
  if (error) return <p className="error">Kunne ikke hente påmeldte.</p>;

  return (
    <div className="stack gap12">
      <div className="row between center">
        <strong className="t16">{data.length} påmeldt</strong>
        {data.length > 0 && <button className="btn btn-ghost btn-sm" onClick={csv}>Last ned til Excel</button>}
      </div>
      <div className="card list">
        {data.length === 0 && <p className="muted small pad12">Ingen påmeldte ennå.</p>}
        {data.map((r) => (
          <div key={r.id} className="list-item row between center gap8">
            <div className="stack gap2 grow">
              <strong className="t15">{r.name}</strong>
              <span className="small muted">HCP {String(r.golfbox_hcp).replace('.', ',')} → indeks {String(r.locked_index).replace('.', ',')}</span>
              <span className="small muted">{r.email}{r.phone ? ` · ${r.phone}` : ''}</span>
            </div>
            <button className="icon-btn" aria-label={`Fjern ${r.name}`} onClick={() => remove(r)}><Icon name="trash" size={20} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Infosider ----------
function InfoAdmin() {
  const { data, reload } = useQuery(fetchInfoPages, []);
  const [pages, setPages] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (data) setPages(data); }, [data]);

  const save = async (p) => {
    setMsg('');
    const { error } = await supabase.from('info_pages').update({ title: p.title, body: p.body }).eq('slug', p.slug);
    setMsg(error ? `Feil: ${error.message}` : `«${p.title}» er lagret.`);
    reload();
  };
  const set = (slug, k, v) => setPages(pages.map((p) => (p.slug === slug ? { ...p, [k]: v } : p)));

  return (
    <div className="stack gap20">
      {pages.map((p) => (
        <section key={p.slug} className="stack gap10">
          <label className="field">Tittel<input value={p.title} onChange={(e) => set(p.slug, 'title', e.target.value)} /></label>
          <label className="field">Innhold<textarea rows={8} value={p.body} onChange={(e) => set(p.slug, 'body', e.target.value)} /></label>
          <button className="btn btn-primary" onClick={() => save(p)}>Lagre</button>
        </section>
      ))}
      {msg && <p className={msg.startsWith('Feil') ? 'error small' : 'success small'}>{msg}</p>}
    </div>
  );
}

// ---------- Admin-skall ----------
const TABS = [
  { id: 'melding', label: 'Send melding' },
  { id: 'turnering', label: 'Turnering' },
  { id: 'pameldte', label: 'Påmeldte' },
  { id: 'info', label: 'Infosider' },
  { id: 'kiosk', label: 'Kiosk' },
];

export default function Admin() {
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(null);
  const [tab, setTab] = useState('melding');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Rydd adressen etter innloggingslenken (fjern ?admin og eventuell feil i #-delen).
  useEffect(() => {
    if (session === undefined) return;
    const hash = window.location.hash;
    if (window.location.search || hash.startsWith('#error') || hash.startsWith('#access_token')) {
      window.history.replaceState(null, '', `${window.location.pathname}#/admin`);
    }
  }, [session]);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabase.rpc('is_admin').then(({ data }) => setIsAdmin(Boolean(data)));
  }, [session]);

  if (session === undefined) return <main className="page"><p className="muted">Laster …</p></main>;
  if (!session) return <Login />;
  if (isAdmin === null) return <main className="page"><p className="muted">Sjekker tilgang …</p></main>;

  const logout = () => supabase.auth.signOut();

  if (!isAdmin) {
    return (
      <main className="page narrow">
        <h1 className="h1">Ingen tilgang</h1>
        <p className="body-text">{session.user.email} er ikke registrert som administrator. Be Jørgen legge deg til.</p>
        <button className="btn btn-ghost" onClick={logout}>Logg ut</button>
      </main>
    );
  }

  return (
    <main className="page admin">
      <header className="row between center">
        <div className="stack gap4">
          <span className="label">INTERNT</span>
          <h1 className="h1">Administrasjon</h1>
        </div>
        <a href="#/" className="link small">Til appen</a>
      </header>

      <nav className="admin-tabs" aria-label="Adminmeny">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'chip chip-solid' : 'chip'} aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </nav>

      {tab === 'melding' && <SendMessage />}
      {tab === 'turnering' && <TournamentAdmin />}
      {tab === 'pameldte' && <Signups />}
      {tab === 'info' && <InfoAdmin />}
      {tab === 'kiosk' && (
        <div className="card stack gap8">
          <strong className="t16">Kommer i neste versjon</strong>
          <p className="body-text">Varelageret kobles til Vipps-salget når API-tilgangen er avklart med Vipps.</p>
        </div>
      )}

      <footer className="footer row between center">
        <span className="small muted">Innlogget som {session.user.email}</span>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Logg ut</button>
      </footer>
    </main>
  );
}
