import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

const PLATFORM_LABELS = { ios: 'iPhone/iPad', android: 'Android', pc: 'PC/Mac', annet: 'Annet' };
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
const short = (iso) => { const d = new Date(iso); return `${d.getDate()}. ${MONTHS[d.getMonth()]}`; };

function Stat({ value, label, hint }) {
  return (
    <div className="card stat">
      <span className="stat-value">{value ?? '–'}</span>
      <span className="stat-label">{label}</span>
      {hint && <span className="small muted">{hint}</span>}
    </div>
  );
}

export default function StatsAdmin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    const { data: d, error: err } = await supabase.rpc('app_stats');
    if (err) setError(err.message); else setData(d);
  };
  useEffect(() => { load(); }, []);

  if (error) {
    return (
      <div className="card stack gap8">
        <strong className="t16">Statistikken er ikke satt opp ennå</strong>
        <p className="body-text">Kjør filen supabase/statistikk.sql i Supabase (SQL Editor → New query → Run), og last siden på nytt.</p>
      </div>
    );
  }
  if (!data) return <p className="muted">Henter statistikk …</p>;

  const pct = (n) => (data.total ? `${Math.round((n / data.total) * 100)} % av enhetene` : null);
  const platforms = Object.entries(data.platforms || {}).sort((a, b) => b[1] - a[1]);
  const weeks = data.weeks || [];
  const maxWeek = Math.max(1, ...weeks.map((w) => w.n));

  return (
    <div className="stack gap20">
      <div className="grid2">
        <Stat value={data.total} label="Enheter totalt" hint="Har åpnet appen minst én gang" />
        <Stat value={data.installed} label="På hjemskjermen" hint={pct(data.installed)} />
        <Stat value={data.push} label="Push-varsler på" hint="Enheter som får varsler" />
        <Stat value={data.active_7} label="Aktive siste 7 dager" hint={`${data.active_30} siste 30 dager`} />
      </div>

      <section className="stack gap10">
        <h2 className="label">NYE ENHETER PER UKE</h2>
        <div className="card stack gap8">
          {weeks.map((w) => (
            <div key={w.week} className="row center gap12">
              <span className="small muted week-label">Uke fra {short(w.week)}</span>
              <span className="bar grow"><span className="bar-fill" style={{ width: `${(w.n / maxWeek) * 100}%` }} /></span>
              <strong className="t14 week-n">{w.n}</strong>
            </div>
          ))}
        </div>
      </section>

      {platforms.length > 0 && (
        <section className="stack gap10">
          <h2 className="label">TYPE ENHET</h2>
          <div className="card list">
            {platforms.map(([p, n]) => (
              <div key={p} className="list-item row between">
                <span className="t15">{PLATFORM_LABELS[p] || p}</span>
                <strong className="t15">{n}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="small muted">
        Tellingen er anonym: hver telefon eller PC får et tilfeldig nummer, uten navn eller kontaktinfo.
        {data.since ? ` Tellingen startet ${short(data.since)}.` : ''} Enheter som tømmer nettleserdata eller bruker privat
        modus kan telles flere ganger, og på iPhone telles appen på hjemskjermen som egen enhet hvis siden først ble åpnet i Safari. Egne besøk på admin-siden telles også.
      </p>
      <button className="btn btn-ghost" onClick={load}>Oppdater tallene</button>
    </div>
  );
}
