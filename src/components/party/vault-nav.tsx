import Link from "next/link";

export const VAULT_SECTIONS = [
  { id: "", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "sets", label: "Set collection" },
  { id: "achievements", label: "Achievements" },
  { id: "dailies", label: "Dailies" },
  { id: "crafting", label: "Crafting" },
  { id: "styles", label: "Outfit styles" },
  { id: "houses", label: "Houses" },
] as const;

export type VaultSection = (typeof VAULT_SECTIONS)[number]["id"];

/** The Vault's sections, as one row of tabs. */
export function VaultNav({ current }: { current: VaultSection }) {
  return (
    <nav aria-label="Vault sections" className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-surface/70 p-1">
      {VAULT_SECTIONS.map((s) => (
        <Link
          key={s.id || "overview"}
          href={s.id ? `/party/vault/${s.id}` : "/party/vault"}
          aria-current={s.id === current ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 text-[13px] ${s.id === current ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"}`}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
