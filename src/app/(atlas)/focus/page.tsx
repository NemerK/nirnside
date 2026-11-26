import { redirect } from "next/navigation";
import { characterPathForSection } from "@/lib/characters/legacy-links";

/** Focus used to be its own tab. A character's progress now opens on their own page. */
export default async function FocusPage({ searchParams }: PageProps<"/focus">) {
  const sp = await searchParams;
  redirect(characterPathForSection(typeof sp.char === "string" ? sp.char : null, "skills"));
}
