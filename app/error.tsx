"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="layout-container">
      <header className="app-header">
        <h1 className="brand-title">maxycrawljob</h1>
      </header>
      <main id="main-content">
        <div className="empty-card" role="alert">
          <div className="empty-icon-wrap" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2>Gagal memuat lowongan</h2>
          <p>
            Koneksi ke database sedang mengalami gangguan. Silakan coba muat ulang halaman.
          </p>
          <button type="button" onClick={reset} className="empty-action-btn">
            Muat Ulang
          </button>
        </div>
      </main>
    </div>
  );
}
