export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl" aria-busy="true" aria-live="polite">
      <div className="h-8 w-56 rounded-lg bg-surface-2" />
      <div className="mt-3 h-4 w-80 max-w-full rounded bg-surface-2/80" />
      <div className="mt-6 h-72 rounded-xl border border-border bg-surface/40" />
    </div>
  );
}
