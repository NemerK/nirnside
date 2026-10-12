"use client";

import { Check } from "lucide-react";
import { zoneSlotKey, type PresentedCharacterDailies, type ZoneSlotCell } from "@/lib/dailies/present";
import { ZONE_DAILY_ZONES } from "@/lib/dailies/zone-dailies";

function ZoneBox({ cell }: { cell: ZoneSlotCell }) {
  if (cell.status === "done") {
    return (
      <span
        title={cell.title}
        className="inline-flex h-5 w-5 items-center justify-center rounded border border-ok/50 bg-ok/15 text-ok"
      >
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (cell.status === "unscanned") {
    return (
      <span
        title={cell.title}
        className="inline-flex h-5 w-5 rounded border border-dashed border-border/80 bg-transparent"
      />
    );
  }
  const tone =
    cell.status === "ready"
      ? "border-accent/70"
      : cell.status === "accepted"
        ? "border-amber-500/60"
        : "border-border";
  const dot =
    cell.status === "ready" ? "bg-accent" : cell.status === "accepted" ? "bg-amber-500" : "";
  return (
    <span title={cell.title} className={`inline-flex h-5 w-5 items-center justify-center rounded border bg-surface ${tone}`}>
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
    </span>
  );
}

function doneCount(rows: PresentedCharacterDailies[], key: string): number {
  return rows.filter((row) => row.zoneSlots[key]?.status === "done").length;
}

function catalogSeen(rows: PresentedCharacterDailies[]): boolean {
  return rows.some((row) =>
    Object.entries(row.zoneSlots).some(([key, slot]) => key.endsWith(":delve") && slot.status !== "unscanned"),
  );
}

export function ZoneDailiesBoard({
  rows,
  accountRows,
}: {
  rows: PresentedCharacterDailies[];
  accountRows: PresentedCharacterDailies[];
}) {
  const counts = accountRows;
  return (
    <div>
      <p className="mb-2 text-xs text-fg-subtle">
        Each zone has a delve and a world boss. Some also have a world event. A check is turned in
        today. An empty box was scanned and is still open. The number under a column is how many
        characters have finished that daily.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/40 text-left text-xs text-fg-subtle">
              <th className="sticky left-0 z-10 bg-surface-2/40 px-3 py-2 font-medium" rowSpan={2}>
                Character
              </th>
              {ZONE_DAILY_ZONES.map((zone, index) => (
                <th
                  key={zone.id}
                  colSpan={zone.slots.length}
                  className={`px-1 py-1.5 text-center font-medium text-fg ${index % 2 === 0 ? "bg-surface-2/70" : ""} border-l border-border`}
                >
                  {zone.name}
                </th>
              ))}
            </tr>
            <tr className="border-b border-border bg-surface-2/20 text-[10px] uppercase tracking-wide text-fg-subtle">
              {ZONE_DAILY_ZONES.map((zone) =>
                zone.slots.map((slot, slotIndex) => {
                  const key = zoneSlotKey(zone.id, slot.kind);
                  const count = doneCount(counts, key);
                  return (
                    <th
                      key={key}
                      className={`px-1 py-1 text-center font-medium ${slotIndex === 0 ? "border-l border-border" : ""}`}
                      title={`${zone.name} ${slot.label}`}
                    >
                      {slot.label}
                      {count > 0 ? (
                        <div
                          className="mt-0.5 font-normal normal-case tracking-normal text-fg-muted"
                          title={`Done on ${count} ${count === 1 ? "character" : "characters"}`}
                        >
                          {count}
                        </div>
                      ) : (
                        <div className="mt-0.5 font-normal text-transparent">0</div>
                      )}
                    </th>
                  );
                }),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.characterId} className="border-b border-border/50 align-middle last:border-0 hover:bg-surface-2/30">
                <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                  <a href={`/characters/${encodeURIComponent(row.characterId)}`} className="font-medium text-fg hover:text-accent">
                    {row.name}
                  </a>
                  <div className="text-[11px] text-fg-subtle">{row.className}</div>
                </td>
                {ZONE_DAILY_ZONES.map((zone) =>
                  zone.slots.map((slot, slotIndex) => {
                    const key = zoneSlotKey(zone.id, slot.kind);
                    const cell = row.zoneSlots[key] ?? {
                      status: "unscanned" as const,
                      title: `${zone.name} ${slot.label} — not scanned since reset`,
                      names: [],
                    };
                    return (
                      <td
                        key={key}
                        className={`px-1 py-1.5 text-center ${slotIndex === 0 ? "border-l border-border/70" : ""}`}
                      >
                        <ZoneBox cell={cell} />
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!catalogSeen(accountRows) && (
        <p className="mt-3 text-xs text-fg-subtle">
          World boss boxes use the snapshot already on disk. Delve and world-event boxes stay
          dashed on that scan.
        </p>
      )}
      <p className="mt-3 text-xs text-fg-subtle">
        A dashed box has not been scanned since reset. A dot in an empty box means that quest is in
        the journal. The number in the column header is the account total, across every character,
        including ones hidden by the search.
      </p>
    </div>
  );
}
