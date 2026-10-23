// Toppfelt med Alvøen innegolf-logoen øverst til venstre (primærlogo, profilmanual 2024).
export default function Topbar({ children }) {
  return (
    <header className="topbar">
      <a href="#/" className="topbar-logo" aria-label="Alvøen innegolf – til forsiden">
        <img src="/logo.png" alt="Alvøen innegolf" width="126" height="46" />
      </a>
      {children}
    </header>
  );
}
