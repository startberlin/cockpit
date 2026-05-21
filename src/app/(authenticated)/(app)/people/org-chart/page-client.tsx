"use client";

import "@xyflow/react/dist/style.css";
import {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
} from "@xyflow/react";
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
  applyFilters,
  buildOrgChart,
  CARD_H,
  CARD_W,
  type OrgNodeData,
} from "@/lib/org-chart";

// ─── Custom node components ───────────────────────────────────────────────────

function PersonFlowNode({ data }: NodeProps<Node<OrgNodeData>>) {
  const first = data.firstName ?? "";
  const last = data.lastName ?? "";
  const initials = `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  const avatarSize = data.userId ? 40 : 32;

  return (
    <div
      style={{
        width: CARD_W,
        minHeight: CARD_H,
        borderRadius: 4,
        border: "1px solid var(--border)",
        background: "var(--card)",
        boxShadow: "var(--shadow-sm)",
        padding: 14,
        display: "flex",
        alignItems: "center",
        gap: 12,
        userSelect: "none",
      }}
    >
      <Avatar style={{ width: avatarSize, height: avatarSize, flexShrink: 0 }}>
        <AvatarImage src={data.image ?? undefined} alt={`${first} ${last}`} />
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
          {first} {last}
        </div>
        {data.roleLabel && (
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginTop: 3,
              lineHeight: 1.35,
              overflowWrap: "anywhere",
            }}
          >
            {data.roleLabel}
          </div>
        )}
        {!data.roleLabel && data.batchNumber != null && (
          <div
            style={{
              fontSize: 12,
              color: "var(--muted-foreground)",
              marginTop: 3,
              lineHeight: 1.35,
            }}
          >
            Batch #{data.batchNumber}
            {data.status === "onboarding" ? " · Onboarding" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function DeptPlaceholderFlowNode({ data }: NodeProps<Node<OrgNodeData>>) {
  const label = data.hasHead
    ? `${data.departmentName} lead in another batch`
    : `No ${data.departmentName} lead assigned`;

  return (
    <div
      style={{
        width: CARD_W,
        minHeight: CARD_H,
        borderRadius: 4,
        border: "1px dashed var(--border)",
        background: "var(--muted)",
        padding: 14,
        display: "flex",
        alignItems: "center",
        userSelect: "none",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "var(--muted-foreground)",
          lineHeight: 1.4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

// Stable references so React Flow doesn't remount on every render
const nodeTypes = {
  officer: PersonFlowNode,
  deptHead: PersonFlowNode,
  member: PersonFlowNode,
  deptPlaceholder: DeptPlaceholderFlowNode,
};

// ─── Conversion helpers ───────────────────────────────────────────────────────

function toFlowNodes(
  orgNodes: ReturnType<typeof buildOrgChart>["nodes"],
): Node[] {
  return orgNodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data,
    selectable: false,
    draggable: false,
    connectable: false,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  }));
}

function toFlowEdges(
  orgEdges: ReturnType<typeof buildOrgChart>["edges"],
): Edge[] {
  return orgEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    style: { stroke: "var(--border)" },
  }));
}

// ─── Main client component ────────────────────────────────────────────────────

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

  const { nodes: allNodes, edges: allEdges } = React.useMemo(
    () => buildOrgChart(users),
    [users],
  );

  const { nodes: filteredOrgNodes, edges: filteredOrgEdges } = React.useMemo(
    () => applyFilters(allNodes, allEdges, { batchFilter }),
    [allNodes, allEdges, batchFilter],
  );

  const flowNodes = React.useMemo(
    () => toFlowNodes(filteredOrgNodes),
    [filteredOrgNodes],
  );

  const flowEdges = React.useMemo(
    () => toFlowEdges(filteredOrgEdges),
    [filteredOrgEdges],
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filter bar — same width as page content */}
      <div className="flex items-center gap-3">
        <Select
          value={batchFilter != null ? String(batchFilter) : "all"}
          onValueChange={(val) => {
            setBatchFilter(val === "all" ? null : Number(val));
          }}
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

      {/* Full-width canvas — breaks out of max-w-4xl container */}
      <div
        className="flex-1 min-h-0 border overflow-hidden"
        style={{
          marginLeft:
            "calc(-1 * max(0rem, (100vw - var(--sidebar-width, 16rem) - 56rem) / 2) - 1.5rem)",
          width: "calc(100vw - var(--sidebar-width, 16rem))",
        }}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: false }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
