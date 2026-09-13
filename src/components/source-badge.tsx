import { BadgeCheck, BookOpen, TriangleAlert } from "lucide-react";
import type { CatalogSource } from "@/lib/catalog/schema";
import { Badge } from "./ui";

/**
 * Communicates the accuracy rule at the point of use: in-game data is verified
 * truth; community/reference data is explicitly flagged as not-yet-verified.
 */
export function SourceBadge({ source }: { source: CatalogSource }) {
  if (source === "ingame") {
    return (
      <Badge tone="ok">
        <BadgeCheck className="h-3 w-3" /> In-game verified
      </Badge>
    );
  }
  if (source === "community") {
    return (
      <Badge tone="muted">
        <BookOpen className="h-3 w-3" /> Community
      </Badge>
    );
  }
  return (
    <Badge tone="muted">
      <TriangleAlert className="h-3 w-3" /> Reference · verify in-game
    </Badge>
  );
}

export function UnverifiedNote({ source }: { source: CatalogSource }) {
  if (source === "ingame") return null;
  return (
    <p className="mt-2 text-xs text-fg-subtle">
      Numeric values aren&apos;t shown until confirmed by an in-game scan. Run the{" "}
      <code className="rounded bg-surface-2 px-1">NirnsideCatalog</code> addon to replace this with in-game-verified
      data.
    </p>
  );
}
