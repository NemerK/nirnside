import { NextResponse } from "next/server";
import { deleteGoal, listGoals, updateGoal } from "@/lib/db/goals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { targetRank?: number; note?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    const goal = updateGoal(id, body);
    return NextResponse.json({ goal, goals: listGoals() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update goal." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    deleteGoal(id);
    return NextResponse.json({ ok: true, goals: listGoals() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not delete goal." }, { status: 400 });
  }
}
