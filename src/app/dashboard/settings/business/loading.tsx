export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading dashboard</p>
      <div className="h-8 w-56 rounded-md bg-line" />
      <div className="h-4 w-96 max-w-full rounded-md bg-line" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 rounded-lg border border-line bg-card" />
        <div className="h-40 rounded-lg border border-line bg-card" />
      </div>
    </div>
  );
}
