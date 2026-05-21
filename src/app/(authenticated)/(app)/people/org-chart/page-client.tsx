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
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrgChartUser } from "@/db/people";
import type { Department } from "@/db/schema/auth";
import {
  applyFilters,
  buildOrgChart,
  CARD_H,
  CARD_W,
  type OrgNodeData,
} from "@/lib/org-chart";

// ─── Layout constants (must match org-chart.ts) ───────────────────────────────

const DEPT_HEADER_H = 44;

// ─── Custom node components ───────────────────────────────────────────────────

function PersonFlowNode({ data }: NodeProps<Node<OrgNodeData, "person">>) {
  const first = data.firstName ?? "";
  const last = data.lastName ?? "";
  const initials = `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();

  return (
    <div
      style={{ width: CARD_W, minHeight: CARD_H }}
      className="rounded-lg border bg-card p-3 flex items-start gap-2.5 shadow-sm select-none"
    >
      <Avatar size="default">
        <AvatarImage src={data.image ?? undefined} alt={`${first} ${last}`} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-xs leading-tight line-clamp-2">
          {first} {last}
        </p>
        {data.batchNumber != null && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Batch #{data.batchNumber}
          </p>
        )}
        {data.roleLabel && (
          <div className="mt-1.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {data.roleLabel}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

function DeptHeaderFlowNode({
  data,
}: NodeProps<Node<OrgNodeData & { isCollapsed: boolean }, "deptHeader">>) {
  return (
    <div
      style={{ width: CARD_W, height: DEPT_HEADER_H }}
      className="rounded-md border bg-muted/60 px-3 flex items-center justify-between gap-2 text-sm font-semibold cursor-pointer hover:bg-muted transition-colors select-none"
    >
      <span className="truncate">{data.departmentName}</span>
      {data.isCollapsed ? (
        <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </div>
  );
}

// Defined outside the component so React Flow gets a stable reference
const nodeTypes = {
  person: PersonFlowNode,
  deptHeader: DeptHeaderFlowNode,
};

// ─── Conversion helpers ───────────────────────────────────────────────────────

function toFlowNodes(
  orgNodes: ReturnType<typeof buildOrgChart>["nodes"],
  collapsedDepts: ReadonlySet<Department>,
): Node[] {
  return orgNodes.map((n) => {
    const base = {
      id: n.id,
      position: n.position,
      selectable: false,
      draggable: false,
      connectable: false,
    };

    if (n.type === "deptHeader") {
      return {
        ...base,
        type: "deptHeader" as const,
        data: {
          ...n.data,
          isCollapsed: n.data.departmentId
            ? collapsedDepts.has(n.data.departmentId)
            : false,
        },
      };
    }

    return {
      ...base,
      type: "person" as const,
      data: n.data,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    };
  });
}

function toFlowEdges(
  orgEdges: ReturnType<typeof buildOrgChart>["edges"],
): Edge[] {
  return orgEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "smoothstep",
    style: { stroke: "hsl(var(--border))" },
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

  const [collapsedDepts, setCollapsedDepts] = React.useState<Set<Department>>(
    () => new Set(),
  );

  const { nodes: allNodes, edges: allEdges } = React.useMemo(
    () => buildOrgChart(users),
    [users],
  );

  const { nodes: filteredOrgNodes, edges: filteredOrgEdges } = React.useMemo(
    () => applyFilters(allNodes, allEdges, { batchFilter, collapsedDepts }),
    [allNodes, allEdges, batchFilter, collapsedDepts],
  );

  const flowNodes = React.useMemo(
    () => toFlowNodes(filteredOrgNodes, collapsedDepts),
    [filteredOrgNodes, collapsedDepts],
  );

  const flowEdges = React.useMemo(
    () => toFlowEdges(filteredOrgEdges),
    [filteredOrgEdges],
  );

  const handleNodeClick = React.useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (node.type !== "deptHeader" && node.type !== "person") return;
      const deptId = (node.data as OrgNodeData).departmentId;
      if (!deptId) return;
      // Only dept header nodes and dept head cards should toggle collapse
      const orgNode = allNodes.find((n) => n.id === node.id);
      if (orgNode?.type !== "deptHeader" && orgNode?.type !== "deptHead")
        return;

      setCollapsedDepts((prev) => {
        const next = new Set(prev);
        if (next.has(deptId)) {
          next.delete(deptId);
        } else {
          next.add(deptId);
        }
        return next;
      });
    },
    [allNodes],
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Filter bar */}
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

      {/* Canvas */}
      <div className="flex-1 min-h-0 rounded-lg border overflow-hidden">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeClick={handleNodeClick}
          proOptions={{ hideAttribution: false }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
