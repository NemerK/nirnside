/** Shown the instant a Party link is clicked, until the page's data arrives. */
export default function PartyLoading() {
  return (
    <div className="mx-auto w-full max-w-[1320px]" aria-busy="true" aria-label="Loading">
      <div className="party-shimmer mb-4 h-8 w-64 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="party-shimmer h-44 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
