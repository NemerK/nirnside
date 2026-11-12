import type { ReactNode } from "react";
import { AtlasPage } from "./ui";

/**
 * Thin Atlas chrome around an existing Classic board. Keeps deep module UIs
 * (achievements matrix, dailies grid, planner, knowledge) while aligning the
 * page header with Atlas IA grains.
 */
export function AtlasSection({
  grain,
  title,
  subtitle,
  action,
  compact,
  children,
}: {
  grain: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <AtlasPage grain={grain} title={title} subtitle={subtitle} action={action} compact={compact}>
      {children}
    </AtlasPage>
  );
}
