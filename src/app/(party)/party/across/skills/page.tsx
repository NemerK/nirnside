import { PageHead } from "@/components/party/page-head";
import { ProgressGrid } from "@/components/progress/progress-grid";
import { listGoals } from "@/lib/db/goals";
import { listRoles } from "@/lib/db/roles";
import { buildLineGrid } from "@/lib/progress/grid";
import { compareLines, lightSubjects, roster } from "@/lib/party/data";

export const dynamic = "force-dynamic";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Every skill line for every character, with targets drawn on top. */
export default function AcrossSkillsPage() {
  const characters = roster();
  const subjects = lightSubjects();
  const { lines, lineIndex } = compareLines(characters);
  const goals = safe(() => listGoals(), []);
  const roles = safe(() => listRoles(), []).map((r) => ({ id: r.id, name: r.name }));
  const grid = buildLineGrid({ subjects, lines, lineIndex, goals });

  return (
    // The grid scrolls inside the screen, so the line and character names stay in view.
    <div className="mx-auto flex w-full max-w-[1600px] flex-col" style={{ height: "calc(100dvh - 7.5rem)" }}>
      <PageHead
        title="Skill lines"
        lead="Every skill line for every character. Click a cell or a line to set a target."
      />
      {subjects.length === 0 ? (
        <p className="party-module px-6 py-10 text-center text-fg-muted">No characters yet.</p>
      ) : (
        <ProgressGrid grid={grid} goals={goals} roles={roles} />
      )}
    </div>
  );
}
