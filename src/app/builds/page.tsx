import Link from "next/link";
import { Swords } from "lucide-react";
import { AtlasSection } from "@/components/atlas/section";
import { BuildBoard } from "@/components/build-board";
import { LoadDemoButton } from "@/components/demo-controls";
import { LookSwitch } from "@/components/look-switch";
import { EmptyState, PageHeader } from "@/components/ui";
import { loadBuildPage } from "@/lib/builds/load";
import { getAccount } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "Pick a body set, a monster set, one mythic, a front bar and a back bar, plus the armor weight and traits. Nirnside slots them from what you own, can craft, or can reconstruct.";

export default function BuildsPage() {
  const account = safe(getAccount);
  const data = account ? safe(loadBuildPage) : null;

  if (!account || !data) {
    const empty = (
      <EmptyState title="No account yet" icon={<Swords className="h-8 w-8" />}>
        <p className="mb-4">
          Builds are arranged from your own bags, stickerbook and research. Import the account first.
        </p>
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg"
          >
            Open Setup
          </Link>
          <LoadDemoButton />
        </div>
      </EmptyState>
    );
    return (
      <LookSwitch
        classic={
          <div className="mx-auto w-full max-w-3xl">
            <PageHeader title="Builds" subtitle={SUBTITLE} />
            {empty}
          </div>
        }
        atlas={<AtlasSection title="Builds" subtitle={SUBTITLE}>{empty}</AtlasSection>}
      />
    );
  }

  const board = <BuildBoard data={data} />;
  return (
    <LookSwitch
      classic={
        <div className="mx-auto w-full max-w-6xl">
          <PageHeader title="Builds" subtitle={SUBTITLE} />
          {board}
        </div>
      }
      atlas={
        <AtlasSection title="Builds" subtitle={SUBTITLE}>
          {board}
        </AtlasSection>
      }
    />
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
