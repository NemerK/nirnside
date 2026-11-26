import { NextResponse } from "next/server";
import { globalSearch } from "@/lib/db/search";

export const dynamic = "force-dynamic";

/** Command-palette search over the account and the catalog. Local only. */
export function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 80);
  try {
    return NextResponse.json(globalSearch(q, 24));
  } catch {
    return NextResponse.json({ catalog: [], account: [], total: 0 });
  }
}
