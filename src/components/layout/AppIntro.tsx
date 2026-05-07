export function AppIntro() {
  return (
    <div className="app-intro" aria-label="Cargando Gestion JD" role="status">
      <div className="app-intro__panel">
        <div className="app-intro__mark">JD</div>
        <div className="app-intro__copy">
          <p className="app-intro__eyebrow">Gestion JD</p>
          <h1>Gestión JD</h1>
          <p>Sistema comercial automotor</p>
        </div>
        <div className="app-intro__bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
