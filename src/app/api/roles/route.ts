import { NextResponse } from "next/server";
import { createRole, listAssignments, listRoles } from "@/lib/db/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ roles: listRoles(), assignments: listAssignments() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load roles." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { name?: string; color?: string } = {};
  try {
    body = (await req.json()) as { name?: string; color?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    const role = createRole(body.name ?? "", body.color ?? "");
    return NextResponse.json({ role, roles: listRoles(), assignments: listAssignments() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create role." }, { status: 400 });
  }
}
