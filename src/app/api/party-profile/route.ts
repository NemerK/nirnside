import { NextResponse } from "next/server";
import { getPartyProfile, setPartyProfile } from "@/lib/db/party-profile";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getPartyProfile());
  } catch {
    return NextResponse.json({ error: "Could not load your profile." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    return NextResponse.json(setPartyProfile(body));
  } catch {
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }
}
