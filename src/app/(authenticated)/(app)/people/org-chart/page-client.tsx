"use client";

import { Crosshair } from "lucide-react";
import * as React from "react";
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";
import type { OrgChartUser } from "@/db/people";
import { buildOrgChart } from "@/lib/org-chart";
import { DeptHeadCell } from "./dept-head-cell";
import { DeptMembersCell } from "./dept-members-cell";
import { PersonCard } from "./person-card";

const OFFICER_W = 240;
const DEPT_COL_W = 240;
const COL_GAP = 16;
const DEPT_COUNT = 5;
const SIDE_PAD = 120; // padding inside canvas on each side — visible at pan extremes
const TOP_PAD = 32;
// Canvas is wider than most viewports so centering gives natural side breathing room.
const CANVAS_W =
  DEPT_COUNT * DEPT_COL_W + (DEPT_COUNT - 1) * COL_GAP + SIDE_PAD * 2;

interface OrgChartPageClientProps {
  users: OrgChartUser[];
}

export default function OrgChartPageClient({ users }: OrgChartPageClientProps) {
  const transformRef = React.useRef<ReactZoomPanPinchRef>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  // Mouse wheel → horizontal pan. Must be non-passive to allow preventDefault
  // (which stops the page from scrolling while hovering the canvas).
  React.useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const onWheel = (e: WheelEvent) => {
      // Only intercept horizontal scroll (trackpad two-finger swipe left/right).
      // Vertical scroll is left to the browser so the page scrolls normally.
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const state = transformRef.current?.state;
      if (!state) return;
      transformRef.current?.setTransform(state.positionX - e.deltaX, 0, 1, 0);
    };

    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, []);

  const { officers, departments } = React.useMemo(
    () => buildOrgChart(users),
    [users],
  );

  return (
    <div>
      {/* Controls bar — constrained to the same max-w-4xl as the title */}
      <div className="mx-auto w-full max-w-4xl px-6 pb-4 flex justify-end">
        <button
          type="button"
          aria-label="Center org chart"
          title="Center org chart"
          onClick={() => transformRef.current?.centerView(1, 300)}
          className="h-9 px-2.5 inline-flex shrink-0 items-center gap-1.5 border rounded-md bg-background transition-colors text-xs border-input text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Crosshair size={14} />
        </button>
      </div>

      {/* Full-width panning area — no breakout math needed because this page
          has no max-w-4xl wrapper (it lives outside the (default) layout group). */}
      <div ref={wrapperRef} style={{ width: "100%", overflowX: "hidden" }}>
        {/* zoom off, pan only, free panning (no bounds enforced) */}
        <TransformWrapper
          ref={transformRef}
          initialScale={1}
          minScale={1}
          maxScale={1}
          wheel={{ disabled: true }}
          pinch={{ disabled: true }}
          doubleClick={{ disabled: true }}
          limitToBounds={false}
          panning={{ lockAxisY: true }}
        >
          <TransformComponent wrapperStyle={{ width: "100%", cursor: "grab" }}>
            <div
              style={{
                width: CANVAS_W,
                padding: `${TOP_PAD}px ${SIDE_PAD}px 40px`,
              }}
            >
              {/* Officers — centered row, grid equalises card heights */}
              {officers.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${officers.length}, ${OFFICER_W}px)`,
                    justifyContent: "center",
                    gap: COL_GAP,
                    marginBottom: 32,
                  }}
                >
                  {officers.map((officer) => (
                    <PersonCard
                      key={officer.userId}
                      person={officer}
                      subtitle={officer.roleLabel}
                    />
                  ))}
                </div>
              )}

              {/* Department grid: heads in row 1 (equalised height), members in row 2.
                columnGap only — rowGap stays 0 so the stub connects to tree connectors. */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${DEPT_COUNT}, 1fr)`,
                  columnGap: COL_GAP,
                }}
              >
                {departments.map((dept) => (
                  <DeptHeadCell key={dept.departmentId} dept={dept} />
                ))}
                {departments.map((dept) => (
                  <DeptMembersCell key={`m-${dept.departmentId}`} dept={dept} />
                ))}
              </div>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>
    </div>
  );
}
