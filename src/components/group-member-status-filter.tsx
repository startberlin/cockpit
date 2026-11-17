"use client";

import { parseAsInteger, useQueryStates } from "nuqs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { peopleStatusParser } from "@/lib/people-search-params";
import { getPeopleStatusInfo, PEOPLE_STATUSES } from "@/lib/user-status";

const groupStatusParams = {
  status: peopleStatusParser,
  page: parseAsInteger.withDefault(1),
};

export function GroupMemberStatusFilter() {
  const [{ status }, setFilters] = useQueryStates(groupStatusParams, {
    shallow: false,
  });
  return (
    <Select
      value={status ?? "all"}
      onValueChange={(value) =>
        setFilters({ status: peopleStatusParser.parse(value), page: null })
      }
    >
      <SelectTrigger aria-label="Member status" size="sm">
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
