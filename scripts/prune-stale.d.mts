export function readStaleList(listPath?: string): string[];
export function shadowedAppEntries(root: string): string[];
export function pruneStale(root: string, options?: { paths?: string[]; listPath?: string }): string[];
export function pruneRemovedFiles(fromDir: string, toDir: string, shouldSkip?: (rel: string) => boolean): string[];
