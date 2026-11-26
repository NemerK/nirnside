"use client";

import type { ReactNode } from "react";
import type { ModuleDef } from "@/lib/modules";
import { AppUpdate } from "./app-update";
import { AtlasShell, type ShellAccount } from "./atlas/shell";

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
  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppUpdate />
      <div className="min-h-0 flex-1">
        <AtlasShell account={account} hiddenModules={hiddenModules} modules={modules}>
          {children}
        </AtlasShell>
      </div>
    </div>
  );
}
