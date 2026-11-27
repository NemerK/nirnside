/**
 * Re-mounted on every Party navigation: the new page eases in, so moving
 * between modules reads as one continuous place rather than a page reload.
 */
export default function PartyTemplate({ children }: { children: React.ReactNode }) {
  return <div className="party-enter">{children}</div>;
}
