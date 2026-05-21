"use client";

import { parseAsInteger, useQueryState } from "nuqs";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrgChartUser } from "@/db/people";
import {
  applyBatchFilter,
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

// ─── Department column ────────────────────────────────────────────────────────

function DeptColumn({
  dept,
  batchFilter,
}: {
  dept: OrgChartDept;
  batchFilter: number | null;
}) {
  const { head, headExists, members, departmentName } = dept;

  const headCard = head ? (
    <PersonCard person={head} subtitle={head.roleLabel} />
  ) : headExists ? (
    <PlaceholderCard text={`${departmentName} lead in another batch`} />
  ) : (
    <PlaceholderCard text={`No ${departmentName} lead assigned`} />
  );

  const emptyMessage =
    batchFilter != null
      ? `No Batch #${batchFilter} members`
      : "No team members yet";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {headCard}

      {head && members.length > 0 && (
        <>
          {/* Short vertical stub from head card down to the first connector */}
          <div style={{ height: 14, position: "relative" }}>
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
          </div>

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
        </>
      )}

      {head && members.length === 0 && (
        <div
          style={{
            marginTop: 12,
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
      )}
    </div>
  );
}

// ─── Page client ──────────────────────────────────────────────────────────────

// Column sizing constants
const COLUMN_W = 200;
const COL_GAP = 16;
const DEPT_COUNT = 5;
// Minimum inner content width so columns never shrink below COLUMN_W
const MIN_CONTENT_W = DEPT_COUNT * COLUMN_W + (DEPT_COUNT - 1) * COL_GAP;

interface OrgChartPageClientProps {
  users: OrgChartUser[];
  batches: { number: number }[];
}

export default function OrgChartPageClient({
  users,
  batches,
}: OrgChartPageClientProps) {
  const [batchFilter, setBatchFilter] = useQueryState(
    "batch",
    parseAsInteger.withOptions({ shallow: true, clearOnDefault: true }),
  );

  const data = React.useMemo(() => buildOrgChart(users), [users]);

  const { officers, departments } = React.useMemo(
    () => applyBatchFilter(data, batchFilter),
    [data, batchFilter],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Batch filter — stays within normal page content width */}
      <div>
        <Select
          value={batchFilter != null ? String(batchFilter) : "all"}
          onValueChange={(val) =>
            setBatchFilter(val === "all" ? null : Number(val))
          }
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="All batches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All batches</SelectItem>
            {batches.map((b) => (
              <SelectItem key={b.number} value={String(b.number)}>
                Batch #{b.number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Full-width horizontally scrollable canvas */}
      <div
        style={{
          overflowX: "auto",
          // Break out of max-w-4xl to use the full sidebar-inset width
          marginLeft:
            "calc(-1 * max(0rem, (100vw - var(--sidebar-width, 16rem) - 56rem) / 2) - 1.5rem)",
          width: "calc(100vw - var(--sidebar-width, 16rem))",
        }}
      >
        <div
          style={{
            minWidth: MIN_CONTENT_W + 48, // +48 for left+right padding
            padding: "0 24px 32px",
          }}
        >
          {/* Officers — centered row, no edges to anything below */}
          {officers.length > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: COL_GAP,
                marginBottom: 32,
              }}
            >
              {officers.map((officer) => (
                <div key={officer.userId} style={{ width: COLUMN_W }}>
                  <PersonCard person={officer} subtitle={officer.roleLabel} />
                </div>
              ))}
            </div>
          )}

          {/* Department columns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${DEPT_COUNT}, 1fr)`,
              gap: COL_GAP,
              alignItems: "start",
            }}
          >
            {departments.map((dept) => (
              <DeptColumn
                key={dept.departmentId}
                dept={dept}
                batchFilter={batchFilter}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
