"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import * as React from "react";
import { PeopleTable } from "@/components/people-table";
import { Button } from "@/components/ui/button";
import type { PaginatedUsers } from "@/db/people";
import type { LegalMembershipState } from "@/db/schema/auth";

const SORT_OPTIONS = ["name", "joinDate"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const LEGAL_MEMBERSHIP_OPTIONS: {
  label: string;
  value: LegalMembershipState;
}[] = [
  { label: "Not a member", value: "not_member" },
  { label: "Active member", value: "active_member" },
  { label: "Former member", value: "former_member" },
];

interface FilterPreset {
  label: string;
  status: string;
}

const ALWAYS_VISIBLE_PRESETS: FilterPreset[] = [
  { label: "Active", status: "member,supporting_alumni" },
  { label: "Onboarding", status: "onboarding" },
];

const INACTIVE_PRESETS: FilterPreset[] = [
  { label: "Alumni", status: "alumni" },
  { label: "Cancelled / Former", status: "cancelled" },
];

interface AdminDirectoryPageClientProps {
  usersPromise: Promise<PaginatedUsers>;
  initialSearch: string;
  canViewInactive: boolean;
  isDeptHeadScoped: boolean;
  initialLegalMembership?: LegalMembershipState;
}

function UsersTableSection({
  usersPromise,
  initialSearch,
}: {
  usersPromise: Promise<PaginatedUsers>;
  initialSearch: string;
}) {
  const { users, total, pageCount } = React.use(usersPromise);

  return (
    <PeopleTable
      data={users}
      total={total}
      pageCount={pageCount}
      pendingActions={[]}
      initialSearch={initialSearch}
    />
  );
}

export default function AdminDirectoryPageClient({
  usersPromise,
  initialSearch,
  canViewInactive,
  initialLegalMembership,
}: AdminDirectoryPageClientProps) {
  const [status, setStatus] = useQueryState(
    "status",
    parseAsString.withOptions({ shallow: false, clearOnDefault: true }),
  );
  const [legalMembership, setLegalMembership] = useQueryState(
    "legalMembership",
    parseAsString
      .withDefault(initialLegalMembership ?? "")
      .withOptions({ shallow: false, clearOnDefault: true }),
  );
  const [sortBy, setSortBy] = useQueryState(
    "sortBy",
    parseAsStringLiteral(SORT_OPTIONS)
      .withDefault("name")
      .withOptions({ shallow: false, clearOnDefault: true }),
  );

  const presets = canViewInactive
    ? [...ALWAYS_VISIBLE_PRESETS, ...INACTIVE_PRESETS]
    : ALWAYS_VISIBLE_PRESETS;

  const activePreset = presets.find((p) => p.status === status) ?? null;

  const handlePreset = (preset: FilterPreset) => {
    if (activePreset?.status === preset.status) {
      setStatus(null);
    } else {
      setStatus(preset.status);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between pb-4">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All members as records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Button
            variant={sortBy === "name" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSortBy("name" as SortOption)}
          >
            Name
          </Button>
          <Button
            variant={sortBy === "joinDate" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSortBy("joinDate" as SortOption)}
          >
            Join date
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {presets.map((preset) => (
          <Button
            key={preset.status}
            variant={
              activePreset?.status === preset.status ? "secondary" : "outline"
            }
            size="sm"
            onClick={() => handlePreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <span className="text-xs text-muted-foreground">Legal status:</span>
        {LEGAL_MEMBERSHIP_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={legalMembership === opt.value ? "secondary" : "outline"}
            size="sm"
            onClick={() =>
              setLegalMembership(legalMembership === opt.value ? "" : opt.value)
            }
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <React.Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <UsersTableSection
          usersPromise={usersPromise}
          initialSearch={initialSearch}
        />
      </React.Suspense>
    </>
  );
}
