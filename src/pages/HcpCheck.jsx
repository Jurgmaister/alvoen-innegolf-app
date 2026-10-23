// Handicapkontroll: sjekker at riktig handicap er brukt på scorekortet i Trackman, og fører logg.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase.js';
import { ROUNDS, currentRound } from '../rounds.js';
import { playingHandicap, ratingFor, xround } from '../scoring.js';
import { isNine } from '../results.js';

// Golf-format: plusshandicap lagres negativt og vises med «+».
export const fmtHcp = (v, decimals = 1) => {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '–';
  const n = Number(v);
  const s = Math.abs(n).toLocaleString('nb-NO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return n < 0 ? `+${s}` : s;
};

function parseHcp(str) {
  let s = String(str ?? '').trim().replace(',', '.').replace(/\s/g, '');
  if (!s) return null;
  let plus = false;
  if (s.startsWith('+')) { plus = true; s = s.slice(1); }
  if (!/^\d{1,2}(\.\d)?$/.test(s)) return NaN;
  const v = parseFloat(s);
  if (v > 54) return NaN;
  return plus ? -v : v;
}
const num = (v) => { const s = String(v ?? '').trim().replace(',', '.'); return s === '' ? null : Number(s); };
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? d.split('-').reverse().join('.') : '–');

export function useChecks() {
  const [checks, setChecks] = useState([]);
  const [error, setError] = useState(null);
  const load = async () => {
    const { data, error: err } = await supabase.from('hcp_checks').select('*').order('created_at', { ascending: false });
    if (err) setError(err.message); else { setError(null); setChecks(data || []); }
  };
  useEffect(() => { load(); }, []);
  return { checks, error, reload: load };
}

export default function HcpCheck({ data }) {
  const { checks, error, reload } = useChecks();
  const [playerId, setPlayerId] = useState('');
  const [roundNo, setRoundNo] = useState((currentRound() || ROUNDS[ROUNDS.length - 1]).n);
  const [course, setCourse] = useState({ slope: '', cr: '', par: '', nine: false, name: '' });
  const [mode, setMode] = useState('spill');
  const [entered, setEntered] = useState('');
  const [date, setDate] = useState(today());
  const [onlyBad, setOnlyBad] = useState(false);
  const [msg, setMsg] = useState('');

  const players = useMemo(() => [...data.players].sort((a, b) => a.name.localeCompare(b.name, 'nb')), [data.players]);
  const p = players.find((x) => String(x.id) === String(playerId));
  const round = ROUNDS.find((r) => r.n === roundNo);

  // Fyll inn baneverdier fra runden og spillerens kjønn (kan overstyres).
  useEffect(() => {
    if (!round) { setCourse({ slope: '', cr: '', par: '', nine: false, name: '' }); return; }
    const rt = ratingFor(data.ratingsByRound[round.n], p?.gender || 'H');
    setCourse({
      slope: rt?.slope ?? '', cr: rt?.cr ?? '', par: rt?.par ?? '', nine: isNine(round),
      name: `${round.course} – ${p?.gender === 'D' ? round.women : round.men}`,
    });
  }, [roundNo, p?.gender, data.ratingsByRound]); // eslint-disable-line react-hooks/exhaustive-deps

  const co = { slope: num(course.slope), cr: num(course.cr), par: num(course.par) };
  const coOk = Number.isInteger(co.slope) && co.slope >= 55 && co.slope <= 155 && Number.isFinite(co.cr) && co.cr > 15 && co.cr < 90 && Number.isInteger(co.par) && co.par >= 27 && co.par <= 80;
  const index = p ? Number(p.hcp_index) : null;
  const spill = p && coOk ? playingHandicap(index, co, course.nine) : null;
  const exact = p && coOk ? (course.nine ? index / 2 : index) * co.slope / 113 + (co.cr - co.par) : null;
  let ent = parseHcp(entered);
  if (mode === 'spill' && Number.isFinite(ent) && !Number.isInteger(ent)) ent = NaN;
  const correct = mode === 'spill' ? spill : index;
  const match = correct === null || ent === null || Number.isNaN(ent) ? null
    : mode === 'spill' ? ent === correct : xround(ent * 10) === xround(correct * 10);

  const log = async () => {
    setMsg('');
    const { error: err } = await supabase.from('hcp_checks').insert({
      checked_on: date || today(), player_id: p.id, round_no: roundNo || null, course: course.name.trim(),
      mode, entered: ent, correct, hcp_index: index, slope: coOk ? co.slope : null, cr: coOk ? co.cr : null, par: coOk ? co.par : null, ok: match,
    });
    if (err) { setMsg(`Feil: ${err.message}`); return; }
    setMsg(match ? 'Kontroll logget – riktig.' : 'Avvik logget.');
    setEntered('');
    reload();
  };
  const remove = async (k) => {
    if (!window.confirm('Fjerne denne kontrollen fra loggen?')) return;
    await supabase.from('hcp_checks').delete().eq('id', k.id);
    reload();
  };

  if (error) {
    return (
      <div className="card stack gap8">
        <strong className="t16">Handicapkontroll er ikke satt opp ennå</strong>
        <p className="body-text">Kjør filen supabase/handicapkontroll.sql i Supabase (SQL Editor → New query → Run), og last siden på nytt.</p>
      </div>
    );
  }

  const nameById = Object.fromEntries(data.players.map((x) => [x.id, x.name]));
  const shown = checks.filter((k) => !onlyBad || !k.ok);
  const diff = match === false ? (mode === 'spill' ? ent - correct : xround(ent - correct, 1)) : 0;

  return (
    <div className="stack gap20">
      <div className="rules-row">
        <span className="rule-chip">Turnerings-hcp = <b>50 %</b> av Golfbox</span>
        <span className="rule-chip">Låst ved <b>påmelding</b></span>
        <span className="rule-chip">Legges inn som <b>manuelt handicap</b> i Trackman</span>
      </div>

      <section className="card stack gap12">
        <strong className="t16">Kontroller en runde</strong>
        <label className="field">Spiller
          <select className="select" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Velg spiller …</option>
            {players.map((x) => <option key={x.id} value={x.id}>{x.name} ({fmtHcp(x.hcp_index)})</option>)}
          </select>
        </label>
        <label className="field">Runde
          <select className="select" value={roundNo} onChange={(e) => setRoundNo(Number(e.target.value))}>
            {ROUNDS.map((r) => <option key={r.n} value={r.n}>R{r.n} · {r.course}</option>)}
            <option value={0}>Annen bane (fyll inn selv)</option>
          </select>
        </label>
        <fieldset className="course-box">
          <legend>Banen som er spilt i Trackman</legend>
          {roundNo === 0 && <label className="field small-field">Bane<input value={course.name} onChange={(e) => setCourse({ ...course, name: e.target.value })} placeholder="f.eks. Pebble Beach, gul tee" /></label>}
          {roundNo !== 0 && <span className="small muted">{course.name}{course.nine ? ' · 9 hull' : ' · 18 hull'} · fylt inn fra Baneverdier, kan overstyres</span>}
          <div className="grid3">
            <label className="field small-field">Slope<input inputMode="numeric" value={course.slope} onChange={(e) => setCourse({ ...course, slope: e.target.value })} /></label>
            <label className="field small-field">CR<input inputMode="decimal" value={course.cr} onChange={(e) => setCourse({ ...course, cr: e.target.value })} /></label>
            <label className="field small-field">Par<input inputMode="numeric" value={course.par} onChange={(e) => setCourse({ ...course, par: e.target.value })} /></label>
          </div>
          {roundNo === 0 && (
            <label className="tiny-check"><input type="checkbox" checked={course.nine} onChange={(e) => setCourse({ ...course, nine: e.target.checked })} /> 9 hull (bruk 9-hullsverdier)</label>
          )}
        </fieldset>
        <label className="field">Scorekortet viser
          <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="spill">Spillehandicap (helt tall, beregnet med slope og CR)</option>
            <option value="indeks">Handicapindeks (det manuelle tallet, med desimal)</option>
          </select>
        </label>
        <div className="grid2">
          <label className="field">{mode === 'spill' ? 'Spillehandicap i Trackman' : 'Indeks i Trackman'}
            <input inputMode="decimal" value={entered} onChange={(e) => setEntered(e.target.value)} placeholder={mode === 'spill' ? 'f.eks. 11' : 'f.eks. 9,2'} />
          </label>
          <label className="field">Dato<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        </div>

        <div className={`check-result ${match === true ? 'ok' : match === false ? 'bad' : ''}`} aria-live="polite">
          {!p && <span className="muted">Velg spiller og skriv inn handicapet som står på scorekortet. Svaret vises her.</span>}
          {p && (
            <>
              <span className="small muted">Riktig {mode === 'spill' ? 'spillehandicap' : 'handicapindeks'} for {p.name}</span>
              <span className="big-num">{mode === 'spill' ? (spill === null ? '–' : fmtHcp(spill, 0)) : fmtHcp(index)}</span>
              <span className="small muted">Turnerings-hcp {fmtHcp(index)}{p.golfbox_hcp !== null && p.golfbox_hcp !== undefined ? ` (50 % av ${fmtHcp(p.golfbox_hcp)})` : ''}</span>
              {mode === 'spill' && coOk && (
                <span className="formula">{course.nine ? `(${fmtHcp(index)} / 2)` : fmtHcp(index)} × {co.slope}/113 + ({fmtHcp(co.cr)} − {co.par}) = {exact.toFixed(2).replace('.', ',')} → {fmtHcp(spill, 0)}</span>
              )}
              {mode === 'spill' && !coOk && <span className="small error">Fyll inn slope, CR og par for å regne ut spillehandicapet.</span>}
              {entered.trim() && Number.isNaN(ent) && <strong className="error">Ugyldig tall – {mode === 'spill' ? 'spillehandicap er et helt tall, f.eks. 11 eller +1' : 'skriv f.eks. 9,2 eller +0,7'}.</strong>}
              {match === true && <strong className="verdict-ok">✓ Riktig</strong>}
              {match === false && (
                <>
                  <strong className="verdict-bad">✗ Feil handicap</strong>
                  <span className="t14">Brukt {fmtHcp(ent, mode === 'spill' ? 0 : 1)}, skulle vært {fmtHcp(correct, mode === 'spill' ? 0 : 1)}. Spilleren har fått <b>{fmtHcp(Math.abs(diff), mode === 'spill' ? 0 : 1)} slag {diff > 0 ? 'for mye' : 'for lite'}</b>.</span>
                </>
              )}
              {!p.golfbox_verified && <span className="tag tag-warn">Golfbox-handicap ikke bekreftet</span>}
            </>
          )}
        </div>
        <button className="btn btn-primary" disabled={match === null} onClick={log}>Logg kontroll</button>
        {msg && <p className={msg.startsWith('Feil') ? 'error small' : 'success small'}>{msg}</p>}
      </section>

      <section className="stack gap10">
        <div className="row between center">
          <h2 className="label">KONTROLLOGG</h2>
          <label className="tiny-check"><input type="checkbox" checked={onlyBad} onChange={(e) => setOnlyBad(e.target.checked)} /> Vis bare avvik</label>
        </div>
        <div className="card list">
          {shown.length === 0 && <p className="muted small pad12">{checks.length && onlyBad ? 'Ingen avvik registrert.' : 'Ingen kontroller logget ennå.'}</p>}
          {shown.map((k) => {
            const spillMode = k.mode === 'spill';
            const f = (v) => fmtHcp(v, spillMode ? 0 : 1);
            return (
              <div key={k.id} className="list-item row between center gap8">
                <div className="stack gap2 grow">
                  <span className="row gap8 center"><strong className="t15">{nameById[k.player_id] || '?'}</strong>{k.ok ? <span className="tag tag-turnering">Riktig</span> : <span className="tag tag-bad">Avvik</span>}</span>
                  <span className="small muted">{fmtDate(k.checked_on)}{k.round_no ? ` · R${k.round_no}` : ''}{k.course ? ` · ${k.course}` : ''}</span>
                  <span className="small">Brukt {f(k.entered)} · riktig {f(k.correct)} <span className="muted">({spillMode ? 'spillehandicap' : 'indeks'}{k.slope ? ` · slope ${k.slope} · CR ${fmtHcp(k.cr)} · par ${k.par}` : ''})</span></span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(k)}>Fjern</button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
