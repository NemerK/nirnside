import Link from "next/link";

/** Shown on deep collection pages in Atlas so the hub stays discoverable. */
export function AtlasCollectionsLink({ current }: { current: "sets" | "styles" | "houses" }) {
  return (
    <p className="mb-4 text-sm text-fg-muted">
      Part of{" "}
      <Link href={`/collections#${current === "sets" ? "stickerbook" : current}`} className="text-accent hover:underline">
        Account → Collections
      </Link>
      {" — "}
      set pieces, outfit styles, and houses in one place.
    </p>
  );
}
