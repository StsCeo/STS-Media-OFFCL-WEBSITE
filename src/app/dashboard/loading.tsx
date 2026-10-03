export default function DashboardSegmentLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading</p>
      <div className="h-8 w-48 rounded-md bg-line" />
      <div className="h-32 rounded-lg border border-line bg-card" />
    </div>
  );
}
