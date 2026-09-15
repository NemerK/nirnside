import { ACH_COLUMNS, CONTENT_ORDER, type AchColumn, type ContentCategory } from "./classify";

/**
 * Pure, environment-agnostic shaping of achievement data into board rows. Kept
 * separate from the DB and React so both the server page and the client board
 * share exactly one definition of a row.
 */

/** A single achievement placed into a column, ready to aggregate. */
export interface BoardItem {
  content: string;
  category: ContentCategory;
  column: AchColumn;
  name: string;
  completed: boolean;
  points: number;
  /** Title reward granted by this achievement, if any. */
  title?: string | null;
  /** Date earned, as the game reports it, or null. */
  date?: string | null;
}

export interface CellItem {
  name: string;
  completed: boolean;
  points: number;
  date?: string | null;
  /** Title reward this achievement grants, if any (shown in Extras). */
  title?: string | null;
}

export interface Cell {
  earned: number;
  total: number;
  items: CellItem[];
}

export interface BoardRow {
  content: string;
  category: ContentCategory;
  cells: Record<AchColumn, Cell>;
  /** Earned titles for this content (the "Extras" column). */
  titles: { name: string; completed: boolean; date?: string | null }[];
  earnedCount: number;
  totalCount: number;
  points: { earned: number; total: number };
}

function emptyCells(): Record<AchColumn, Cell> {
  const cells = {} as Record<AchColumn, Cell>;
  for (const c of ACH_COLUMNS) cells[c] = { earned: 0, total: 0, items: [] };
  return cells;
}

export function buildRows(items: BoardItem[]): BoardRow[] {
  const byContent = new Map<string, BoardRow>();

  for (const it of items) {
    let row = byContent.get(it.content);
    if (!row) {
      row = {
        content: it.content,
        category: it.category,
        cells: emptyCells(),
        titles: [],
        earnedCount: 0,
        totalCount: 0,
        points: { earned: 0, total: 0 },
      };
      byContent.set(it.content, row);
    }

    const cell = row.cells[it.column];
    cell.total += 1;
    cell.items.push({ name: it.name, completed: it.completed, points: it.points, date: it.date, title: it.title });
    if (it.completed) cell.earned += 1;

    row.totalCount += 1;
    if (it.completed) row.earnedCount += 1;
    row.points.total += it.points;
    if (it.completed) row.points.earned += it.points;

    if (it.title) row.titles.push({ name: it.title, completed: it.completed, date: it.date });
  }

  // Within a cell, list earned achievements first, then alphabetical — stable
  // for both the compact pills and the named lists (Extras / per-boss HM).
  for (const row of byContent.values()) {
    for (const col of ACH_COLUMNS) {
      row.cells[col].items.sort(
        (a, b) => Number(b.completed) - Number(a.completed) || a.name.localeCompare(b.name),
      );
    }
    row.titles.sort((a, b) => a.name.localeCompare(b.name));
  }

  return Array.from(byContent.values()).sort((a, b) => {
    const ca = CONTENT_ORDER.indexOf(a.category);
    const cb = CONTENT_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.content.localeCompare(b.content);
  });
}

export interface BoardStats {
  earned: number;
  total: number;
  trifectas: { earned: number; total: number };
  titles: { earned: number; total: number };
  points: { earned: number; total: number };
  contentTracked: number;
}

export function boardStats(rows: BoardRow[]): BoardStats {
  const stats: BoardStats = {
    earned: 0,
    total: 0,
    trifectas: { earned: 0, total: 0 },
    titles: { earned: 0, total: 0 },
    points: { earned: 0, total: 0 },
    contentTracked: rows.length,
  };
  for (const row of rows) {
    stats.earned += row.earnedCount;
    stats.total += row.totalCount;
    stats.points.earned += row.points.earned;
    stats.points.total += row.points.total;
    const tri = row.cells["Trifecta"];
    stats.trifectas.earned += tri.earned;
    stats.trifectas.total += tri.total;
    for (const t of row.titles) {
      stats.titles.total += 1;
      if (t.completed) stats.titles.earned += 1;
    }
  }
  return stats;
}
