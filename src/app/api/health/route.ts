import { NextResponse } from "next/server";
import { bootedAt } from "@/lib/setup/boot";
import { readLocalSha } from "@/lib/setup/revision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cheap liveness probe for the Windows exe. Must not touch SavedVariables,
 * disk walks, or SQLite — those run after listen and used to freeze the
 * launcher at 98% while `/` scanned every drive letter.
 * `bootedAt` lets the open window tell a restarted process from this one.
 * `sha` is one small revision file in the install folder.
 */
export function GET() {
  return NextResponse.json({ ok: true, app: "nirnside", bootedAt, sha: readLocalSha() });
}
