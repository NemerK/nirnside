import { NextResponse } from "next/server";
import { profileMedia } from "@/lib/db/profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(profileMedia());
}
