import { revalidatePath } from "next/cache";
import { runCrawl, CrawlProgress } from "@/lib/crawler";
import { sources } from "@/lib/sources";

export const maxDuration = 60;

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const send = (data: unknown) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          isClosed = true;
        }
      };

      const onProgress = (p: CrawlProgress) => {
        send({
          phase: "progress",
          completed: p.completed,
          total: p.total,
          percent: p.percent,
          source: p.sourceLabel,
          totalJobs: p.totalJobs,
        });
      };

      try {
        send({
          phase: "start",
          message: "Menyiapkan sinkronisasi loker...",
          completed: 0,
          total: sources.length,
          percent: 0,
          totalJobs: 0,
        });

        const crawlRes = await runCrawl(onProgress);

        try {
          revalidatePath("/");
        } catch {
          // Ignore cache revalidation errors if outside request scope
        }

        send({
          phase: "done",
          totalJobs: crawlRes.totalJobs,
          timestamp: crawlRes.start,
          percent: 100,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        send({
          phase: "error",
          error: message || "Terjadi kendala saat menyinkronkan data.",
        });
      } finally {
        if (!isClosed) {
          try {
            controller.close();
          } catch {}
          isClosed = true;
        }
      }
    },
    cancel() {
      // Stream cancelled by client
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
