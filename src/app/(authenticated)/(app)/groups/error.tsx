"use client";

export default function GroupsError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <p className="text-muted-foreground">Failed to load groups.</p>
      <button type="button" onClick={reset} className="text-sm underline">
        Try again
      </button>
    </div>
  );
}
