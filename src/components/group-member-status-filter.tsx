"use client";

import { useQueryStates } from "nuqs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  groupPeopleParams,
  peopleStatusParser,
} from "@/lib/people-search-params";
import { getPeopleStatusInfo, PEOPLE_STATUSES } from "@/lib/user-status";

export function GroupMemberStatusFilter() {
  const [{ status }, setFilters] = useQueryStates(groupPeopleParams, {
    shallow: false,
  });
  return (
    <Select
      value={status ?? "all"}
      onValueChange={(value) =>
        setFilters({ status: peopleStatusParser.parse(value), page: null })
      }
    >
      <SelectTrigger aria-label="Member status" size="sm" className="min-w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All statuses</SelectItem>
        {PEOPLE_STATUSES.map((value) => (
          <SelectItem key={value} value={value}>
            {getPeopleStatusInfo(value).label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
