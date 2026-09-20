import { NextResponse } from "next/server";
import { browseDir } from "@/lib/setup/browse";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  return NextResponse.json(browseDir(path));
}
