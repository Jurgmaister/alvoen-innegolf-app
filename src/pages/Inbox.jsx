import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { supabase, callPush } from '../supabase.js';
import { useQuery, formatWhen } from '../data.js';
import { contactTopicLabel } from './Contact.jsx';
import { pushSupported, needsInstallForPush, currentSubscription, getOrCreateSubscription } from '../push.js';

const fetchInbox = (sb) => sb.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(200);

export async function countUnhandled() {
  const { count, error } = await supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('handled', false);
  return error ? 0 : count || 0;
}

function replyLinks(contact) {
  const c = (contact || '').trim();
  if (/\S+@\S+\.\S+/.test(c)) {
    const email = c.match(/\S+@\S+\.\S+/)[0];
    return [{ href: `mailto:${email}?subject=${encodeURIComponent('Svar fra Alvøen Innegolf')}`, label: 'Svar på e-post' }];
  }
  const digits = c.replace(/[^\d+]/g, '');
  if (digits.replace('+', '').length >= 8) {
    return [{ href: `sms:${digits}`, label: 'Send SMS' }, { href: `tel:${digits}`, label: 'Ring' }];
  }
  return [];
}

function AlertToggle() {
  const [state, setState] = useState({ loading: true, here: false, total: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const sub = pushSupported() && !needsInstallForPush() ? await currentSubscription() : null;
        const r = await callPush('admin-alerts-status', { endpoint: sub?.endpoint });
        setState({ loading: false, here: r.here && Notification.permission === 'granted', total: r.total });
      } catch (e) {
        setState({ loading: false, here: false, total: 0 });
        setError(/Ukjent handling/.test(e.message) ? 'Push-funksjonen må oppdateres i Supabase (se OPPSETT.md).' : '');
      }
    })();
  }, []);

  if (needsInstallForPush()) {
    return <p className="small muted">Varsel om nye meldinger på iPhone: legg appen på hjemskjermen og åpne admin-siden derfra.</p>;
  }
  if (!pushSupported()) return <p className="small muted">Denne nettleseren støtter ikke varsler.</p>;

  const toggle = async () => {
    setBusy(true); setError('');
    try {
      const sub = await getOrCreateSubscription();
      await callPush('admin-alerts', { subscription: sub.toJSON(), on: !state.here });
      setState((s) => ({ ...s, here: !s.here, total: s.total + (s.here ? -1 : 1) }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card row between center gap12">
      <div className="stack gap2 grow">
        <strong className="t15">Varsle meg om nye meldinger</strong>
        <span className="small muted">{state.loading ? 'Sjekker …' : state.here ? 'På for denne enheten.' : 'Av for denne enheten.'}{state.total ? ` ${state.total} enhet${state.total === 1 ? '' : 'er'} får varsel totalt.` : ''}</span>
        {error && <span className="error small">{error}</span>}
      </div>
      <button className={state.here ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'} disabled={busy || state.loading} onClick={toggle}>
        {busy ? '…' : state.here ? 'Slå av' : 'Slå på'}
      </button>
    </div>
  );
}

export default function Inbox({ onChange }) {
  const { data, loading, error, reload } = useQuery(fetchInbox, []);
  const [showHandled, setShowHandled] = useState(false);

  const setHandled = async (m, handled) => {
    const { data: s } = await supabase.auth.getSession();
    await supabase.from('contact_messages').update({
      handled, handled_at: handled ? new Date().toISOString() : null, handled_by: handled ? s.session?.user?.email : null,
    }).eq('id', m.id);
    await reload(); onChange?.();
  };
  const remove = async (m) => {
    if (!window.confirm(`Slette meldingen fra ${m.name}?`)) return;
    await supabase.from('contact_messages').delete().eq('id', m.id);
    await reload(); onChange?.();
  };

  if (loading && !data) return <p className="muted">Henter …</p>;
  if (error) {
    return <p className="error small">{/contact_messages/.test(String(error)) ? 'Innboksen er ikke satt opp ennå. Kjør supabase/kontakt.sql i Supabase.' : 'Kunne ikke hente meldinger.'}</p>;
  }

  const open = data.filter((m) => !m.handled);
  const done = data.filter((m) => m.handled);
  const list = showHandled ? done : open;

  return (
    <div className="stack gap14">
      <AlertToggle />
      <div className="row gap8 wrap">
        <button className={!showHandled ? 'chip chip-solid' : 'chip'} aria-pressed={!showHandled} onClick={() => setShowHandled(false)}>Nye ({open.length})</button>
        <button className={showHandled ? 'chip chip-solid' : 'chip'} aria-pressed={showHandled} onClick={() => setShowHandled(true)}>Behandlet ({done.length})</button>
      </div>
      {list.length === 0 && <p className="muted small">{showHandled ? 'Ingen behandlede meldinger.' : 'Ingen nye meldinger.'}</p>}
      {list.map((m) => (
        <article key={m.id} className="card stack gap10 inbox-item">
          <div className="row between gap8">
            <div className="stack gap2">
              <strong className="t16">{m.name}</strong>
              <span className="small muted">{contactTopicLabel(m.topic)} · {formatWhen(m.created_at)}</span>
            </div>
            <button className="icon-btn" aria-label={`Slett melding fra ${m.name}`} onClick={() => remove(m)}><Icon name="trash" size={20} /></button>
          </div>
          <p className="body-text pre-wrap">{m.message}</p>
          <span className="small">{m.contact ? <>Kontakt: <strong>{m.contact}</strong></> : <span className="muted">Ingen kontaktinfo oppgitt</span>}</span>
          <div className="row gap8 wrap">
            {replyLinks(m.contact).map((l) => <a key={l.href} className="btn btn-ghost btn-sm" href={l.href}>{l.label}</a>)}
            {m.handled
              ? <button className="btn btn-ghost btn-sm" onClick={() => setHandled(m, false)}>Flytt til nye</button>
              : <button className="btn btn-primary btn-sm" onClick={() => setHandled(m, true)}>Marker som behandlet</button>}
          </div>
          {m.handled && m.handled_by && <span className="small muted">Behandlet av {m.handled_by}{m.handled_at ? ` · ${formatWhen(m.handled_at).toLowerCase()}` : ''}</span>}
        </article>
      ))}
    </div>
  );
}
