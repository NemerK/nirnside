"use client";

import type { ReactNode } from "react";
import { useLook } from "./look-provider";

/**
 * Renders Classic or Atlas page content from the same server-fetched data.
 * Until localStorage is read, Classic is shown (matches SSR default).
 */
export function LookSwitch({ classic, atlas }: { classic: ReactNode; atlas: ReactNode }) {
  const { look, ready } = useLook();
  if (!ready || look === "classic") return <>{classic}</>;
  return <>{atlas}</>;
}
