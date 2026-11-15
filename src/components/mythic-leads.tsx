import { Check } from "lucide-react";
import type { MythicSet } from "@/lib/snapshot/schema";
import { GameIcon } from "./game-icon";

/**
 * Mythic antiquity sets. Leads stay visible until the set is recovered.
 * The scrying zone is the client's own string, and only after the lead is held.
 */
export function MythicLeads({ mythics }: { mythics: MythicSet[] }) {
  const open = mythics.filter((row) => !row.collected);
  const done = mythics.filter((row) => row.collected);

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-fg">Mythics</h2>
      <p className="mt-1 max-w-3xl text-xs text-fg-subtle">
        Each mythic is a set of leads from the antiquity codex. They stay listed until the set is recovered. The
        client names the lead, and shows the scrying zone once that lead is yours.
      </p>
      {mythics.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">
          Log out with the addon installed to read mythic leads from the game. A new mythic shows up after that
          patch&apos;s logout — nothing here is a frozen list.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {open.map((mythic) => (
            <article key={mythic.setId} className="rounded-lg border border-border bg-surface px-3 py-3">
              <div className="flex items-center gap-2">
                <GameIcon name={mythic.name} icon={mythic.icon} size={28} bare />
                <h3 className="text-sm font-medium text-fg">{mythic.name}</h3>
                <span className="text-xs tabular-nums text-fg-subtle">
                  {mythic.leads.filter((lead) => lead.recovered).length}/{mythic.leads.length}
                </span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {mythic.leads.map((lead) => (
                  <li key={lead.antiquityId} className="flex items-start gap-2 text-sm">
                    <GameIcon name={lead.name} icon={lead.icon} size={20} bare />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={lead.recovered ? "text-fg-muted" : "text-fg"}>{lead.name}</span>
                        {lead.recovered ? (
                          <span className="inline-flex items-center gap-1 text-xs text-fg-subtle">
                            <Check className="h-3 w-3" /> Excavated
                          </span>
                        ) : lead.hasLead ? (
                          <span className="text-xs text-accent">Lead in hand</span>
                        ) : (
                          <span className="text-xs text-fg-subtle">Lead not found</span>
                        )}
                      </div>
                      {lead.zone ? (
                        <p className="text-xs text-fg-muted">Scry in {lead.zone}</p>
                      ) : lead.recovered ? null : (
                        <p className="text-xs text-fg-subtle">Scrying zone appears once you have this lead.</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {done.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {done.map((mythic) => (
                <span
                  key={mythic.setId}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-fg-muted"
                >
                  <Check className="h-3 w-3" />
                  {mythic.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
