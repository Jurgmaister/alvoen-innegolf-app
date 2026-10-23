import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { supabase } from '../supabase.js';
import { useQuery } from '../data.js';

const fetchProducts = (sb) => sb.from('kiosk_products').select('*').order('sort').order('name');

const EMPTY = { name: '', stock: '', min_level: '', target_level: '' };

function toInt(v) {
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function ProductForm({ initial = EMPTY, onSave, onCancel, onDelete, saveLabel }) {
  const [f, setF] = useState({
    name: initial.name ?? '',
    stock: String(initial.stock ?? ''),
    min_level: String(initial.min_level ?? ''),
    target_level: String(initial.target_level ?? ''),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    onSave({
      name: f.name.trim(),
      stock: toInt(f.stock),
      min_level: toInt(f.min_level),
      target_level: Math.max(toInt(f.target_level), toInt(f.min_level)),
    });
  };
  return (
    <form className="stack gap10 kiosk-form" onSubmit={submit}>
      <label className="field">Vare<input required value={f.name} onChange={set('name')} placeholder="f.eks. Sjokolade" /></label>
      <div className="grid3">
        <label className="field">På lager<input inputMode="numeric" value={f.stock} onChange={set('stock')} placeholder="0" /></label>
        <label className="field">Minimum<input inputMode="numeric" value={f.min_level} onChange={set('min_level')} placeholder="0" /></label>
        <label className="field">Fyll opp til<input inputMode="numeric" value={f.target_level} onChange={set('target_level')} placeholder="0" /></label>
      </div>
      <div className="row gap8 wrap">
        <button className="btn btn-primary grow">{saveLabel}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Avbryt</button>}
        {onDelete && (
          <button type="button" className="btn btn-ghost" onClick={onDelete} aria-label="Slett vare">
            <Icon name="trash" size={18} /> Slett
          </button>
        )}
      </div>
    </form>
  );
}

export default function KioskAdmin() {
  const { data, loading, error, reload } = useQuery(fetchProducts, []);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [local, setLocal] = useState({});

  if (loading && !data) return <p className="muted">Henter varer …</p>;
  if (error) {
    return (
      <div className="card stack gap8">
        <strong className="t16">Kiosken er ikke satt opp ennå</strong>
        <p className="body-text">Kjør filen supabase/kiosk.sql i Supabase (SQL Editor → New query → Run), og last siden på nytt.</p>
      </div>
    );
  }

  const products = (data || []).map((p) => (local[p.id] !== undefined ? { ...p, stock: local[p.id] } : p));
  const low = products.filter((p) => p.stock < p.min_level);
  const shopping = low.map((p) => ({ name: p.name, need: Math.max(p.target_level - p.stock, p.min_level - p.stock, 1) }));

  const adjust = async (p, delta) => {
    if (delta < 0 && p.stock === 0) return;
    setBusyId(p.id);
    setLocal((l) => ({ ...l, [p.id]: Math.max(0, p.stock + delta) }));
    const { data: newStock, error: err } = await supabase.rpc('adjust_stock', { product_id: p.id, delta });
    setBusyId(null);
    if (err) { setMsg(`Feil: ${err.message}`); setLocal((l) => { const n = { ...l }; delete n[p.id]; return n; }); return; }
    setLocal((l) => ({ ...l, [p.id]: newStock }));
  };

  const add = async (values) => {
    setMsg('');
    const { error: err } = await supabase.from('kiosk_products').insert({ ...values, sort: products.length });
    if (err) { setMsg(`Feil: ${err.message}`); return; }
    setAdding(false);
    setLocal({});
    reload();
  };

  const update = async (id, values) => {
    setMsg('');
    const { error: err } = await supabase.from('kiosk_products')
      .update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (err) { setMsg(`Feil: ${err.message}`); return; }
    setEditing(null);
    setLocal({});
    reload();
  };

  const remove = async (p) => {
    if (!window.confirm(`Slette «${p.name}» fra varelisten?`)) return;
    await supabase.from('kiosk_products').delete().eq('id', p.id);
    setEditing(null);
    setLocal({});
    reload();
  };

  const shareList = async () => {
    const text = `Handleliste kiosk – Alvøen Innegolf\n\n${shopping.map((s) => `• ${s.name}: ${s.need} stk`).join('\n')}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Handleliste kiosk', text }); return; }
      await navigator.clipboard.writeText(text);
      setMsg('Handlelisten er kopiert. Lim den inn i en melding.');
    } catch { /* avbrutt av brukeren */ }
  };

  return (
    <div className="stack gap20">
      <div className={low.length ? 'kiosk-alert kiosk-alert-low' : 'kiosk-alert'}>
        <strong className="t15">
          {products.length === 0
            ? 'Ingen varer lagt inn ennå'
            : low.length
              ? `${low.length} ${low.length === 1 ? 'vare' : 'varer'} under minimum`
              : 'Alle varer er over minimum'}
        </strong>
      </div>

      {products.length > 0 && (
        <section className="card list">
          {products.map((p) => {
            const isLow = p.stock < p.min_level;
            const max = Math.max(p.target_level, p.min_level, p.stock, 1);
            const pct = Math.min(100, Math.round((p.stock / max) * 100));
            if (editing === p.id) {
              return (
                <div key={p.id} className="list-item">
                  <ProductForm initial={p} saveLabel="Lagre" onSave={(v) => update(p.id, v)}
                    onCancel={() => setEditing(null)} onDelete={() => remove(p)} />
                </div>
              );
            }
            return (
              <div key={p.id} className="list-item row center gap12">
                <button className="kiosk-name grow" onClick={() => setEditing(p.id)} aria-label={`Endre ${p.name}`}>
                  <span className="row between gap8">
                    <strong className="t15">{p.name}</strong>
                    <span className={isLow ? 't14 strong error' : 't14 strong'}>{p.stock} stk</span>
                  </span>
                  <span className="bar"><span className={isLow ? 'bar-fill bar-low' : 'bar-fill'} style={{ width: `${pct}%` }} /></span>
                  <span className="small muted">Min {p.min_level} · fyll opp til {p.target_level}</span>
                </button>
                <div className="row gap6">
                  <button className="step-btn" aria-label={`Én mindre ${p.name}`} disabled={busyId === p.id || p.stock === 0}
                    onClick={() => adjust(p, -1)}>−</button>
                  <button className="step-btn step-plus" aria-label={`Én mer ${p.name}`} disabled={busyId === p.id}
                    onClick={() => adjust(p, 1)}>+</button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {adding
        ? <div className="card"><ProductForm saveLabel="Legg til vare" onSave={add} onCancel={() => setAdding(false)} /></div>
        : <button className="btn btn-ghost" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> Legg til vare</button>}

      {products.length > 0 && (
        <section className="stack gap10">
          <h2 className="label">HANDLELISTE</h2>
          <div className="card stack gap8">
            {shopping.length === 0 && <p className="t15 muted">Alt er over minimum.</p>}
            {shopping.map((s) => (
              <div key={s.name} className="row between t15"><span>{s.name}</span><strong>{s.need} stk</strong></div>
            ))}
          </div>
          {shopping.length > 0 && <button className="btn btn-accent btn-lg" onClick={shareList}>Del handleliste</button>}
        </section>
      )}

      <p className="small muted">Trykk på en vare for å endre navn, antall eller grenser. Bruk − når noe er solgt eller tatt ut, og + ved påfylling.</p>
      {msg && <p className={msg.startsWith('Feil') ? 'error small' : 'success small'}>{msg}</p>}
    </div>
  );
}
