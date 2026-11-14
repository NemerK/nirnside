"use client";

import type { ReactNode } from "react";
import type { ModuleDef } from "@/lib/modules";
import { AppShell, type ShellAccount } from "./app-shell";
import { AppUpdate } from "./app-update";
import { AtlasShell } from "./atlas/shell";
import { useLook } from "./look-provider";

export function ShellSwitcher({
  account,
  hiddenModules,
  modules,
  children,
}: {
  account: ShellAccount | null;
  hiddenModules?: string[];
  modules?: ModuleDef[];
  children: ReactNode;
}) {
  const { look } = useLook();
  const shell =
    look === "atlas" ? (
      <AtlasShell account={account} hiddenModules={hiddenModules} modules={modules}>
        {children}
      </AtlasShell>
    ) : (
      <AppShell account={account} hiddenModules={hiddenModules} modules={modules}>
        {children}
      </AppShell>
    );
  return (
    <div data-rendered-look={look} className="flex h-full min-h-0 flex-col">
      <AppUpdate />
      <div className="min-h-0 flex-1">{shell}</div>
    </div>
  );
}
