import { NextResponse } from "next/server";
import { createGoal, listGoals } from "@/lib/db/goals";
import { skillLineChoices } from "@/lib/planner/data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ goals: listGoals(), lines: skillLineChoices() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load targets." }, { status: 500 });
  }
}

interface GoalBody {
  domain?: string;
  tier?: string;
  scope?: string;
  characterId?: string | null;
  scopeKey?: string | null;
  /** One target, or several at once (the planner composer adds in bulk). */
  target?: string;
  targets?: string[];
  /** Legacy field name for skill-line targets. */
  lineName?: string;
  targetRank?: number;
  extraRank?: number;
  note?: string;
}

export async function POST(req: Request) {
  let body: GoalBody = {};
  try {
    body = (await req.json()) as GoalBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const single = body.target ?? body.lineName;
  const targets = Array.isArray(body.targets) && body.targets.length > 0 ? body.targets : single ? [single] : [];
  if (targets.length === 0) {
    return NextResponse.json({ error: "Pick what to target." }, { status: 400 });
  }

  const created: string[] = [];
  try {
    for (const target of targets) {
      const goal = createGoal({
        domain: body.domain,
        tier: body.tier,
        scope: body.scope ?? "",
        characterId: body.characterId,
        scopeKey: body.scopeKey,
        target,
        targetRank: body.targetRank,
        extraRank: body.extraRank,
        note: body.note,
      });
      created.push(goal.id);
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Could not save targets.",
        // Whatever succeeded before the failure is already saved — report it.
        created,
        goals: listGoals(),
      },
      { status: 400 },
    );
  }
  return NextResponse.json({ created, goals: listGoals(), lines: skillLineChoices() });
}
