/**
 * Party's one rule for links: an address from the Atlas look (shared
 * components, search results, catalog helpers) opens the Party page for the
 * same thing, so a click never drops the reader into the other look.
 */
const PARTY_ROUTES: [RegExp, string][] = [
  [/^\/characters\/([^/?#]+)\/?(?:[?#].*)?$/, "/party/c/$1"],
  [/^\/characters\/?(?:[?#].*)?$/, "/party"],
  [/^\/encyclopedia(?=$|[/?#])/, "/party/library"],
  [/^\/inventory(?=$|[/?#])/, "/party/vault/inventory"],
  [/^\/stickerbook(?=$|[/?#])/, "/party/vault/sets"],
  [/^\/collections(?=$|[/?#])/, "/party/vault/sets"],
  [/^\/achievements(?=$|[/?#])/, "/party/vault/achievements"],
  [/^\/knowledge(?=$|[/?#])/, "/party/vault/crafting"],
  [/^\/styles(?=$|[/?#])/, "/party/vault/styles"],
  [/^\/houses(?=$|[/?#])/, "/party/vault/houses"],
  [/^\/dailies(?=$|[/?#])/, "/party/vault/dailies"],
  [/^\/(?:progress|goals|planner)(?=$|[/?#])/, "/party/targets"],
  [/^\/setup(?=$|[/?#])/, "/party/setup"],
];

export function toPartyHref(href: string): string {
  if (href.startsWith("/party")) return href;
  for (const [from, to] of PARTY_ROUTES) {
    if (from.test(href)) return href.replace(from, to);
  }
  return href;
}
