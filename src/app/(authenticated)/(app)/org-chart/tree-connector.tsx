// L-shaped lines connecting a dept head to its members.
export function TreeConnector({ isLast }: { isLast: boolean }) {
  return (
    <div style={{ position: "relative", width: 26, flexShrink: 0 }}>
      {/* Vertical segment — runs from the top down to the card midpoint (or to the bottom for non-last) */}
      <div
        style={{
          position: "absolute",
          left: 13,
          top: 0,
          bottom: isLast ? "50%" : 0,
          width: 1,
          background: "var(--border)",
        }}
      />
      {/* Horizontal stub — enters the card at its vertical midpoint */}
      <div
        style={{
          position: "absolute",
          left: 13,
          right: 0,
          top: "50%",
          height: 1,
          background: "var(--border)",
        }}
      />
    </div>
  );
}
