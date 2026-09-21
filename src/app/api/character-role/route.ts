import { NextResponse } from "next/server";
import { clearCharacterRoles, listAssignments, listRoles, setCharacterRole } from "@/lib/db/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(req: Request) {
  let body: { characterId?: string; roleId?: string | null; assigned?: boolean } = {};
  try {
    body = (await req.json()) as { characterId?: string; roleId?: string | null; assigned?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    const characterId = body.characterId ?? "";
    if (!body.roleId) {
      clearCharacterRoles(characterId);
    } else {
      setCharacterRole(characterId, body.roleId, body.assigned !== false);
    }
    return NextResponse.json({ ok: true, roles: listRoles(), assignments: listAssignments() });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not assign role." },
      { status: 400 },
    );
  }
}
