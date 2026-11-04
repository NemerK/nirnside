import { redirect } from "next/navigation";

/** Focus used to be its own tab. Character progress now opens on the Dashboard. */
export default async function FocusPage({ searchParams }: PageProps<"/focus">) {
  const sp = await searchParams;
  const char = typeof sp.char === "string" ? sp.char : "";
  redirect(char ? `/dashboard?char=${encodeURIComponent(char)}&section=skills` : "/dashboard");
}
