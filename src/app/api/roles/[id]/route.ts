import { NextResponse } from "next/server";
import { deleteRole, listAssignments, listRoles, updateRole } from "@/lib/db/roles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { name?: string; color?: string } = {};
  try {
    body = (await req.json()) as { name?: string; color?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    const role = updateRole(id, body);
    return NextResponse.json({ role, roles: listRoles(), assignments: listAssignments() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update role." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    deleteRole(id);
    return NextResponse.json({ ok: true, roles: listRoles(), assignments: listAssignments() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not delete role." }, { status: 400 });
  }
}
