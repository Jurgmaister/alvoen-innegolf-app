import Icon from '../components/Icon.jsx';
import Topbar from '../components/Topbar.jsx';
import { useQuery } from '../data.js';

export default function InfoPage({ slug }) {
  const { data, loading, error } = useQuery(
    (sb) => sb.from('info_pages').select('*').eq('slug', slug).maybeSingle(),
    [slug],
  );

  return (
    <main className="page">
      <Topbar />
      <a href="#/" className="back-link"><Icon name="back" size={20} strokeWidth={2} /> Tilbake</a>
      {loading && <p className="muted">Henter …</p>}
      {error && <p className="error">Kunne ikke hente siden.</p>}
      {!loading && !error && !data && <p className="muted">Siden finnes ikke.</p>}
      {data && (
        <>
          <h1 className="h1">{data.title}</h1>
          <p className="card body-text">{data.body}</p>
        </>
      )}
    </main>
  );
}
