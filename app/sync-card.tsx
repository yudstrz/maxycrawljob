"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triggerCrawl } from "./actions";

const fmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Baru saja";
  if (diffMin < 60) return `${diffMin} menit yang lalu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} jam yang lalu`;
  return fmt.format(new Date(isoString));
}

interface SyncCardProps {
  lastCrawlAt: string | null;
}

export function SyncCard({ lastCrawlAt: initialLastCrawlAt }: SyncCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [lastCrawl, setLastCrawl] = useState<string | null>(initialLastCrawlAt);
  const [relativeTime, setRelativeTime] = useState<string>(
    initialLastCrawlAt ? formatRelativeTime(initialLastCrawlAt) : "Belum pernah disinkronkan"
  );

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>("");
  const [totalSources, setTotalSources] = useState<number>(18);
  const [completedSources, setCompletedSources] = useState<number>(0);
  const [liveJobsCount, setLiveJobsCount] = useState<number>(0);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const dismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep relative time fresh every 30 seconds
  useEffect(() => {
    if (!lastCrawl) return;
    const interval = setInterval(() => {
      setRelativeTime(formatRelativeTime(lastCrawl));
    }, 30000);
    return () => clearInterval(interval);
  }, [lastCrawl]);

  // Sync state if server prop changes
  useEffect(() => {
    if (initialLastCrawlAt && !isSyncing) {
      setLastCrawl(initialLastCrawlAt);
      setRelativeTime(formatRelativeTime(initialLastCrawlAt));
    }
  }, [initialLastCrawlAt, isSyncing]);

  // Cleanup dismiss timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const handleStartSync = async () => {
    if (isSyncing) return;

    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    setIsSyncing(true);
    setProgress(0);
    setCompletedSources(0);
    setLiveJobsCount(0);
    setStatusText("Menghubungi portal lowongan...");
    setErrorNotice(null);
    setSuccessNotice(null);

    let streamSucceeded = false;

    try {
      const response = await fetch("/api/crawl/stream", {
        method: "POST",
      });

      if (!response.ok || !response.body) {
        throw new Error(`Koneksi stream gagal (status ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          const trimmed = block.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));

            if (data.phase === "start") {
              streamSucceeded = true;
              setStatusText(data.message || "Menghubungi portal lowongan...");
            } else if (data.phase === "progress") {
              streamSucceeded = true;
              setProgress(data.percent ?? 0);
              if (data.completed !== undefined) setCompletedSources(data.completed);
              if (data.total !== undefined) setTotalSources(data.total);
              if (data.source) {
                setStatusText(`Mengecek ${data.source}...`);
              }
              if (typeof data.totalJobs === "number") {
                setLiveJobsCount(data.totalJobs);
              }
            } else if (data.phase === "done") {
              streamSucceeded = true;
              setProgress(100);
              setCompletedSources(data.total || 18);
              setStatusText("Sinkronisasi selesai");

              const count = data.totalJobs ?? 0;
              setLiveJobsCount(count);

              const finishTime = data.timestamp || new Date().toISOString();
              setLastCrawl(finishTime);
              setRelativeTime("Baru saja");

              setSuccessNotice(`Selesai! ${count} lowongan berhasil diperbarui.`);

              // Seamlessly revalidate page data
              startTransition(() => {
                router.refresh();
              });

              // Auto dismiss progress and success state after 4s
              dismissTimerRef.current = setTimeout(() => {
                setSuccessNotice(null);
                setProgress(0);
                setStatusText("");
              }, 4000);
            } else if (data.phase === "error") {
              throw new Error(data.error || "Terjadi kesalahan saat menyinkronkan data.");
            }
          } catch (jsonErr: unknown) {
            if (jsonErr instanceof Error && jsonErr.message.includes("kesalahan")) {
              throw jsonErr;
            }
          }
        }
      }
    } catch (err: unknown) {
      // If streaming wasn't started or got interrupted, gracefully fallback to server action
      if (!streamSucceeded) {
        try {
          setStatusText("Menyinkronkan data (mode cadangan)...");
          setProgress(50);
          await triggerCrawl();

          setProgress(100);
          setStatusText("Sinkronisasi selesai");

          const finishTime = new Date().toISOString();
          setLastCrawl(finishTime);
          setRelativeTime("Baru saja");

          setSuccessNotice("Selesai! Data lowongan berhasil diperbarui.");

          startTransition(() => {
            router.refresh();
          });

          dismissTimerRef.current = setTimeout(() => {
            setSuccessNotice(null);
            setProgress(0);
            setStatusText("");
          }, 4000);
          return;
        } catch (fallbackErr: unknown) {
          const message =
            fallbackErr instanceof Error
              ? fallbackErr.message
              : "Gagal menyinkronkan data. Silakan coba kembali.";
          setErrorNotice(message);
        }
      } else {
        const message =
          err instanceof Error
            ? err.message
            : "Koneksi terputus saat menyinkronkan data. Silakan coba lagi.";
        setErrorNotice(message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const showProgress = isSyncing || (progress > 0 && progress < 100);

  return (
    <div className="sync-card" aria-live="polite">
      <div className="sync-header-row">
        <div className="sync-info">
          <span
            className={`sync-pulse ${isSyncing ? "is-active" : ""}`}
            aria-hidden="true"
          />
          <span className="sync-status">
            {isSyncing
              ? "Sedang menyinkronkan..."
              : lastCrawl
              ? `Sinkron terakhir: ${relativeTime}`
              : "Belum pernah disinkronkan"}
          </span>
        </div>

        {liveJobsCount > 0 && (
          <span className="sync-count-tag" title="Total loker terkumpul">
            {liveJobsCount} loker
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleStartSync}
        disabled={isSyncing}
        aria-busy={isSyncing}
        className={`sync-btn ${isSyncing ? "is-loading" : ""}`}
        aria-label={isSyncing ? "Sedang menarik loker terbaru" : "Tarik pembaruan lowongan kerja"}
      >
        {isSyncing ? (
          <>
            <svg
              className="sync-spinner"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <span>Menyinkronkan...</span>
          </>
        ) : (
          <>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Tarik Loker Terbaru</span>
          </>
        )}
      </button>

      {/* Real-time Progress Bar */}
      {showProgress && (
        <div className="sync-progress-box">
          <div className="sync-progress-meta">
            <span className="sync-stage-text" title={statusText}>
              {statusText || "Memproses data..."}
            </span>
            <span className="sync-percent-text">
              {progress}% {completedSources > 0 && `(${completedSources}/${totalSources})`}
            </span>
          </div>

          <div
            className="sync-progress-track"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progres sinkronisasi lowongan"
          >
            <div
              className="sync-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="sync-progress-sub">
            <span className="sync-live-tag">
              {liveJobsCount > 0
                ? `+${liveJobsCount} loker terdeteksi`
                : "Menghubungi sumber..."}
            </span>
            <span className="sync-live-hint">Jangan tutup halaman</span>
          </div>
        </div>
      )}

      {/* Completion Notification */}
      {successNotice && !isSyncing && (
        <div className="sync-banner-success" role="status">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{successNotice}</span>
        </div>
      )}

      {/* Error Notification */}
      {errorNotice && !isSyncing && (
        <div className="sync-banner-error" role="alert">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorNotice}</span>
        </div>
      )}
    </div>
  );
}
