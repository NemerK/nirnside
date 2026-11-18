/** The two pictures a player can set for their own profile. */
export type ProfileKind = "avatar" | "banner";

export type ProfileMedia = {
  /** Updated time, or null when that picture has not been set. */
  avatar: number | null;
  banner: number | null;
};

export function isProfileKind(kind: string): kind is ProfileKind {
  return kind === "avatar" || kind === "banner";
}

export function profileImageUrl(kind: ProfileKind, updatedAt: number): string {
  return `/api/profile/${kind}?v=${updatedAt}`;
}
