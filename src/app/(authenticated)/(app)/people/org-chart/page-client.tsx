"use client";

import { Crosshair } from "lucide-react";
import * as React from "react";
import {
  type ReactZoomPanPinchRef,
  TransformComponent,
  TransformWrapper,
} from "react-zoom-pan-pinch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { OrgChartUser } from "@/db/people";
import {
  buildOrgChart,
  type OrgChartDept,
  type OrgChartPerson,
} from "@/lib/org-chart";

// ─── Card primitives ──────────────────────────────────────────────────────────

function PersonCard({
  person,
  subtitle,
  avatarSize = 40,
}: {
  person: OrgChartPerson;
  subtitle?: string;
  avatarSize?: number;
}) {
  const initials =
    `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div
      style={{
        borderRadius: 4,
        border: "1px solid var(--border)",
        background: "var(--card)",
        boxShadow: "var(--shadow-sm)",
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Avatar style={{ width: avatarSize, height: avatarSize, flexShrink: 0 }}>
        <AvatarImage
          src={person.image ?? undefined}
          alt={`${person.firstName} ${person.lastName}`}
        />
        <AvatarFallback style={{ fontSize: avatarSize < 36 ? 11 : 13 }}>
          {initials}
        </AvatarFallback>
      </Avatar>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
        >
          {person.firstName} {person.lastName}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginTop: 3,
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function PlaceholderCard({ text }: { text: string }) {
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

// ─── Tree connector ───────────────────────────────────────────────────────────

// L-shaped lines connecting a dept head to its members.
function TreeConnector({ isLast }: { isLast: boolean }) {
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

// ─── Department cells ─────────────────────────────────────────────────────────

// Renders the head card for a department. Rendered in grid row 1 so CSS grid
// normalises all head cells to the same height. The flexible stub below the
// card extends the connector line down to the members row.
function DeptHeadCell({ dept }: { dept: OrgChartDept }) {
  const { head, departmentName, members } = dept;
  const hasMembers = !!head && members.length > 0;

  return (
    // Inner grid: card row gets 1fr (fills outer-grid-stretched height minus stub),
    // stub row is fixed 14px. This forces the card div to the same height in every
    // column once the outer grid equalises row 1 across all cells.
    <div style={{ display: "grid", gridTemplateRows: "1fr 14px" }}>
      {head ? (
        <PersonCard person={head} subtitle={head.roleLabel} />
      ) : (
        <PlaceholderCard text={`No Head of ${departmentName} assigned`} />
      )}
      <div style={{ position: "relative" }}>
        {hasMembers && (
          <div
            style={{
              position: "absolute",
              left: 13,
              top: 0,
              bottom: 0,
              width: 1,
              background: "var(--border)",
            }}
          />
        )}
      </div>
    </div>
  );
}

// Renders the member list for a department. Rendered in grid row 2, directly
// below DeptHeadCell with no row gap, so tree connectors flow from the stub.
function DeptMembersCell({ dept }: { dept: OrgChartDept }) {
  const { head, members } = dept;

  if (!head) return <div />;

  const emptyMessage = "No team members yet";

  if (members.length === 0) {
    return (
      <div
        style={{
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            padding: 14,
            borderRadius: 4,
            border: "1px dashed var(--border)",
            background: "var(--muted)",
            fontSize: 12,
            color: "var(--muted-foreground)",
            textAlign: "center",
          }}
        >
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div>
      {members.map((member, i) => (
        <div
          key={member.userId}
          style={{ display: "flex", alignItems: "stretch" }}
        >
          <TreeConnector isLast={i === members.length - 1} />
          <div style={{ flex: 1, minWidth: 0, padding: "6px 0" }}>
            <PersonCard
              person={member}
              subtitle={
                member.batchNumber != null
                  ? `Batch #${member.batchNumber}${member.status === "onboarding" ? " · Onboarding" : ""}`
                  : undefined
              }
              avatarSize={32}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page client ──────────────────────────────────────────────────────────────

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
