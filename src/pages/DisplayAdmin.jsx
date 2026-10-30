import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { supabase } from '../supabase.js';
import { BUILTIN_SLIDES, CustomSlide, SlidePreview, slideIsLive } from './Display.jsx';

const ALL_BUILTIN = BUILTIN_SLIDES.map((b) => b.id);
const EMPTY = { kind: 'tekst', kicker: '', title: '', body: '', image_url: null, qr_url: '', qr_label: '', theme: 'lys', seconds: '', active: true, show_from: '', show_to: '' };
const THEMES = [['lys', 'Lys'], ['mork', 'Mørk blå'], ['gronn', 'Grønn']];

// Skalerer bildet ned til maks 1920 px og lagrer som JPEG før opplasting.
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Bruk et bilde i JPG-, PNG- eller WebP-format.');
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  if (k === 1 && file.size < 2_500_000) return { blob: file, ext: file.type.split('/')[1].replace('jpeg', 'jpg'), type: file.type };
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.86));
  return { blob, ext: 'jpg', type: 'image/jpeg' };
}

function SlideForm({ initial, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({ ...EMPTY, ...initial, seconds: initial?.seconds ?? '', show_from: initial?.show_from ?? '', show_to: initial?.show_to ?? '', qr_url: initial?.qr_url ?? '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setErr('');
    try {
      const { blob, ext, type } = await shrink(file);
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('skjerm').upload(path, blob, { contentType: type, upsert: false });
      if (error) throw new Error(/bucket/i.test(error.message) ? 'Bildelageret er ikke satt opp. Kjør supabase/skjerm.sql.' : error.message);
      setF((x) => ({ ...x, image_url: supabase.storage.from('skjerm').getPublicUrl(path).data.publicUrl }));
    } catch (er) { setErr(er.message); } finally { setBusy(false); e.target.value = ''; }
  };

  const submit = (e) => {
    e.preventDefault();
    if (f.kind === 'bilde' && !f.image_url) { setErr('Last opp et bilde.'); return; }
    if (f.kind === 'tekst' && !f.title.trim()) { setErr('Skriv en overskrift.'); return; }
    if (f.qr_url && !/^https?:\/\//.test(f.qr_url.trim())) { setErr('QR-lenken må starte med https://'); return; }
    onSave({
      kind: f.kind, kicker: f.kicker.trim(), title: f.title.trim(), body: f.body.trim(), image_url: f.image_url || null,
      qr_url: f.qr_url.trim() || null, qr_label: f.qr_label.trim(), theme: f.theme,
      seconds: f.seconds === '' ? null : Math.max(5, Math.min(120, Number(f.seconds) || 20)),
      active: f.active, show_from: f.show_from || null, show_to: f.show_to || null,
    });
  };

  const preview = { ...f, qr_url: /^https?:\/\//.test(f.qr_url) ? f.qr_url : null };

  return (
    <form className="stack gap12 kiosk-form" onSubmit={submit}>
      <div className="row gap8 wrap" role="group" aria-label="Type">
        {[['tekst', 'Tekst'], ['bilde', 'Bilde i fullskjerm']].map(([v, l]) => (
          <button type="button" key={v} className={f.kind === v ? 'chip chip-solid' : 'chip'} aria-pressed={f.kind === v} onClick={() => setF({ ...f, kind: v })}>{l}</button>
        ))}
      </div>

      {f.kind === 'tekst' && (
        <>
          <label className="field">Liten overskrift (valgfri)<input maxLength={60} value={f.kicker} onChange={set('kicker')} placeholder="f.eks. LØRDAG 31. OKTOBER" /></label>
          <label className="field">Overskrift<input maxLength={120} value={f.title} onChange={set('title')} placeholder="f.eks. Halloween-turnering" /></label>
          <label className="field">Tekst<textarea rows={4} maxLength={800} value={f.body} onChange={set('body')} /></label>
          <div className="stack gap6">
            <span className="field-label">Farge</span>
            <div className="row gap8 wrap">
              {THEMES.map(([v, l]) => <button type="button" key={v} className={f.theme === v ? 'chip chip-solid' : 'chip'} aria-pressed={f.theme === v} onClick={() => setF({ ...f, theme: v })}>{l}</button>)}
            </div>
          </div>
        </>
      )}

      <div className="stack gap6">
        <span className="field-label">{f.kind === 'bilde' ? 'Bilde (liggende 16:9 passer best, f.eks. 1920×1080 fra Canva)' : 'Bilde (valgfritt)'}</span>
        <div className="row gap8 wrap center">
          <label className="btn btn-ghost btn-sm">{busy ? 'Laster opp …' : f.image_url ? 'Bytt bilde' : 'Velg bilde'}
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} hidden disabled={busy} />
          </label>
          {f.image_url && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, image_url: null })}>Fjern bilde</button>}
        </div>
      </div>

      {f.kind === 'tekst' && (
        <div className="grid2">
          <label className="field">QR-kode til lenke (valgfri)<input inputMode="url" value={f.qr_url} onChange={set('qr_url')} placeholder="https://…" /></label>
          <label className="field">Tekst under QR-koden<input maxLength={60} value={f.qr_label} onChange={set('qr_label')} placeholder="f.eks. Meld deg på" /></label>
        </div>
      )}

      <div className="grid2">
        <label className="field">Vis fra (valgfri)<input type="date" value={f.show_from} onChange={set('show_from')} /></label>
        <label className="field">Vis til og med (valgfri)<input type="date" value={f.show_to} onChange={set('show_to')} /></label>
      </div>
      <label className="field small-field">Sekunder på skjermen (tomt = standard)<input inputMode="numeric" value={f.seconds} onChange={(e) => setF({ ...f, seconds: e.target.value.replace(/\D/g, '') })} /></label>
      <label className="tiny-check big-check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Vises på skjermen</label>

      <div className="stack gap6">
        <span className="field-label">Forhåndsvisning</span>
        <SlidePreview><CustomSlide c={preview} /></SlidePreview>
      </div>

      {err && <p className="error small">{err}</p>}
      <div className="row gap8 wrap">
        <button className="btn btn-primary grow" disabled={busy}>Lagre</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Avbryt</button>
        {onDelete && <button type="button" className="btn btn-ghost" onClick={onDelete}><Icon name="trash" size={18} /> Slett</button>}
      </div>
    </form>
  );
}

export default function DisplayAdmin() {
  const [settings, setSettings] = useState(null);
  const [slides, setSlides] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // id | 'ny' | null
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [s, c] = await Promise.all([
      supabase.from('display_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('display_slides').select('*').order('created_at'),
    ]);
    if (s.error || c.error) { setError('setup'); return; }
    setSettings(s.data || { seconds: 20, slide_order: ALL_BUILTIN, hidden: [] });
    setSlides(c.data || []);
  };
  useEffect(() => { load(); }, []);

  const order = useMemo(() => {
    if (!settings) return [];
    const o = (settings.slide_order || []).filter((k) => ALL_BUILTIN.includes(k) || slides.some((x) => `custom:${x.id}` === k));
    for (const b of ALL_BUILTIN) if (!o.includes(b)) o.push(b);
    for (const x of slides) if (!o.includes(`custom:${x.id}`)) o.push(`custom:${x.id}`);
    return o;
  }, [settings, slides]);

  const saveSettings = async (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next); setMsg('');
    const { error: err } = await supabase.from('display_settings').update({ seconds: next.seconds, slide_order: next.slide_order, hidden: next.hidden, updated_at: new Date().toISOString() }).eq('id', 1);
    if (err) setMsg(`Feil: ${err.message}`);
  };
  const move = (k, dir) => {
    const o = [...order]; const i = o.indexOf(k); const j = i + dir;
    if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    saveSettings({ slide_order: o });
  };
  const toggleBuiltin = (k) => {
    const hidden = new Set(settings.hidden || []);
    if (hidden.has(k)) hidden.delete(k); else hidden.add(k);
    saveSettings({ hidden: [...hidden], slide_order: order });
  };

  const saveSlide = async (values) => {
    setMsg('');
    if (editing === 'ny') {
      const { data, error: err } = await supabase.from('display_slides').insert(values).select('id').single();
      if (err) { setMsg(`Feil: ${err.message}`); return; }
      await saveSettings({ slide_order: [`custom:${data.id}`, ...order] }); // nye visninger først
    } else {
      const { error: err } = await supabase.from('display_slides').update(values).eq('id', editing);
      if (err) { setMsg(`Feil: ${err.message}`); return; }
    }
    setEditing(null); setMsg('Lagret. Skjermen i lokalet oppdateres innen 2 minutter.'); load();
  };
  const removeSlide = async (x) => {
    if (!window.confirm(`Slette «${x.title || 'bildevisningen'}»?`)) return;
    await supabase.from('display_slides').delete().eq('id', x.id);
    if (x.image_url?.includes('/skjerm/')) await supabase.storage.from('skjerm').remove([x.image_url.split('/skjerm/').pop()]);
    await saveSettings({ slide_order: order.filter((k) => k !== `custom:${x.id}`) });
    setEditing(null); load();
  };
  const toggleCustom = async (x) => {
    await supabase.from('display_slides').update({ active: !x.active }).eq('id', x.id); load();
  };

  if (error === 'setup') {
    return (
      <div className="card stack gap8">
        <strong className="t16">Skjermstyring er ikke satt opp ennå</strong>
        <p className="body-text">Kjør filen supabase/skjerm.sql i Supabase (SQL Editor → New query → Run), og last siden på nytt. Skjermen virker fortsatt med standardvisningene.</p>
      </div>
    );
  }
  if (!settings) return <p className="muted">Henter …</p>;

  const hidden = new Set(settings.hidden || []);
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Oslo' });
  const status = (x) => {
    if (!x.active) return ['Av', 'tag-none'];
    if (x.show_from && x.show_from > today) return [`Fra ${x.show_from.split('-').reverse().join('.')}`, 'tag-warn'];
    if (x.show_to && x.show_to < today) return ['Utløpt', 'tag-none'];
    return [x.show_to ? `Vises t.o.m. ${x.show_to.split('-').reverse().join('.')}` : 'Vises', 'tag-turnering'];
  };

  return (
    <div className="stack gap20">
      <div className="card stack gap8">
        <div className="row between center gap8 wrap">
          <strong className="t16">Skjermen i lokalet</strong>
          <a className="btn btn-ghost btn-sm" href="#/skjerm" target="_blank" rel="noopener">Åpne skjermen</a>
        </div>
        <span className="small muted">Adresse til TV-en: <strong className="selectable">app.alvoeninnegolf.no/#/skjerm</strong>. Endringer her vises på skjermen innen 2 minutter.</span>
        <label className="field small-field">Sekunder per visning
          <select className="select" value={settings.seconds} onChange={(e) => saveSettings({ seconds: Number(e.target.value), slide_order: order })}>
            {[10, 15, 20, 25, 30, 45, 60].map((n) => <option key={n} value={n}>{n} sekunder</option>)}
          </select>
        </label>
      </div>

      {editing === 'ny' ? (
        <div className="card"><SlideForm onSave={saveSlide} onCancel={() => setEditing(null)} /></div>
      ) : (
        <button className="btn btn-accent" onClick={() => { setEditing('ny'); setMsg(''); }}><Icon name="plus" size={18} /> Ny visning</button>
      )}
      {msg && <p className={msg.startsWith('Feil') ? 'error small' : 'success small'}>{msg}</p>}

      <section className="stack gap10">
        <h2 className="label">REKKEFØLGE PÅ SKJERMEN</h2>
        <div className="card list">
          {order.map((k, i) => {
            const b = BUILTIN_SLIDES.find((x) => x.id === k);
            const x = b ? null : slides.find((s) => `custom:${s.id}` === k);
            if (!b && !x) return null;
            if (x && editing === x.id) {
              return <div key={k} className="list-item"><SlideForm initial={x} onSave={saveSlide} onCancel={() => setEditing(null)} onDelete={() => removeSlide(x)} /></div>;
            }
            const on = b ? !hidden.has(k) : slideIsLive(x);
            const [st, cls] = b ? (hidden.has(k) ? ['Av', 'tag-none'] : ['På', 'tag-turnering']) : status(x);
            return (
              <div key={k} className={on ? 'list-item row between center gap8' : 'list-item row between center gap8 dimmed'}>
                <div className="stack gap4 grow" style={{ minWidth: 0 }}>
                  <strong className="t15">{b ? b.label : (x.title || (x.kind === 'bilde' ? 'Bilde' : 'Uten tittel'))}</strong>
                  <span className="row gap6 wrap center">
                    <span className={`tag ${cls}`}>{st}</span>
                    <span className="small muted">{b ? 'Automatisk fra appen' : x.kind === 'bilde' ? 'Eget bilde' : 'Egen tekst'}{x?.seconds ? ` · ${x.seconds} s` : ''}</span>
                  </span>
                  {b?.hint && <span className="small muted">{b.hint}</span>}
                </div>
                <div className="row gap4 center">
                  <button className="icon-btn" aria-label="Flytt opp" disabled={i === 0} onClick={() => move(k, -1)}>▲</button>
                  <button className="icon-btn" aria-label="Flytt ned" disabled={i === order.length - 1} onClick={() => move(k, 1)}>▼</button>
                  {b
                    ? <button className="btn btn-ghost btn-sm" onClick={() => toggleBuiltin(k)}>{hidden.has(k) ? 'Slå på' : 'Slå av'}</button>
                    : (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleCustom(x)}>{x.active ? 'Slå av' : 'Slå på'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(x.id); setMsg(''); }}>Endre</button>
                      </>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <p className="small muted">Tips: lag plakater og bilder i Canva i formatet 1920×1080 (16:9) og last dem opp som «Bilde i fullskjerm».</p>
    </div>
  );
}
