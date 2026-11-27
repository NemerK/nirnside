/**
 * Party's one rule for links: an address from the Atlas look (shared
 * components, search results, catalog helpers) opens the Party page for the
 * same thing, so a click never drops the reader into the other look.
 */
const PARTY_ROUTES: [RegExp, string][] = [
  [/^\/characters\/([^/?#]+)\/?(?:[?#].*)?$/, "/party/c/$1"],
  [/^\/characters\/?(?=$|[?#])/, "/party/characters"],
  [/^\/encyclopedia(?=$|[/?#])/, "/party/library"],
  [/^\/inventory(?=$|[/?#])/, "/party/inventory"],
  [/^\/(?:stickerbook|collections)(?=$|[/?#])/, "/party/collections"],
  [/^\/styles(?=$|[?#])/, "/party/collections?tab=styles"],
  [/^\/houses(?=$|[?#])/, "/party/collections?tab=houses"],
  [/^\/achievements(?=$|[/?#])/, "/party/achievements"],
  [/^\/knowledge(?=$|[/?#])/, "/party/knowledge"],
  [/^\/dailies(?=$|[/?#])/, "/party/dailies"],
  [/^\/progress(?=$|[?#])/, "/party/characters?view=skills"],
  [/^\/(?:goals|planner)(?=$|[/?#])/, "/party/planner"],
  [/^\/builds(?=$|[/?#])/, "/party/builds"],
  [/^\/setup(?=$|[/?#])/, "/party/setup"],
];

export function toPartyHref(href: string): string {
  if (href.startsWith("/party")) return href;
  for (const [from, to] of PARTY_ROUTES) {
    if (from.test(href)) {
      const out = href.replace(from, to);
      // "/styles?x=1" → "/party/collections?tab=styles?x=1" must join with &.
      const first = out.indexOf("?");
      return first < 0 ? out : out.slice(0, first + 1) + out.slice(first + 1).replace(/\?/g, "&");
    }
  }
  return href;
}
