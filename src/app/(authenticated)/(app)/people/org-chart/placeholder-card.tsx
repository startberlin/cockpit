export function PlaceholderCard({ text }: { text: string }) {
  return (
    <div
      style={{
        minHeight: 68,
        borderRadius: 4,
        border: "1px dashed var(--border)",
        background: "var(--muted)",
        padding: 14,
        display: "flex",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: 13,
          color: "var(--muted-foreground)",
          lineHeight: 1.4,
        }}
      >
        {text}
      </span>
    </div>
  );
}
