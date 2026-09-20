import { NextResponse } from "next/server";
import { assignCharacterRole, listAssignments, listRoles } from "@/lib/db/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  let body: { characterId?: string; roleId?: string | null } = {};
  try {
    body = (await req.json()) as { characterId?: string; roleId?: string | null };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    assignCharacterRole(body.characterId ?? "", body.roleId ?? null);
    return NextResponse.json({ ok: true, roles: listRoles(), assignments: listAssignments() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not assign role." },
      { status: 400 },
    );
  }
}
