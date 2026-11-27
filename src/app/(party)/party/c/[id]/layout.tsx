import { CharacterBar } from "@/components/party/character-bar";

/** Every character page: the character bar (switcher and sections), then the section. */
export default async function CharacterLayout({ children, params }: LayoutProps<"/party/c/[id]">) {
  const { id } = await params;
  return (
    <>
      <CharacterBar id={decodeURIComponent(id)} />
      {children}
    </>
  );
}
