"use client";

import type { ReactNode } from "react";
import type { ModuleDef } from "@/lib/modules";
import { AppShell, type ShellAccount } from "./app-shell";
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
  const { look, ready } = useLook();
  // SSR + first paint use Classic shell; Atlas swaps in once look is known.
  if (ready && look === "atlas") {
    return (
      <AtlasShell account={account} hiddenModules={hiddenModules} modules={modules}>
        {children}
      </AtlasShell>
    );
  }
  return (
    <AppShell account={account} hiddenModules={hiddenModules} modules={modules}>
      {children}
    </AppShell>
  );
}
