import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, callPush } from '../supabase.js';

// Kunder fra Alba: hentes via push-funksjonen (alba-sync) og vises fra databasen (alba_overview).
const DAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn'];
const DAY_MS = 86400000;
const nok = (minor, cur = 'NOK') => (minor === null || minor === undefined ? '–'
  : `${Math.round(Number(minor) / 100).toLocaleString('nb-NO')} ${cur === 'NOK' ? 'kr' : cur}`);
const daysAgo = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS) : null);
const fmtAgo = (iso) => {
  const d = daysAgo(iso);
  if (d === null) return 'aldri';
  if (d <= 0) return 'i dag';
  if (d === 1) return 'i går';
  if (d < 14) return `${d} dager siden`;
  if (d < 60) return `${Math.round(d / 7)} uker siden`;
  return `${Math.round(d / 30)} mnd siden`;
};
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–');
const norm = (s) => (s || '').trim().toLowerCase();

const FILTERS = [
  { id: 'alle', label: 'Alle', test: () => true },
  { id: 'faste', label: 'Faste', hint: '3+ bookinger siste 90 dager', test: (c) => c.last90 >= 3 },
  { id: 'nye', label: 'Nye', hint: 'første booking siste 30 dager', test: (c) => c.first_at && daysAgo(c.first_at) <= 30 && daysAgo(c.first_at) >= 0 },
  { id: 'borte', label: 'Ikke sett på lenge', hint: '3+ bookinger totalt, men ingen siste 60 dager', test: (c) => c.bookings >= 3 && (daysAgo(c.last_at) ?? 999) > 60 && !c.next_at },
  { id: 'aldri', label: 'Uten booking', hint: 'kunder uten bekreftet booking (f.eks. gavekort)', test: (c) => c.bookings === 0 },
];
const SORTS = [
  { id: 'sist', label: 'Sist spilt', fn: (a, b) => (b.last_at || '').localeCompare(a.last_at || '') },
  { id: 'flest', label: 'Flest bookinger', fn: (a, b) => b.bookings - a.bookings || b.hours - a.hours },
  { id: 'brukt', label: 'Mest brukt', fn: (a, b) => b.spent_minor - a.spent_minor },
  { id: 'navn', label: 'Navn', fn: (a, b) => (a.name || '').localeCompare(b.name || '', 'nb') },
];

function Tile({ value, label }) {
  return (
    <div className="card stack gap2 kpi">
      <strong className="kpi-value">{value}</strong>
      <span className="small muted">{label}</span>
    </div>
  );
}

function Bars({ items, valueOf, labelOf, format = (v) => v }) {
  const max = Math.max(1, ...items.map(valueOf));
  return (
    <div className="bars" role="list">
      {items.map((it, i) => (
        <div key={i} className="bar-col" role="listitem" aria-label={`${labelOf(it)}: ${format(valueOf(it))}`}>
          <span className="bar-val">{valueOf(it) ? format(valueOf(it)) : ''}</span>
          <div className="bar" style={{ height: `${Math.max(2, (valueOf(it) / max) * 100)}%` }} />
          <span className="bar-lbl">{labelOf(it)}</span>
        </div>
      ))}
    </div>
  );
}

function Heatmap({ cells }) {
  const map = new Map(cells.map((c) => [`${c.dow}-${c.hr}`, c.n]));
  const hours = cells.length ? cells.map((c) => c.hr) : [8, 22];
  const from = Math.min(...hours); const to = Math.max(...hours);
  const hrs = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const max = Math.max(1, ...cells.map((c) => c.n));
  return (
    <div className="table-scroll">
      <table className="heat" aria-label="Bookinger per ukedag og klokkeslett">
        <thead><tr><th />{hrs.map((h) => <th key={h}>{String(h).padStart(2, '0')}</th>)}</tr></thead>
        <tbody>
          {DAYS.map((d, i) => (
            <tr key={d}>
              <th>{d}</th>
              {hrs.map((h) => {
                const n = map.get(`${i + 1}-${h}`) || 0;
                return <td key={h} title={`${d} kl. ${h}: ${n}`} style={{ background: n ? `rgba(40,70,89,${0.12 + 0.88 * (n / max)})` : undefined, color: n / max > 0.5 ? '#fff' : undefined }}>{n || ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CustomerRow({ c, cur, inSeries }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="list-item">
      <button className="plain-btn row between center gap8" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="stack gap2 grow" style={{ minWidth: 0 }}>
          <strong className="t15">{c.name || c.email || 'Uten navn'}{inSeries && <span className="tag tag-turnering mini-tag">Vinterserien</span>}</strong>
          <span className="small muted">{c.bookings} booking{c.bookings === 1 ? '' : 'er'} · {Math.round(c.hours)} t · sist {fmtAgo(c.last_at)}{c.spent_minor ? ` · ${nok(c.spent_minor, cur)}` : ''}</span>
        </span>
        <span className="small muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="stack gap4 small cust-detail">
          {c.email && <span>E-post: <a href={`mailto:${c.email}`}>{c.email}</a>{c.email_on ? ' · ja til nyhetsbrev' : ''}</span>}
          {c.phone && <span>Mobil: <a href={`tel:${c.phone.replace(/\s+/g, '')}`}>{c.phone}</a></span>}
          <span className="muted">Første booking: {fmtDate(c.first_at)} · Kunde siden {fmtDate(c.created_at)}</span>
          {c.next_at && <span>Neste booking: <strong>{fmtWhen(c.next_at)}</strong></span>}
          <span className="muted">Siste 90 dager: {c.last90} booking{c.last90 === 1 ? '' : 'er'}</span>
        </div>
      )}
    </div>
  );
}

export default function CustomersAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sync, setSync] = useState({ busy: false, msg: '', error: '' });
  const [filter, setFilter] = useState('alle');
  const [sort, setSort] = useState('sist');
  const [q, setQ] = useState('');
  const [shown, setShown] = useState(50);
  const [players, setPlayers] = useState([]);

  const load = useCallback(async () => {
    const { data: d, error: err } = await supabase.rpc('alba_overview');
    if (err) { setError(/alba_overview|alba_/.test(err.message) ? 'setup' : err.message); return null; }
    setError(''); setData(d); return d;
  }, []);

  const runSync = useCallback(async () => {
    setSync({ busy: true, msg: 'Henter fra Alba …', error: '' });
    const total = { contacts: 0, bookings: 0, orders: 0 };
    try {
      for (let round = 0; round < 15; round++) {
        const r = await callPush('alba-sync');
        for (const [k, v] of Object.entries(r.fetched || {})) total[k] = (total[k] || 0) + v;
        setSync({ busy: true, msg: `Henter fra Alba … ${total.contacts} kunder, ${total.bookings} bookinger, ${total.orders} betalinger`, error: '' });
        if (r.done) break;
      }
      await load();
      const n = total.contacts + total.bookings + total.orders;
      setSync({ busy: false, msg: n ? `Oppdatert: ${total.contacts} kunder, ${total.bookings} bookinger og ${total.orders} betalinger hentet.` : 'Oppdatert. Ingen endringer siden sist.', error: '' });
    } catch (e) {
      setSync({ busy: false, msg: '', error: /Ukjent handling/.test(e.message) ? 'Push-funksjonen må oppdateres i Supabase før appen kan hente fra Alba.' : e.message });
    }
  }, [load]);

  useEffect(() => {
    supabase.from('players').select('name, contact').then(({ data: p }) => setPlayers(p || []));
    load().then((d) => {
      if (!d) return;
      const last = Math.max(0, ...(d.sync || []).map((s) => (s.last_run ? new Date(s.last_run).getTime() : 0)));
      if (Date.now() - last > 60 * 60 * 1000) runSync(); // automatisk når det er over en time siden
    });
  }, [load, runSync]);

  const customers = useMemo(() => (data?.customers || []).map((c) => ({ ...c, bookings: Number(c.bookings), hours: Number(c.hours), last90: Number(c.last90), spent_minor: Number(c.spent_minor) })), [data]);
  const seriesKeys = useMemo(() => {
    const s = new Set();
    for (const p of players) { s.add(norm(p.name)); const m = (p.contact || '').match(/\S+@\S+\.\S+/); if (m) s.add(norm(m[0])); }
    return s;
  }, [players]);

  if (error === 'setup') {
    return (
      <div className="card stack gap8">
        <strong className="t16">Kunder er ikke satt opp ennå</strong>
        <p className="body-text">Kjør filen supabase/alba.sql i Supabase (SQL Editor → New query → Run), oppdater push-funksjonen og last siden på nytt.</p>
      </div>
    );
  }
  if (error) return <p className="error small">{error}</p>;
  if (!data) return <p className="muted">Henter …</p>;

  const cur = data.currency || 'NOK';
  const f = FILTERS.find((x) => x.id === filter);
  const needle = norm(q);
  const list = customers
    .filter(f.test)
    .filter((c) => !needle || [c.name, c.email, c.phone].some((v) => norm(v).includes(needle)))
    .sort(SORTS.find((s) => s.id === sort).fn);
  const active90 = customers.filter((c) => c.last90 > 0).length;
  const new30 = customers.filter(FILTERS[2].test).length;
  const lastRun = Math.max(0, ...(data.sync || []).map((s) => (s.last_run ? new Date(s.last_run).getTime() : 0)));
  const syncErr = (data.sync || []).find((s) => s.last_error);
  const emptyData = customers.length === 0 && Number(data.bookings_total) === 0;

  return (
    <div className="stack gap20">
      <div className="card row between center gap12 wrap">
        <span className="small muted grow">
          {sync.busy ? sync.msg : sync.msg || (lastRun ? `Sist hentet fra Alba ${fmtWhen(new Date(lastRun).toISOString())}` : 'Ikke hentet fra Alba ennå')}
        </span>
        <button className="btn btn-primary btn-sm" disabled={sync.busy} onClick={runSync}>{sync.busy ? 'Henter …' : 'Oppdater fra Alba'}</button>
        {sync.error && <p className="error small" style={{ width: '100%' }}>{sync.error}</p>}
        {!sync.error && syncErr && !sync.busy && <p className="error small" style={{ width: '100%' }}>Forrige henting feilet: {syncErr.last_error}</p>}
      </div>

      {emptyData ? (
        <p className="muted">Ingen data ennå. {sync.busy ? 'Første henting kan ta et par minutter.' : 'Trykk «Oppdater fra Alba».'}</p>
      ) : (
        <>
          <div className="kpis">
            <Tile value={customers.length.toLocaleString('nb-NO')} label="kunder totalt" />
            <Tile value={active90.toLocaleString('nb-NO')} label="har spilt siste 90 dager" />
            <Tile value={new30.toLocaleString('nb-NO')} label="nye siste 30 dager" />
            <Tile value={Number(data.bookings_total).toLocaleString('nb-NO')} label="bookinger totalt" />
          </div>

          <section className="stack gap10">
            <h2 className="label">NYE KUNDER PER UKE</h2>
            <div className="card">
              {data.new_per_week.length
                ? <Bars items={data.new_per_week} valueOf={(w) => Number(w.n)} labelOf={(w) => `u${Number(w.week.split('-')[1])}`} />
                : <p className="small muted">Ingen nye kunder siste 12 uker.</p>}
            </div>
          </section>

          <section className="stack gap10">
            <div className="row between baseline"><h2 className="label">NÅR SPILLES DET?</h2><span className="small muted">Bookinger siste 90 dager</span></div>
            <div className="card"><Heatmap cells={data.heatmap} /></div>
          </section>

          {data.revenue.length > 0 && (
            <section className="stack gap10">
              <div className="row between baseline"><h2 className="label">OMSETNING PER MÅNED</h2><span className="small muted">Etter refusjoner</span></div>
              <div className="card">
                <Bars items={data.revenue} valueOf={(m) => Number(m.net_minor) / 100} labelOf={(m) => new Date(`${m.month}-01`).toLocaleDateString('nb-NO', { month: 'short' })}
                  format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v))} />
              </div>
            </section>
          )}

          <section className="stack gap10">
            <h2 className="label">KUNDER</h2>
            <label className="field">Søk<input type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(50); }} placeholder="Navn, e-post eller mobil" autoComplete="off" /></label>
            <div className="row wrap gap8" role="group" aria-label="Filter">
              {FILTERS.map((x) => (
                <button key={x.id} className={filter === x.id ? 'chip chip-solid' : 'chip'} aria-pressed={filter === x.id} onClick={() => { setFilter(x.id); setShown(50); }}>
                  {x.label} ({customers.filter(x.test).length})
                </button>
              ))}
            </div>
            {f.hint && <span className="small muted">{f.label}: {f.hint}.</span>}
            <label className="field small-field">Sorter
              <select className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <div className="card list">
              {list.length === 0 && <p className="small muted pad12">Ingen kunder her.</p>}
              {list.slice(0, shown).map((c) => (
                <CustomerRow key={c.id} c={c} cur={cur} inSeries={seriesKeys.has(norm(c.name)) || seriesKeys.has(norm(c.email))} />
              ))}
            </div>
            {list.length > shown && <button className="btn btn-ghost" onClick={() => setShown(shown + 100)}>Vis flere ({list.length - shown} til)</button>}
          </section>
          <p className="small muted">Data fra Alba (kun lesing). Bare dere som er administratorer kan se kundeopplysningene.</p>
        </>
      )}
    </div>
  );
}
