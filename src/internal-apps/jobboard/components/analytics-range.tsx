"use client";

import { parseAsInteger, useQueryState } from "nuqs";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

export function AnalyticsRange() {
  const [days, setDays] = useQueryState(
    "days",
    parseAsInteger.withDefault(30).withOptions({ shallow: false }),
  );
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Label htmlFor="analytics-days">Time period</Label>
      <NativeSelect
        id="analytics-days"
        className="h-11 min-w-40 bg-card"
        value={[7, 30, 90].includes(days) ? days : 30}
        onChange={(event) => setDays(Number(event.target.value))}
      >
        <NativeSelectOption value={7}>Last 7 days</NativeSelectOption>
        <NativeSelectOption value={30}>Last 30 days</NativeSelectOption>
        <NativeSelectOption value={90}>Last 90 days</NativeSelectOption>
      </NativeSelect>
    </div>
  );
}
