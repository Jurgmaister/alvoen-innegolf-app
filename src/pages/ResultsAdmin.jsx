import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { supabase } from '../supabase.js';
import { ROUNDS, currentRound, formatRange } from '../rounds.js';
import { hcpIndexUsed, computeRound } from '../scoring.js';
import { useResults, isNine, fmtIndex, fmtSigned } from '../results.js';

const num = (v) => {
  const s = String(v ?? '').trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

// ---------- Registrer score ----------
function ScoreEntry({ data, reload }) {
  const defaultRound = (currentRound() || ROUNDS[ROUNDS.length - 1]).n;
  const [roundNo, setRoundNo] = useState(defaultRound);
  const round = ROUNDS.find((r) => r.n === roundNo);
  const ratings = data.ratingsByRound[roundNo];
  const nine = isNine(round);

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
    }])));
  }, [roundNo, saved, data.players]);
  useEffect(() => { setMsg(''); }, [roundNo]);

  const live = useMemo(() => {
    const scores = data.players
      .filter((p) => draft[p.id] && String(draft[p.id].gross).trim() !== '')
      .map((p) => ({ player_id: p.id, gross: num(draft[p.id].gross), struck: draft[p.id].struck }));
    return computeRound({ scores, players: data.players, ratings, nineHoles: nine });
  }, [draft, data.players, ratings, nine]);
  const liveById = Object.fromEntries(live.rows.map((r) => [r.player_id, r]));

  const missingRatings = !ratings || [ratings.par_m, ratings.cr_m, ratings.slope_m, ratings.par_w, ratings.cr_w, ratings.slope_w].some((v) => v === null);
  const changed = data.players.filter((p) => {
    const d = draft[p.id]; const s = saved[p.id];
    if (!d) return false;
    const g = String(d.gross).trim();
    if (!s) return g !== '';
    return g === '' || num(g) !== s.gross || d.struck !== s.struck;
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
      else upserts.push({ round_no: roundNo, player_id: p.id, gross: num(g), struck: draft[p.id].struck, updated_at: new Date().toISOString() });
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
            const d = draft[p.id] || { gross: '', struck: false };
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
                  {r && d.struck && <span className="small muted">Strøket – teller ikke</span>}
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

function PlayerForm({ initial, onSave, onCancel, onDelete, isNew }) {
  const [f, setF] = useState({
    ...EMPTY, ...initial,
    golfbox_hcp: initial?.golfbox_hcp ?? '', index_no_golfbox: initial?.index_no_golfbox ?? '',
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

function Players({ data, reload }) {
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
              <PlayerForm initial={p} onSave={(v) => update(p.id, v)} onCancel={() => setEditing(null)} onDelete={() => remove(p)} />
            </div>
          ) : (
            <button key={p.id} className="list-item row between center gap8 plain-btn" onClick={() => setEditing(p.id)}>
              <span className="stack gap2 grow">
                <strong className="t15">{p.name}</strong>
                <span className="small muted">{p.gender === 'D' ? 'Dame' : 'Herre'} · indeks {fmtIndex(p.hcp_index)}{p.trackman_name ? ` · Trackman: ${p.trackman_name}` : ''} · {played(p.id)} runder</span>
              </span>
              <Icon name="chevron" size={18} color="#5B6B75" />
            </button>
          )))}
        </div>
      )}
      {adding
        ? <div className="card"><PlayerForm isNew onSave={add} onCancel={() => setAdding(false)} /></div>
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
        <span className="small strong">Herre <span className="muted">({r.men})</span></span>
        <span className="small strong">Dame <span className="muted">({r.women})</span></span>
        {[0, 1].map((side) => (
          <div key={side} className="grid3">
            {FIELDS.slice(side * 3, side * 3 + 3).map(([k, label]) => (
              <label key={k} className="field small-field">{label}
                <input inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
              </label>
            ))}
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

function Ratings({ data, reload }) {
  return (
    <div className="stack gap14">
      <p className="small muted">Par, baneverdi (CR) og slope for herre- og dametee per runde. Verdiene fra regnearket er lagt inn; runder merket «Mangler» må fylles ut.</p>
      <div className="card list">
        {ROUNDS.map((r) => <RatingRow key={r.n} r={r} initial={data.ratingsByRound[r.n]} reload={reload} />)}
      </div>
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
        {[['score', 'Registrer score'], ['spillere', 'Spillere'], ['bane', 'Baneverdier']].map(([id, label]) => (
          <button key={id} className={sub === id ? 'chip chip-on' : 'chip'} aria-pressed={sub === id} onClick={() => setSub(id)}>{label}</button>
        ))}
      </div>
      {sub === 'score' && <ScoreEntry data={data} reload={reload} />}
      {sub === 'spillere' && <Players data={data} reload={reload} />}
      {sub === 'bane' && <Ratings data={data} reload={reload} />}
    </div>
  );
}
