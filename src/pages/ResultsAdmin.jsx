import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { supabase } from '../supabase.js';
import { ROUNDS, currentRound, formatRange } from '../rounds.js';
import { hcpIndexUsed, computeRound } from '../scoring.js';
import { useResults, isNine, fmtIndex, fmtSigned } from '../results.js';
import HcpCheck, { useChecks } from './HcpCheck.jsx';

const num = (v) => {
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

// ---------- Registrer score ----------
function ScoreEntry({ data, reload }) {
  const { checks } = useChecks();
  const defaultRound = (currentRound() || ROUNDS[ROUNDS.length - 1]).n;
  const [roundNo, setRoundNo] = useState(defaultRound);
  const round = ROUNDS.find((r) => r.n === roundNo);
  const ratings = data.ratingsByRound[roundNo];
  const nine = isNine(round);
  const roundTees = data.rounds.find((r) => r.n === roundNo)?.tees || [];
  const teesById = Object.fromEntries(roundTees.map((t) => [t.id, t]));
  const teeOk = (t, g) => (g === 'D' ? t.cr_w !== null && t.slope_w !== null && t.par_w !== null : t.cr_m !== null && t.slope_m !== null && t.par_m !== null);

  const saved = useMemo(() => Object.fromEntries(
    data.scores.filter((s) => s.round_no === roundNo).map((s) => [s.player_id, s]),
  ), [data.scores, roundNo]);

  const [draft, setDraft] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setDraft(Object.fromEntries(data.players.map((p) => [p.id, {
      gross: saved[p.id] ? String(saved[p.id].gross) : '',
      struck: saved[p.id]?.struck || false,
      tee_id: saved[p.id]?.tee_id ? String(saved[p.id].tee_id) : '',
    }])));
  }, [roundNo, saved, data.players]);
  useEffect(() => { setMsg(''); }, [roundNo]);

  const live = useMemo(() => {
    const scores = data.players
      .filter((p) => draft[p.id] && String(draft[p.id].gross).trim() !== '')
      .map((p) => ({ player_id: p.id, gross: num(draft[p.id].gross), struck: draft[p.id].struck, tee_id: draft[p.id].tee_id ? Number(draft[p.id].tee_id) : null }));
    return computeRound({ scores, players: data.players, ratings, nineHoles: nine, tees: teesById });
  }, [draft, data.players, ratings, nine, roundTees]); // eslint-disable-line react-hooks/exhaustive-deps
  const liveById = Object.fromEntries(live.rows.map((r) => [r.player_id, r]));

  const missingRatings = !ratings || [ratings.par_m, ratings.cr_m, ratings.slope_m, ratings.par_w, ratings.cr_w, ratings.slope_w].some((v) => v === null);
  const changed = data.players.filter((p) => {
    const d = draft[p.id]; const s = saved[p.id];
    if (!d) return false;
    const g = String(d.gross).trim();
    if (!s) return g !== '';
    return g === '' || num(g) !== s.gross || d.struck !== s.struck || (d.tee_id || '') !== (s.tee_id ? String(s.tee_id) : '');
  });

  const save = async () => {
    setMsg('');
    const bad = changed.find((p) => { const g = String(draft[p.id].gross).trim(); return g !== '' && (!Number.isInteger(num(g)) || num(g) < 1 || num(g) > 200); });
    if (bad) { setMsg(`Feil: ugyldig brutto for ${bad.name}.`); return; }
    setBusy(true);
    const upserts = []; const deletes = [];
    for (const p of changed) {
      const g = String(draft[p.id].gross).trim();
      if (g === '') deletes.push(p.id);
      else {
        const row = { round_no: roundNo, player_id: p.id, gross: num(g), struck: draft[p.id].struck, updated_at: new Date().toISOString() };
        if (data.teesReady) row.tee_id = draft[p.id].tee_id ? Number(draft[p.id].tee_id) : null;
        upserts.push(row);
      }
    }
    let error = null;
    if (upserts.length) ({ error } = await supabase.from('scores').upsert(upserts, { onConflict: 'round_no,player_id' }));
    if (!error && deletes.length) ({ error } = await supabase.from('scores').delete().eq('round_no', roundNo).in('player_id', deletes));
    setBusy(false);
    if (error) { setMsg(`Feil: ${error.message}`); return; }
    setMsg(`Lagret runde ${roundNo}. Order of Merit er oppdatert.`);
    reload();
  };

  const set = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  return (
    <div className="stack gap14">
      <label className="field">Runde
        <select className="select" value={roundNo} onChange={(e) => setRoundNo(Number(e.target.value))}>
          {ROUNDS.map((r) => <option key={r.n} value={r.n}>R{r.n} · {r.course} ({formatRange(r)})</option>)}
        </select>
      </label>
      <div className="small muted">
        {round.holes} · vinnerpoeng {live.winnerPoints} · {live.validCount} gyldige
        {ratings && !missingRatings && <> · H: par {ratings.par_m} / CR {fmtIndex(ratings.cr_m)} / slope {ratings.slope_m} · D: par {ratings.par_w} / CR {fmtIndex(ratings.cr_w)} / slope {ratings.slope_w}</>}
      </div>
      {missingRatings && <p className="warn">Baneverdier (par, CR, slope) mangler for denne runden. Fyll dem inn under «Baneverdier» før resultatene kan regnes ut.</p>}
      {data.players.length === 0 && <p className="muted">Legg inn spillere under «Spillere» først.</p>}

      {data.players.length > 0 && (
        <div className="card list">
          {data.players.map((p) => {
            const r = liveById[p.id];
            const d = draft[p.id] || { gross: '', struck: false, tee_id: '' };
            return (
              <div key={p.id} className="score-row">
                <div className="grow stack gap2">
                  <strong className="t15">{p.name}</strong>
                  <span className="small muted">
                    {p.gender === 'D' ? 'Dame' : 'Herre'} · indeks {fmtIndex(p.hcp_index)}
                    {r && r.ph !== null && <> · PH {fmtSigned(r.ph)}</>}
                    {r && r.net !== null && <> · netto {r.net}</>}
                  </span>
                  {r && r.valid && <span className="small strong">{r.place}. plass{r.ties > 1 ? ' (delt)' : ''} · {r.points} p</span>}
                  {r && !r.valid && r.check !== 'OK' && <span className="small error">{r.check}</span>}
                  {roundTees.length > 0 && (
                    <select className="select tee-select" aria-label={`Tee ${p.name}`} value={d.tee_id} onChange={(e) => set(p.id, { tee_id: e.target.value })}>
                      <option value="">Standard-tee ({p.gender === 'D' ? round.women : round.men})</option>
                      {roundTees.map((t) => (
                        <option key={t.id} value={t.id} disabled={!teeOk(t, p.gender)}>
                          {t.name}{t.length_m ? ` – ${t.length_m} m` : ''}{teeOk(t, p.gender) ? '' : ' (mangler verdier)'}
                        </option>
                      ))}
                    </select>
                  )}
                  {r && d.struck && <span className="small muted">Strøket – teller ikke</span>}
                  {(() => { const k = checks.find((c) => c.player_id === p.id && c.round_no === roundNo); return k && !k.ok ? <span className="tag tag-bad">Feil handicap i Trackman (kontroll {k.checked_on.split('-').reverse().join('.')})</span> : null; })()}
                </div>
                <div className="stack gap6 center">
                  <input className="input gross" inputMode="numeric" aria-label={`Brutto ${p.name}`} placeholder="Brutto"
                    value={d.gross} onChange={(e) => set(p.id, { gross: e.target.value.replace(/[^0-9]/g, '') })} />
                  <label className="tiny-check"><input type="checkbox" checked={d.struck} onChange={(e) => set(p.id, { struck: e.target.checked })} /> Strøket</label>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data.players.length > 0 && (
        <button className="btn btn-primary btn-lg" disabled={busy || changed.length === 0} onClick={save}>
          {busy ? 'Lagrer …' : changed.length ? `Lagre ${changed.length} endring${changed.length === 1 ? '' : 'er'}` : 'Ingen endringer'}
        </button>
      )}
      {msg && <p className={msg.startsWith('Feil') ? 'error small' : 'success small'}>{msg}</p>}
      <p className="small muted">Skriv brutto slag fra Trackman. Tomt felt = ikke spilt (lagres som slettet). Playing handicap, netto, plass og poeng regnes ut mens du skriver.</p>
    </div>
  );
}

// ---------- Spillere ----------
const EMPTY = { name: '', trackman_name: '', gender: 'H', golfbox_hcp: '', index_no_golfbox: '', contact: '', note: '' };

function PlayerForm({ initial, onSave, onCancel, onDelete, isNew, hasVerifyCols }) {
  const [f, setF] = useState({
    ...EMPTY, ...initial,
    golfbox_hcp: initial?.golfbox_hcp ?? '', index_no_golfbox: initial?.index_no_golfbox ?? '',
    golfbox_verified: initial?.golfbox_verified ?? false,
    golfbox_checked_on: initial?.golfbox_checked_on ?? new Date().toISOString().slice(0, 10),
  });
  const [unlock, setUnlock] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const gb = num(f.golfbox_hcp); const ng = num(f.index_no_golfbox);
  const preview = hcpIndexUsed({ golfboxHcp: gb, indexNoGolfbox: ng });
  const hcpLocked = !isNew && !unlock;

  const submit = (e) => {
    e.preventDefault();
    if (Number.isNaN(gb) || Number.isNaN(ng)) return;
    const values = { name: f.name.trim(), trackman_name: f.trackman_name.trim(), gender: f.gender, contact: f.contact.trim(), note: f.note.trim() };
    if (hasVerifyCols) Object.assign(values, { golfbox_verified: f.golfbox_verified, golfbox_checked_on: f.golfbox_checked_on || null });
    if (!hcpLocked) Object.assign(values, { golfbox_hcp: gb, index_no_golfbox: gb === null ? ng : null, hcp_index: preview });
    onSave(values);
  };

  return (
    <form className="stack gap10 kiosk-form" onSubmit={submit}>
      <label className="field">Navn<input required value={f.name} onChange={set('name')} /></label>
      <label className="field">Trackman-navn<input value={f.trackman_name} onChange={set('trackman_name')} placeholder="Navnet som vises i Trackman" /></label>
      <div className="stack gap6">
        <span className="field-label">Kjønn (styrer tee og CR/slope)</span>
        <div className="row gap8">
          {[['H', 'Herre'], ['D', 'Dame']].map(([v, l]) => (
            <button type="button" key={v} className={f.gender === v ? 'chip chip-solid' : 'chip'} aria-pressed={f.gender === v} onClick={() => setF({ ...f, gender: v })}>{l}</button>
          ))}
        </div>
      </div>
      {hcpLocked ? (
        <div className="card stack gap6 locked">
          <span className="small muted">HCP-indeks brukt (låst ved påmelding)</span>
          <strong className="t16">{fmtIndex(initial.hcp_index)}</strong>
          <span className="small muted">Golfbox: {initial.golfbox_hcp !== null ? fmtIndex(initial.golfbox_hcp) : '–'}{initial.index_no_golfbox !== null ? ` · uten Golfbox: ${fmtIndex(initial.index_no_golfbox)}` : ''}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUnlock(true)}>Endre handicap</button>
        </div>
      ) : (
        <>
          <div className="grid2">
            <label className="field">Golfbox HCP-indeks<input inputMode="decimal" value={f.golfbox_hcp} onChange={set('golfbox_hcp')} placeholder="f.eks. 14,0" /></label>
            <label className="field">Uten Golfbox (maks 36)<input inputMode="decimal" value={f.index_no_golfbox} onChange={set('index_no_golfbox')} placeholder="kun hvis ingen Golfbox" disabled={gb !== null && !Number.isNaN(gb)} /></label>
          </div>
          <p className="small">{preview !== null ? <>HCP-indeks brukt (50 %): <strong>{fmtIndex(preview)}</strong>{!isNew && ' – endrer resultatene for alle runder spilleren har spilt'}</> : <span className="muted">Skriv Golfbox-indeks (eller indeks uten Golfbox).</span>}</p>
        </>
      )}
      {hasVerifyCols && (
        <div className="stack gap6">
          <label className="tiny-check big-check"><input type="checkbox" checked={f.golfbox_verified} onChange={(e) => setF({ ...f, golfbox_verified: e.target.checked })} /> Jeg har sett handicapet i Golfbox (app eller skjermbilde)</label>
          <label className="field small-field">Dato sjekket i Golfbox<input type="date" value={f.golfbox_checked_on || ''} onChange={set('golfbox_checked_on')} /></label>
        </div>
      )}
      <label className="field">Telefon / e-post (kun synlig for admin)<input value={f.contact} onChange={set('contact')} /></label>
      <label className="field">Merknad (kun synlig for admin)<input value={f.note} onChange={set('note')} /></label>
      <div className="row gap8 wrap">
        <button className="btn btn-primary grow" disabled={!hcpLocked && preview === null}>{isNew ? 'Legg til spiller' : 'Lagre'}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Avbryt</button>
        {onDelete && <button type="button" className="btn btn-ghost" onClick={onDelete}><Icon name="trash" size={18} /> Slett</button>}
      </div>
    </form>
  );
}

function PlayerChips({ p, checks }) {
  const last = checks[0];
  const bad = checks.filter((k) => !k.ok).length;
  return (
    <span className="row wrap gap6">
      {p.golfbox_verified ? <span className="tag tag-turnering">Golfbox sjekket{p.golfbox_checked_on ? ` ${p.golfbox_checked_on.split('-').reverse().join('.')}` : ''}</span> : <span className="tag tag-warn">Golfbox ikke sjekket</span>}
      {last ? (last.ok ? <span className="tag tag-drift">Siste kontroll riktig</span> : <span className="tag tag-bad">Siste kontroll feil</span>) : <span className="tag tag-none">Ikke kontrollert</span>}
      {bad > 0 && <span className="tag tag-bad">{bad} avvik</span>}
    </span>
  );
}

function Players({ data, reload }) {
  const { checks, error: checksError } = useChecks();
  const hasVerifyCols = data.players.length === 0 ? !checksError : 'golfbox_verified' in data.players[0];
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const played = (id) => data.scores.filter((s) => s.player_id === id).length;

  const add = async (v) => {
    setMsg('');
    const { error } = await supabase.from('players').insert(v);
    if (error) { setMsg(`Feil: ${error.message}`); return; }
    setAdding(false); reload();
  };
  const update = async (id, v) => {
    setMsg('');
    const { error } = await supabase.from('players').update(v).eq('id', id);
    if (error) { setMsg(`Feil: ${error.message}`); return; }
    setEditing(null); reload();
  };
  const remove = async (p) => {
    const n = played(p.id);
    if (!window.confirm(`Slette ${p.name}?${n ? ` ${n} registrerte runde${n === 1 ? '' : 'r'} slettes også.` : ''}`)) return;
    await supabase.from('players').delete().eq('id', p.id);
    setEditing(null); reload();
  };

  return (
    <div className="stack gap14">
      <strong className="t16">{data.players.length} spillere</strong>
      {data.players.length > 0 && (
        <div className="card list">
          {data.players.map((p) => (editing === p.id ? (
            <div key={p.id} className="list-item">
              <PlayerForm hasVerifyCols={hasVerifyCols} initial={p} onSave={(v) => update(p.id, v)} onCancel={() => setEditing(null)} onDelete={() => remove(p)} />
            </div>
          ) : (
            <button key={p.id} className="list-item row between center gap8 plain-btn" onClick={() => setEditing(p.id)}>
              <span className="stack gap2 grow">
                <strong className="t15">{p.name}</strong>
                <span className="small muted">{p.gender === 'D' ? 'Dame' : 'Herre'} · indeks {fmtIndex(p.hcp_index)}{p.trackman_name ? ` · Trackman: ${p.trackman_name}` : ''} · {played(p.id)} runder</span>
                {hasVerifyCols && <PlayerChips p={p} checks={checks.filter((k) => k.player_id === p.id)} />}
              </span>
              <Icon name="chevron" size={18} color="#5B6B75" />
            </button>
          )))}
        </div>
      )}
      {adding
        ? <div className="card"><PlayerForm hasVerifyCols={hasVerifyCols} isNew onSave={add} onCancel={() => setAdding(false)} /></div>
        : <button className="btn btn-ghost" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Legg til spiller</button>}
      {msg && <p className="error small">{msg}</p>}
    </div>
  );
}

// ---------- Baneverdier ----------
const FIELDS = [['par_m', 'Par'], ['cr_m', 'CR'], ['slope_m', 'Slope'], ['par_w', 'Par'], ['cr_w', 'CR'], ['slope_w', 'Slope']];

function RatingRow({ r, initial, reload }) {
  const [f, setF] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, initial?.[k] ?? ''])));
  const [note, setNote] = useState(initial?.note ?? '');
  const [msg, setMsg] = useState('');
  const missing = FIELDS.some(([k]) => String(f[k]).trim() === '');

  const save = async () => {
    const values = { round_no: r.n, note: note.trim() };
    for (const [k] of FIELDS) {
      const v = num(f[k]);
      if (Number.isNaN(v)) { setMsg('Feil: bare tall'); return; }
      values[k] = v;
    }
    const { error } = await supabase.from('round_ratings').upsert(values);
    setMsg(error ? `Feil: ${error.message}` : 'Lagret');
    if (!error) reload();
  };

  return (
    <div className="list-item stack gap8">
      <div className="row between center gap8">
        <strong className="t15">R{r.n} · {r.course}</strong>
        {missing && <span className="tag tag-warn">Mangler</span>}
      </div>
      <span className="small muted">{r.holes}{isNine(r) ? ' – bruk 9-hullsverdier (par og CR for hullene som spilles)' : ''}</span>
      <div className="ratings-grid">
        {[0, 1].map((side) => (
          <div key={side} className="stack gap4">
            <span className="small strong">{side ? 'Dame' : 'Herre'} <span className="muted">({side ? r.women : r.men})</span></span>
            <div className="grid3">
              {FIELDS.slice(side * 3, side * 3 + 3).map(([k, label]) => (
                <label key={k} className="field small-field">{label}
                  <input inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <label className="field small-field">Kilde / merknad<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="row gap8 center">
        <button className="btn btn-primary btn-sm" onClick={save}>Lagre R{r.n}</button>
        {msg && <span className={msg.startsWith('Feil') ? 'error small' : 'success small'}>{msg}</span>}
      </div>
    </div>
  );
}

function TeeRow({ t, roundNo, nine, reload, onDone }) {
  const isNew = !t.id;
  const [f, setF] = useState(() => ({
    name: t.name ?? '', length_m: t.length_m ?? '', source: t.source ?? '', note: t.note ?? '',
    ...Object.fromEntries(FIELDS.map(([k]) => [k, t[k] ?? ''])),
  }));
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name.trim()) { setMsg('Feil: tee-navn mangler'); return; }
    const values = { round_no: roundNo, name: f.name.trim(), source: f.source.trim(), note: f.note.trim() };
    for (const k of ['length_m', ...FIELDS.map(([x]) => x)]) {
      const v = num(f[k]);
      if (Number.isNaN(v)) { setMsg('Feil: bare tall i tallfeltene'); return; }
      values[k] = v;
    }
    const q = isNew ? supabase.from('round_tees').insert({ ...values, sort: t.sort ?? 99 }) : supabase.from('round_tees').update(values).eq('id', t.id);
    const { error } = await q;
    if (error) { setMsg(`Feil: ${error.message}`); return; }
    setMsg('Lagret'); reload(); onDone?.();
  };
  const remove = async () => {
    if (!window.confirm(`Slette tee «${t.name}»? Spillere som har brukt den, får standard-tee.`)) return;
    await supabase.from('round_tees').delete().eq('id', t.id);
    reload();
  };
  const missingM = ['par_m', 'cr_m', 'slope_m'].some((k) => String(f[k]).trim() === '');
  const missingW = ['par_w', 'cr_w', 'slope_w'].some((k) => String(f[k]).trim() === '');
  const uncertain = /usikker|estimat/i.test(`${f.source} ${f.note}`);

  return (
    <div className="list-item stack gap8">
      <div className="grid2">
        <label className="field small-field">Tee<input value={f.name} onChange={set('name')} placeholder="f.eks. Gul" /></label>
        <label className="field small-field">Lengde (m)<input inputMode="numeric" value={f.length_m} onChange={set('length_m')} /></label>
      </div>
      <div className="row wrap gap6">
        {missingM && <span className="tag tag-none">Herre: mangler</span>}
        {missingW && <span className="tag tag-none">Dame: mangler</span>}
        {uncertain && <span className="tag tag-warn">Kontroller mot Trackman</span>}
      </div>
      <div className="ratings-grid">
        {[0, 1].map((side) => (
          <div key={side} className="stack gap4">
            <span className="small strong">{side ? 'Dame' : 'Herre'}</span>
            <div className="grid3">
              {FIELDS.slice(side * 3, side * 3 + 3).map(([k, label]) => (
                <label key={k} className="field small-field">{label}{nine && k.startsWith('par') ? ' (9)' : ''}
                  <input inputMode="decimal" value={f[k]} onChange={set(k)} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <label className="field small-field">Kilde<input value={f.source} onChange={set('source')} /></label>
      <label className="field small-field">Merknad<input value={f.note} onChange={set('note')} /></label>
      <div className="row gap8 center wrap">
        <button className="btn btn-primary btn-sm" onClick={save}>{isNew ? 'Legg til tee' : 'Lagre tee'}</button>
        {isNew ? <button className="btn btn-ghost btn-sm" onClick={onDone}>Avbryt</button> : <button className="btn btn-ghost btn-sm" onClick={remove}>Slett</button>}
        {msg && <span className={msg.startsWith('Feil') ? 'error small' : 'success small'}>{msg}</span>}
      </div>
    </div>
  );
}

function Ratings({ data, reload }) {
  const [roundNo, setRoundNo] = useState((currentRound() || ROUNDS[0]).n);
  const [adding, setAdding] = useState(false);
  const r = ROUNDS.find((x) => x.n === roundNo);
  const tees = data.rounds.find((x) => x.n === roundNo)?.tees || [];
  return (
    <div className="stack gap14">
      <label className="field">Runde
        <select className="select" value={roundNo} onChange={(e) => { setRoundNo(Number(e.target.value)); setAdding(false); }}>
          {ROUNDS.map((x) => <option key={x.n} value={x.n}>R{x.n} · {x.course}</option>)}
        </select>
      </label>
      <section className="stack gap8">
        <h2 className="label">STANDARD-TEE (TRACKMAN-OPPSETTET)</h2>
        <p className="small muted">Brukes når spilleren ikke har valgt annen tee.</p>
        <div className="card list">
          <RatingRow key={`${r.n}-${data.ratingsByRound[r.n]?.cr_m}-${data.ratingsByRound[r.n]?.cr_w}`} r={r} initial={data.ratingsByRound[r.n]} reload={reload} />
        </div>
      </section>
      {data.teesReady ? (
        <section className="stack gap8">
          <h2 className="label">ALLE TEE-ER ({tees.length})</h2>
          <p className="small muted">{isNine(r) ? 'Ni-hullsrunde: par og CR gjelder de ni hullene som spilles. ' : ''}Verdier merket «Kontroller» er estimater eller usikre – rett dem etter Trackman.</p>
          <div className="card list">
            {tees.map((t) => <TeeRow key={`${t.id}-${t.cr_m}-${t.cr_w}-${t.name}`} t={t} roundNo={r.n} nine={isNine(r)} reload={reload} />)}
            {tees.length === 0 && !adding && <p className="muted small pad12">Ingen tee-er lagt inn for denne runden.</p>}
            {adding && <TeeRow t={{ sort: tees.length + 1 }} roundNo={r.n} nine={isNine(r)} reload={reload} onDone={() => setAdding(false)} />}
          </div>
          {!adding && <button className="btn btn-ghost" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Legg til tee</button>}
        </section>
      ) : (
        <div className="card small">Kjør <strong>supabase/tee.sql</strong> i Supabase for å få alle tee-er per runde.</div>
      )}
    </div>
  );
}

// ---------- Fane ----------
export default function ResultsAdmin() {
  const { data, loading, error, reload } = useResults({ admin: true });
  const [sub, setSub] = useState('score');

  if (loading && !data) return <p className="muted">Henter …</p>;
  if (error) {
    return (
      <div className="card stack gap8">
        <strong className="t16">Resultater er ikke satt opp ennå</strong>
        <p className="body-text">Kjør filen supabase/resultater.sql i Supabase (SQL Editor → New query → Run), og last siden på nytt.</p>
      </div>
    );
  }

  return (
    <div className="stack gap14">
      <div className="row gap8 wrap" role="group" aria-label="Resultater">
        {[['score', 'Registrer score'], ['spillere', 'Spillere'], ['kontroll', 'Handicapkontroll'], ['bane', 'Baneverdier']].map(([id, label]) => (
          <button key={id} className={sub === id ? 'chip chip-on' : 'chip'} aria-pressed={sub === id} onClick={() => setSub(id)}>{label}</button>
        ))}
      </div>
      {sub === 'score' && <ScoreEntry data={data} reload={reload} />}
      {sub === 'spillere' && <Players data={data} reload={reload} />}
      {sub === 'kontroll' && <HcpCheck data={data} />}
      {sub === 'bane' && <Ratings data={data} reload={reload} />}
    </div>
  );
}
