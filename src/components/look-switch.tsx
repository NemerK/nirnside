"use client";

import type { ReactNode } from "react";
import { useLook } from "./look-provider";

/** Page body for the look the server already chose. The shell uses the same value. */
export function LookSwitch({ classic, atlas }: { classic: ReactNode; atlas: ReactNode }) {
  const { look } = useLook();
  if (look === "classic") return <>{classic}</>;
  return <>{atlas}</>;
}
