"use client";

import { AlertCircleIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";
import * as React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { userStatus } from "@/db/schema/auth";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";
import { generateCompanyEmail } from "@/lib/google-workspace/email";
import { createUserAction } from "./create-user-action";
import {
  type CreateUserFormData,
  createUserSchema,
} from "./create-user-schema";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CsvRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  personalEmail: string;
  department: string | null;
  status: string;
  batchNumber: number | null;
  companyEmail: string;
  errors: string[];
}

type Phase =
  | { name: "idle" }
  | { name: "parsing" }
  | { name: "review"; rows: CsvRow[]; hasErrors: boolean }
  | { name: "processing"; rows: CsvRow[]; current: number; total: number }
  | { name: "done"; succeeded: number; failed: string[] };

// ── CSV parsing ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur.trim());
  return fields;
}

const COLUMN_ALIASES: Record<string, string> = {
  "first name": "firstName",
  firstname: "firstName",
  "last name": "lastName",
  lastname: "lastName",
  email: "personalEmail",
  "e-mail": "personalEmail",
  "personal email": "personalEmail",
  department: "department",
  status: "status",
  batch: "batchNumber",
  "batch number": "batchNumber",
  "batch #": "batchNumber",
};

const REQUIRED_FIELDS = ["firstName", "lastName", "personalEmail", "status"];

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  personalEmail: "Email",
  status: "Status",
};

function normalizeDept(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (DEPARTMENT_IDS.includes(lower as (typeof DEPARTMENT_IDS)[number])) {
    return lower;
  }
  for (const [id, name] of Object.entries(DEPARTMENT_NAMES)) {
    if (name.toLowerCase() === lower) return id;
  }
  return trimmed;
}

function validateRow(
  raw: Record<string, string>,
  rowNumber: number,
  batches: { number: number }[],
): CsvRow {
  const firstName = raw.firstName?.trim() ?? "";
  const lastName = raw.lastName?.trim() ?? "";
  const personalEmail = raw.personalEmail?.trim() ?? "";
  const statusRaw = raw.status?.trim().toLowerCase() ?? "";
  const batchRaw = raw.batchNumber?.trim() ?? "";

  // Department normalization: schema cannot convert display names to IDs
  const department = normalizeDept(raw.department?.trim() ?? "");
  const isValidDept =
    department !== null &&
    DEPARTMENT_IDS.includes(department as (typeof DEPARTMENT_IDS)[number]);

  // Batch existence: schema cannot verify a number exists in the current batch list
  let batchNumber: number | null = null;
  const batchErrors: string[] = [];
  if (batchRaw) {
    const parsed = parseInt(batchRaw, 10);
    if (Number.isNaN(parsed) || String(parsed) !== batchRaw) {
      batchErrors.push(`Invalid batch number: "${batchRaw}"`);
    } else if (!batches.some((b) => b.number === parsed)) {
      batchErrors.push(`Batch #${parsed} does not exist`);
    } else {
      batchNumber = parsed;
    }
  }

  // Generate company email so the full createUserSchema can be satisfied
  const companyEmail =
    firstName && lastName ? generateCompanyEmail(firstName, lastName) : "";

  // Delegate all other validation to the same schema used by createUserAction
  const schemaResult = createUserSchema.safeParse({
    firstName,
    lastName,
    personalEmail,
    companyEmail,
    department: isValidDept ? department : null,
    status: statusRaw,
    batchNumber: batchNumber ?? undefined,
  });

  const errors: string[] = [];
  if (!schemaResult.success) {
    for (const issue of schemaResult.error.issues) {
      // companyEmail is auto-generated — its errors are already covered by firstName/lastName
      if (issue.path[0] === "companyEmail") continue;
      errors.push(issue.message);
    }
  }
  errors.push(...batchErrors);

  return {
    rowNumber,
    firstName,
    lastName,
    personalEmail,
    department: isValidDept ? department : null,
    status: statusRaw,
    batchNumber,
    companyEmail,
    errors,
  };
}

async function parseAndValidate(
  file: File,
  batches: { number: number }[],
): Promise<
  | { ok: true; rows: CsvRow[]; hasErrors: boolean }
  | { ok: false; error: string }
> {
  const text = await file.text();
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());

  if (lines.length < 2) {
    return { ok: false, error: "The file is empty or has no data rows." };
  }

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const fieldMap: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const alias = COLUMN_ALIASES[headers[i]];
    if (alias) fieldMap[i] = alias;
  }

  const mapped = Object.values(fieldMap);
  const missing = REQUIRED_FIELDS.filter((f) => !mapped.includes(f));
  if (missing.length > 0) {
    const labels = missing.map((f) => REQUIRED_FIELD_LABELS[f] ?? f);
    return {
      ok: false,
      error: `Missing required columns: ${labels.join(", ")}`,
    };
  }

  const rows = lines.slice(1).map((line, i) => {
    const cols = parseCSVLine(line);
    const raw: Record<string, string> = {};
    for (const [colIdx, fieldName] of Object.entries(fieldMap)) {
      raw[fieldName] = cols[Number(colIdx)] ?? "";
    }
    return validateRow(raw, i + 2, batches);
  });

  return { ok: true, rows, hasErrors: rows.some((r) => r.errors.length > 0) };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface CsvBatchStepProps {
  batches: { number: number }[];
  onBack: () => void;
  onSuccess?: () => void;
  onDone?: () => void;
}

export function CsvBatchStep({
  batches,
  onBack,
  onSuccess,
  onDone,
}: CsvBatchStepProps) {
  const [phase, setPhase] = React.useState<Phase>({ name: "idle" });
  const [parseError, setParseError] = React.useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setPhase({ name: "parsing" });

    let result: Awaited<ReturnType<typeof parseAndValidate>>;
    try {
      result = await parseAndValidate(file, batches);
    } catch (err) {
      console.error("CSV parse error:", err);
      setParseError(
        err instanceof Error ? err.message : "Failed to parse file",
      );
      setPhase({ name: "idle" });
      e.target.value = "";
      return;
    }

    if (!result.ok) {
      setParseError(result.error);
      setPhase({ name: "idle" });
      e.target.value = "";
      return;
    }

    setPhase({
      name: "review",
      rows: result.rows,
      hasErrors: result.hasErrors,
    });
  };

  const handleReset = () => {
    setPhase({ name: "idle" });
    setParseError(null);
  };

  const handleSubmit = async () => {
    if (phase.name !== "review" || phase.hasErrors) return;

    const { rows } = phase;
    const failures: string[] = [];

    setPhase({ name: "processing", rows, current: 0, total: rows.length });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      setPhase((prev) =>
        prev.name === "processing" ? { ...prev, current: i + 1 } : prev,
      );

      try {
        const result = await createUserAction({
          firstName: row.firstName,
          lastName: row.lastName,
          personalEmail: row.personalEmail,
          companyEmail: row.companyEmail,
          batchNumber: row.batchNumber ?? undefined,
          department:
            (row.department as CreateUserFormData["department"]) ?? null,
          status: row.status as CreateUserFormData["status"],
        });

        if (result?.serverError) {
          failures.push(
            `Row ${row.rowNumber} (${row.firstName} ${row.lastName}): ${result.serverError}`,
          );
        }
      } catch (err) {
        failures.push(
          `Row ${row.rowNumber} (${row.firstName} ${row.lastName}): ${err instanceof Error ? err.message : "Unknown error"}`,
        );
      }
    }

    setPhase({
      name: "done",
      succeeded: rows.length - failures.length,
      failed: failures,
    });

    if (failures.length === 0) {
      onSuccess?.();
    }
  };

  if (phase.name === "processing") {
    const pct = Math.round((phase.current / phase.total) * 100);
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
          Creating user {phase.current} of {phase.total}…
        </div>
        <Progress value={pct} />
      </div>
    );
  }

  if (phase.name === "done") {
    return (
      <div className="flex flex-col gap-5">
        {phase.succeeded > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm dark:border-green-900 dark:bg-green-950/30">
            <CheckCircle2Icon className="size-4 shrink-0 text-green-600" />
            <span>
              <span className="font-medium">{phase.succeeded}</span> user
              {phase.succeeded !== 1 ? "s" : ""} created successfully.
            </span>
          </div>
        )}
        {phase.failed.length > 0 && (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" />
            <AlertTitle>{phase.failed.length} failed</AlertTitle>
            <AlertDescription>
              <ul className="ml-4 mt-1 flex list-disc flex-col gap-1 text-xs">
                {phase.failed.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={phase.failed.length === 0 ? onSuccess : onDone}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  const errorRows =
    phase.name === "review"
      ? phase.rows.filter((r) => r.errors.length > 0)
      : [];

  return (
    <div className="flex flex-col gap-6">
      {phase.name === "idle" && (
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">
            Expected CSV format
          </p>
          <p>
            Required columns:{" "}
            <span className="font-mono">
              First name, Last name, Email, Status
            </span>
          </p>
          <p>
            Optional columns:{" "}
            <span className="font-mono">Department, Batch</span>
          </p>
          <p className="mt-2">
            Valid status values:{" "}
            <span className="font-mono">
              {userStatus.enumValues.join(", ")}
            </span>
          </p>
          <p>
            Valid department values:{" "}
            <span className="font-mono">{DEPARTMENT_IDS.join(", ")}</span>
          </p>
        </div>
      )}

      {(phase.name === "idle" || phase.name === "parsing") && (
        <Field>
          <FieldLabel htmlFor="csvFile">CSV file</FieldLabel>
          <Input
            id="csvFile"
            type="file"
            accept=".csv,text/csv"
            disabled={phase.name === "parsing"}
            onClick={(e) => {
              e.currentTarget.value = "";
            }}
            onChange={handleFileChange}
          />
          {phase.name === "parsing" && (
            <FieldDescription className="flex items-center gap-1.5">
              <Spinner className="size-3" />
              Parsing…
            </FieldDescription>
          )}
          {parseError && <FieldError>{parseError}</FieldError>}
        </Field>
      )}

      {phase.name === "review" &&
        (phase.hasErrors ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
              <XCircleIcon className="size-4 shrink-0" />
              {errorRows.length} row{errorRows.length !== 1 ? "s" : ""} have
              errors — fix the CSV and re-upload
            </div>
            <div className="flex max-h-60 flex-col gap-2 overflow-y-auto">
              {errorRows.map((row) => (
                <div
                  key={row.rowNumber}
                  className="rounded-md border border-destructive/30 px-3 py-2 text-sm"
                >
                  <p className="mb-1 text-xs text-muted-foreground">
                    Row {row.rowNumber}
                    {row.firstName || row.lastName
                      ? ` · ${row.firstName} ${row.lastName}`.trim()
                      : ""}
                  </p>
                  <ul className="ml-3 flex list-disc flex-col gap-0.5">
                    {row.errors.map((e, i) => (
                      <li key={i} className="text-xs text-destructive">
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Field>
              <FieldLabel htmlFor="csvFileRetry">
                Upload corrected file
              </FieldLabel>
              <Input
                id="csvFileRetry"
                type="file"
                accept=".csv,text/csv"
                onClick={(e) => {
                  e.currentTarget.value = "";
                }}
                onChange={handleFileChange}
              />
            </Field>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm dark:border-green-900 dark:bg-green-950/30">
            <CheckCircle2Icon className="size-4 shrink-0 text-green-600" />
            <span>
              <span className="font-medium">{phase.rows.length}</span> user
              {phase.rows.length !== 1 ? "s" : ""} ready to create.
            </span>
          </div>
        ))}

      <div className="flex justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={phase.name === "review" ? handleReset : onBack}
        >
          {phase.name === "review" ? "Change file" : "Back"}
        </Button>
        {phase.name === "review" && !phase.hasErrors && (
          <Button type="button" onClick={handleSubmit}>
            Create {phase.rows.length} user{phase.rows.length !== 1 ? "s" : ""}
          </Button>
        )}
      </div>
    </div>
  );
}
