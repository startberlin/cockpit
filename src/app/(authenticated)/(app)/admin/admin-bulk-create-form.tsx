"use client";

import { RefreshCwIcon } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BatchSelect } from "@/components/batch-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department, UserStatus } from "@/db/schema";
import { DEPARTMENTS } from "@/lib/enums";
import { bulkCreateUserAction } from "./bulk-create-user-action";
import type { BulkCreateEntry } from "./bulk-create-user-schema";
import { generateRandomEntries } from "./generate-random-entries";

interface AdminBulkCreateFormProps {
  batches: { number: number }[];
}

const MIN_COUNT = 1;
const MAX_COUNT = 50;
const DEFAULT_COUNT = 5;

export function AdminBulkCreateForm({ batches }: AdminBulkCreateFormProps) {
  const [count, setCount] = useState(DEFAULT_COUNT);
  const [entries, setEntries] = useState<BulkCreateEntry[]>(() =>
    generateRandomEntries(DEFAULT_COUNT),
  );
  const [department, setDepartment] = useState<Department | "">("");
  const [status, setStatus] = useState<UserStatus>("onboarding");
  const [batchNumber, setBatchNumber] = useState<number | undefined>(undefined);

  useEffect(() => {
    setEntries(generateRandomEntries(count));
  }, [count]);

  const requiresDepartment = status === "member" || status === "onboarding";
  const departmentValue: Department | null = department ? department : null;
  const departmentMissing = requiresDepartment && !departmentValue;

  const action = useAction(bulkCreateUserAction, {
    onSuccess: ({ data }) => {
      if (data) {
        toast.success(
          `Scheduled ${data.scheduled} test user${data.scheduled === 1 ? "" : "s"}. Check Inngest dev UI for progress.`,
        );
        setEntries(generateRandomEntries(count));
      }
    },
    onError: ({ error }) => {
      toast.error(
        error.serverError ?? error.thrownError?.message ?? "Failed to schedule",
      );
    },
  });

  const submit = () => {
    if (entries.length === 0) return;
    action.execute({
      entries,
      department: requiresDepartment ? departmentValue : null,
      status,
      ...(batchNumber != null ? { batchNumber } : {}),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Schedules test users with randomly generated names and fake emails. For
        development and testing only.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="bulk-count">How many users?</Label>
          <Input
            id="bulk-count"
            type="number"
            min={MIN_COUNT}
            max={MAX_COUNT}
            value={count}
            onChange={(e) => {
              const next = Number.parseInt(e.target.value, 10);
              if (Number.isNaN(next)) return;
              setCount(Math.min(MAX_COUNT, Math.max(MIN_COUNT, next)));
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Batch</Label>
          <BatchSelect
            batches={batches}
            value={batchNumber}
            onChange={setBatchNumber}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as UserStatus)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="supporting_alumni">
                Supporting alumni
              </SelectItem>
              <SelectItem value="alumni">Alumni</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {requiresDepartment && (
          <div className="flex flex-col gap-1.5">
            <Label>Department</Label>
            <Select
              value={department}
              onValueChange={(v) => setDepartment(v as Department)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DEPARTMENTS).map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="rounded-md border p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            Preview ({entries.length} user{entries.length === 1 ? "" : "s"})
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEntries(generateRandomEntries(count))}
          >
            <RefreshCwIcon className="size-3.5" />
            Regenerate
          </Button>
        </div>
        <ul className="text-sm flex flex-col gap-0.5 max-h-48 overflow-y-auto">
          {entries.map((entry, idx) => (
            <li
              key={`${entry.personalEmail}-${idx}`}
              className="text-muted-foreground"
            >
              {entry.firstName} {entry.lastName} — {entry.personalEmail}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={submit}
          disabled={
            action.isPending || entries.length === 0 || departmentMissing
          }
        >
          {action.isPending
            ? "Scheduling…"
            : `Schedule ${entries.length} test user${entries.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
