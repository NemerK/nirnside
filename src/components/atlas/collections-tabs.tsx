"use client";

import { useSyncExternalStore, type ReactNode } from "react";

const TABS = [
  { id: "stickerbook", label: "Stickerbook" },
  { id: "styles", label: "Outfit Styles" },
  { id: "houses", label: "Houses" },
] as const;

export type CollectionsTabId = (typeof TABS)[number]["id"];

const FROM_HASH: Record<string, CollectionsTabId> = {
  stickerbook: "stickerbook",
  sets: "stickerbook",
  styles: "styles",
  houses: "houses",
};

function readHashTab(): CollectionsTabId | "" {
  return FROM_HASH[window.location.hash.replace(/^#/, "")] ?? "";
}

function subscribeHash(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

/** Stickerbook, outfit styles, and houses each stay on their own pane. */
export function CollectionsTabs({
  initial,
  counts,
  stickerbook,
  styles,
  houses,
}: {
  initial: CollectionsTabId;
  counts: Record<CollectionsTabId, string>;
  stickerbook: ReactNode;
  styles: ReactNode;
  houses: ReactNode;
}) {
  const hashed = useSyncExternalStore<CollectionsTabId | "">(subscribeHash, readHashTab, () => "");
  const tab: CollectionsTabId = hashed || initial;
  const panels: Record<CollectionsTabId, ReactNode> = { stickerbook, styles, houses };

  function select(id: CollectionsTabId) {
    const url = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  return (
    <div>
      <div role="tablist" aria-label="Collections" className="mb-4 flex gap-1 border-b border-border">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`collections-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`collections-panel-${item.id}`}
              onClick={() => select(item.id)}
              className={`-mb-px inline-flex items-baseline gap-2 border-b-2 px-3 py-2 text-sm ${
                selected ? "border-accent font-medium text-fg" : "border-transparent text-fg-muted hover:text-fg"
              }`}
            >
              {item.label}
              <span className={`text-xs tabular-nums ${selected ? "text-fg-muted" : "text-fg-subtle"}`}>{counts[item.id]}</span>
            </button>
          );
        })}
      </div>
      {TABS.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`collections-panel-${item.id}`}
          aria-labelledby={`collections-tab-${item.id}`}
          hidden={tab !== item.id}
        >
          {panels[item.id]}
        </div>
      ))}
    </div>
  );
}
