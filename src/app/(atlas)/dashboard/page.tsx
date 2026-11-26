import { redirect } from "next/navigation";
import { characterPathForSection } from "@/lib/characters/legacy-links";

/** The old Dashboard. Character progress now lives on the roster and each character's page. */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  redirect(
    characterPathForSection(
      typeof sp.char === "string" ? sp.char : null,
      typeof sp.section === "string" ? sp.section : null,
    ),
  );
}
