import { redirect } from "next/navigation";

/** The profile used to live here. Home is that page now. */
export default function LivingHomePage() {
  redirect("/");
}
