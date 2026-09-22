import { NextResponse } from "next/server";
import { createGoal, listGoals, skillLineChoices } from "@/lib/db/goals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ goals: listGoals(), lines: skillLineChoices() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load goals." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: {
    scope?: string;
    characterId?: string | null;
    lineName?: string;
    targetRank?: number;
    note?: string;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    const goal = createGoal({
      scope: body.scope ?? "",
      characterId: body.characterId,
      lineName: body.lineName ?? "",
      targetRank: Number(body.targetRank),
      note: body.note,
    });
    return NextResponse.json({ goal, goals: listGoals() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create goal." }, { status: 400 });
  }
}
