export default function Loading() {
  return (
    <div className="layout-container">
      <header className="app-header">
        <h1 className="brand-title">maxycrawljob</h1>
      </header>
      <main id="main-content" tabIndex={-1}>
        <div className="empty-card" role="status" aria-live="polite">
          <p>Memuat lowongan kerja...</p>
        </div>
      </main>
    </div>
  );
}
