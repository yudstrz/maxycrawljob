"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <h1>maxycrawljob</h1>
      <p className="empty" role="alert">Gagal membaca database lowongan. Periksa TURSO_DATABASE_URL dan TURSO_AUTH_TOKEN, lalu coba lagi.</p>
      <button onClick={reset}>Muat ulang</button>
    </main>
  );
}
