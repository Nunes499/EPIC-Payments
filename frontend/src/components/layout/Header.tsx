export default function Header() {
  return (
    <header className="topbar">
      <div className="topbar-heading">
        <span className="page-kicker">EPIC Payments</span>

        <h1 className="topbar-title">Calendário</h1>

        <p className="topbar-subtitle">
          Gestão diária dos ficheiros bancários e relatórios.
        </p>
      </div>

      <div className="topbar-user">
        <div className="user-avatar" aria-hidden="true">
          A
        </div>

        <div className="user-info">
          <strong>Administrador</strong>
          <span>admin</span>
        </div>

        <button type="button" className="logout-button">
          Terminar sessão
        </button>
      </div>
    </header>
  );
}