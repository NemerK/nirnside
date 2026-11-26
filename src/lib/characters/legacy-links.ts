/**
 * Old /dashboard and /focus links named a character and a progress section.
 * Send them to the page that shows that progress now.
 */
const SECTION_TAB: Record<string, string> = {
  skills: "overview",
  scribing: "scripts",
  champion: "cp",
  targets: "targets",
};

export function characterPathForSection(char: string | null, section: string | null): string {
  if (!char) return "/characters";
  if (section === "crafting" || section === "knowledge") {
    return `/knowledge?char=${encodeURIComponent(char)}`;
  }
  const tab = section ? SECTION_TAB[section] : undefined;
  const base = `/characters/${encodeURIComponent(char)}`;
  return tab && tab !== "overview" ? `${base}?tab=${tab}` : base;
}
