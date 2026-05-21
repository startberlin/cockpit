import { Skeleton } from "@/components/ui/skeleton";

const SIDE_PAD = 120;
const COL_GAP = 16;
const DEPT_COUNT = 5;

export default function OrgChartLoading() {
  return (
    <div>
      {/* Title — mirrors page.tsx */}
      <div className="mx-auto w-full max-w-4xl p-6 pb-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Controls bar — mirrors page-client.tsx */}
      <div className="mx-auto w-full max-w-4xl px-6 pb-4 flex justify-end">
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Canvas — full width, matches SIDE_PAD / TOP_PAD / grid structure */}
      <div
        style={{
          overflow: "hidden",
          padding: `32px ${SIDE_PAD}px 40px`,
        }}
      >
        {/* Officers row */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: COL_GAP,
            marginBottom: 32,
          }}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-[200px] shrink-0" />
          ))}
        </div>

        {/* Department grid — heads in row 1, members in row 2 (matches actual grid) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${DEPT_COUNT}, 1fr)`,
            columnGap: COL_GAP,
          }}
        >
          {/* Dept head cards */}
          {Array.from({ length: DEPT_COUNT }).map((_, i) => (
            <div
              key={i}
              style={{ display: "grid", gridTemplateRows: "1fr 14px" }}
            >
              <Skeleton className="h-[68px]" />
              <div />
            </div>
          ))}

          {/* Member lists — vary counts to look realistic */}
          {[4, 3, 4, 3, 4].map((count, i) => (
            <div key={`m-${i}`} className="flex flex-col gap-1.5 pt-1.5">
              {Array.from({ length: count }).map((_, j) => (
                <Skeleton key={j} className="h-[52px]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
