import { useEffect, useState } from 'react';
import { isConfigured } from './config.js';
import Home from './pages/Home.jsx';
import Messages from './pages/Messages.jsx';
import Tournament from './pages/Tournament.jsx';
import InfoPage from './pages/InfoPage.jsx';
import Admin from './pages/Admin.jsx';
import TabBar from './components/TabBar.jsx';

function parseRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  // Innloggingslenker fra e-posten kommer til /?admin med innloggingen i #-delen; de går til admin.
  if (new URLSearchParams(window.location.search).has('admin')
    || hash.startsWith('access_token') || hash.startsWith('error')) return ['admin'];
  return hash.split('?')[0].split('/').filter(Boolean);
}

export default function App() {
  const [route, setRoute] = useState(parseRoute);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (!isConfigured) {
    return (
      <main className="page">
        <h1 className="h1">Alvøen Innegolf</h1>
        <p className="muted">Appen er ikke koblet til databasen ennå. Fyll inn .env-filen (se OPPSETT.md) og bygg på nytt.</p>
      </main>
    );
  }

  const [section, param] = route;
  const isAdmin = section === 'admin';

  let page;
  if (section === 'meldinger') page = <Messages />;
  else if (section === 'turnering') page = <Tournament />;
  else if (section === 'info' && param) page = <InfoPage slug={param} />;
  else if (isAdmin) page = <Admin />;
  else page = <Home />;

  return (
    <div className="app">
      <div className="app-content">{page}</div>
      {!isAdmin && <TabBar active={section || 'hjem'} />}
    </div>
  );
}
