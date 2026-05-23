"use client";

export default function DirectoryError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <p className="text-muted-foreground">Failed to load directory.</p>
      <button type="button" onClick={reset} className="text-sm underline">
        Try again
      </button>
    </div>
  );
}
