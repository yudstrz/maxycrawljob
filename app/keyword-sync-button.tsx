"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { triggerKeywordCrawl } from "./actions";

interface KeywordSyncButtonProps {
  query: string;
  variant?: "primary" | "subtle";
}

export function KeywordSyncButton({ query, variant = "subtle" }: KeywordSyncButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    setResultMessage(null);

    try {
      const res = await triggerKeywordCrawl(cleanQuery);
      if (res.totalJobs > 0) {
        setResultMessage(`+${res.totalJobs} loker baru ditambahkan!`);
      } else {
        setResultMessage("Tidak ditemukan loker tambahan di portal luar.");
      }

      startTransition(() => {
        router.refresh();
      });

      setTimeout(() => {
        setResultMessage(null);
      }, 4000);
    } catch {
      setResultMessage("Gagal menarik data. Coba lagi.");
      setTimeout(() => {
        setResultMessage(null);
      }, 4000);
    } finally {
      setLoading(false);
    }
  };

  const isPrimary = variant === "primary";

  return (
    <div className={`keyword-sync-wrap ${isPrimary ? "is-primary-wrap" : "is-subtle-wrap"}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={isPrimary ? "keyword-sync-btn-primary" : "keyword-sync-btn-subtle"}
        aria-busy={loading}
        aria-label={`Tarik lowongan untuk kata kunci ${cleanQuery}`}
      >
        <svg
          className={loading ? "sync-spinner" : ""}
          width={isPrimary ? "15" : "13"}
          height={isPrimary ? "15" : "13"}
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
        <span>
          {loading
            ? `Menarik loker "${cleanQuery}"...`
            : isPrimary
            ? `Tarik Loker "${cleanQuery}" dari Portal Luar`
            : `Tarik Loker "${cleanQuery}"`}
        </span>
      </button>

      {resultMessage && (
        <span className="keyword-sync-feedback" role="status">
          {resultMessage}
        </span>
      )}
    </div>
  );
}
