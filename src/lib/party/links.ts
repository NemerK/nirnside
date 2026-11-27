/**
 * Party's one rule for links: an address from the Atlas look (shared
 * components, search results, catalog helpers) opens the Party page for the
 * same thing, so a click never drops the reader into the other look.
 */
const PARTY_ROUTES: [RegExp, string][] = [
  [/^\/characters\/([^/?#]+)\/?(?:[?#].*)?$/, "/party/c/$1"],
  [/^\/characters\/?(?:[?#].*)?$/, "/party/characters"],
  [/^\/encyclopedia(?=$|[/?#])/, "/party/library"],
  [/^\/inventory(?=$|[/?#])/, "/party/account/inventory"],
  [/^\/stickerbook(?=$|[/?#])/, "/party/account/sets"],
  [/^\/collections(?=$|[/?#])/, "/party/account/sets"],
  [/^\/achievements(?=$|[/?#])/, "/party/account/achievements"],
  [/^\/knowledge(?=$|[/?#])/, "/party/across/crafting"],
  [/^\/styles(?=$|[/?#])/, "/party/account/styles"],
  [/^\/houses(?=$|[/?#])/, "/party/account/houses"],
  [/^\/dailies(?=$|[/?#])/, "/party/across/dailies"],
  [/^\/progress(?=$|[/?#])/, "/party/across/skills"],
  [/^\/(?:goals|planner)(?=$|[/?#])/, "/party/across/targets"],
  [/^\/setup(?=$|[/?#])/, "/party/setup"],
];

export function toPartyHref(href: string): string {
  if (href.startsWith("/party")) return href;
  for (const [from, to] of PARTY_ROUTES) {
    if (from.test(href)) return href.replace(from, to);
  }
  return href;
}
