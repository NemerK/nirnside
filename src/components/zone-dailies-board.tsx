"use client";

import { Check } from "lucide-react";
import { zoneSlotKey, type PresentedCharacterDailies, type ZoneSlotCell } from "@/lib/dailies/present";
import { ZONE_DAILY_ZONES } from "@/lib/dailies/zone-dailies";

function ZoneBox({ cell }: { cell: ZoneSlotCell }) {
  if (cell.status === "done") {
    return (
      <span
        title={cell.title}
        className="inline-flex h-4 w-4 items-center justify-center rounded border border-ok/50 bg-ok/15 text-ok"
      >
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (cell.status === "unscanned") {
    return (
      <span
        title={cell.title}
        className="inline-flex h-4 w-4 rounded border border-dashed border-border/80 bg-transparent"
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
    <span title={cell.title} className={`inline-flex h-4 w-4 items-center justify-center rounded border bg-surface ${tone}`}>
      {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
    </span>
  );
}

function doneCount(rows: PresentedCharacterDailies[], key: string): number {
  return rows.filter((row) => row.zoneSlots[key]?.status === "done").length;
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
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2 text-left text-[11px] text-fg-subtle">
            <th className="sticky left-0 z-10 bg-surface-2 px-2 py-1 font-medium" rowSpan={2}>
              Character
            </th>
            {ZONE_DAILY_ZONES.map((zone, index) => (
              <th
                key={zone.id}
                colSpan={zone.slots.length}
                className={`whitespace-nowrap border-l border-border px-1 py-0.5 text-center font-medium text-fg ${index % 2 === 0 ? "bg-surface-2" : ""}`}
              >
                {zone.name}
              </th>
            ))}
          </tr>
          <tr className="border-b border-border bg-surface-2/80 text-[10px] text-fg-subtle">
            {ZONE_DAILY_ZONES.map((zone) =>
              zone.slots.map((slot, slotIndex) => {
                const key = zoneSlotKey(zone.id, slot.kind);
                const count = doneCount(counts, key);
                return (
                  <th
                    key={key}
                    className={`whitespace-nowrap px-1.5 py-0.5 text-center font-medium ${slotIndex === 0 ? "border-l border-border" : ""}`}
                    title={
                      count > 0
                        ? `${zone.name} ${slot.label} — done on ${count} ${count === 1 ? "character" : "characters"}`
                        : `${zone.name} ${slot.label}`
                    }
                  >
                    {slot.label}
                    {count > 0 ? <span className="ml-0.5 tabular-nums normal-case tracking-normal text-fg-muted">{count}</span> : null}
                  </th>
                );
              }),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.characterId} className="group border-b border-border/50 align-middle last:border-0">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-2 py-0.5 group-hover:bg-surface-2">
                <a href={`/characters/${encodeURIComponent(row.characterId)}`} className="text-sm font-medium text-fg hover:text-accent">
                  {row.name}
                </a>
                <span className="ml-1.5 text-[11px] text-fg-subtle">{row.className}</span>
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
                      className={`px-1 py-0.5 text-center ${slotIndex === 0 ? "border-l border-border/70" : ""}`}
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
  );
}
