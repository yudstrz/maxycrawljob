"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db, init } from "@/lib/db";
import { runCrawl, runKeywordCrawl } from "@/lib/crawler";

export async function toggleWishlist(jobId: string) {
  if (!jobId || jobId.length > 200) return;
  const jar = await cookies();
  let owner = jar.get("owner")?.value;
  if (!owner) {
    owner = crypto.randomUUID();
    jar.set("owner", owner, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 5,
      path: "/",
    });
  }
  await init();
  const del = await db.execute({ sql: "DELETE FROM wishlist WHERE owner = ? AND job_id = ?", args: [owner, jobId] });
  if (!del.rowsAffected)
    await db.execute({ sql: "INSERT INTO wishlist (owner, job_id, added_at) VALUES (?, ?, ?)", args: [owner, jobId, new Date().toISOString()] });
  revalidatePath("/");
}

export async function triggerCrawl(): Promise<void> {
  await runCrawl();
  revalidatePath("/");
}

export async function triggerKeywordCrawl(keyword: string): Promise<{ success: boolean; totalJobs: number }> {
  const res = await runKeywordCrawl(keyword);
  revalidatePath("/");
  return { success: true, totalJobs: res.totalJobs };
}
