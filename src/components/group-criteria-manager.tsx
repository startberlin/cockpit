"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { Filter, Plus, Trash2 } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  addGroupCriteriaAction,
  removeGroupCriteriaAction,
} from "@/app/(authenticated)/(app)/(default)/groups/[id]/criteria-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { GroupCriteria } from "@/db/groups";
import type { Department, UserStatus } from "@/db/schema/auth";
import { department, userStatus } from "@/db/schema/auth";
import { DEPARTMENT_NAMES } from "@/lib/departments";
import { addGroupCriteriaSchema } from "@/lib/groups/criteria";
import type { FieldCondition, RuleGroup } from "@/lib/groups/rule";
import { isFieldCondition } from "@/lib/groups/rule";
import { USER_STATUS_INFO } from "@/lib/user-status";

interface GroupCriteriaManagerProps {
  groupId: string;
  criteria: GroupCriteria[];
  googleSyncPending: boolean;
  onCriteriaChange: () => void;
}

// ─── Display helpers ────────────────────────────────────────────────────────

const BATCH_OP_LABELS: Record<string, string> = {
  eq: "=",
  lt: "<",
  gt: ">",
  gte: "≥",
  lte: "≤",
};

function formatFieldCondition(c: FieldCondition): string {
  switch (c.field) {
    case "department":
      return `Dept: ${c.value.map((d) => DEPARTMENT_NAMES[d as Department]).join(", ")}`;
    case "status":
      return `Status: ${c.value.map((s) => USER_STATUS_INFO[s as UserStatus].label).join(", ")}`;
    case "batchNumber":
      return `Batch ${BATCH_OP_LABELS[c.op]} ${c.value}`;
  }
}

function formatRuleGroup(rg: RuleGroup): string {
  if (rg.conditions.length === 0) return "No conditions";
  const sep = ` ${rg.op} `;
  return rg.conditions
    .map((c) =>
      isFieldCondition(c) ? formatFieldCondition(c) : `(${formatRuleGroup(c)})`,
    )
    .join(sep);
}

// ─── Multi-select popover for enum fields ────────────────────────────────────

interface MultiSelectProps<T extends string> {
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  placeholder: string;
}

function MultiSelect<T extends string>({
  options,
  selected,
  onChange,
  placeholder,
}: MultiSelectProps<T>) {
  const toggle = (value: T, checked: boolean) => {
    onChange(
      checked ? [...selected, value] : selected.filter((v) => v !== value),
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-auto min-h-9 w-full justify-start gap-1 flex-wrap px-3 py-1.5 font-normal"
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selected.map((v) => (
              <Badge key={v} variant="secondary" className="text-xs">
                {options.find((o) => o.value === v)?.label ?? v}
              </Badge>
            ))
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {options.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
          >
            <Checkbox
              checked={selected.includes(opt.value)}
              onCheckedChange={(checked) => toggle(opt.value, !!checked)}
            />
            {opt.label}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Condition row ────────────────────────────────────────────────────────────

type ConditionField = "department" | "status" | "batchNumber";

const DEPARTMENT_OPTIONS = department.enumValues.map((d) => ({
  value: d,
  label: DEPARTMENT_NAMES[d],
}));

const STATUS_OPTIONS = userStatus.enumValues.map((s) => ({
  value: s,
  label: USER_STATUS_INFO[s].label,
}));

function defaultCondition(field: ConditionField): FieldCondition {
  if (field === "department")
    return { field: "department", op: "in", value: [] };
  if (field === "status") return { field: "status", op: "in", value: [] };
  return { field: "batchNumber", op: "eq", value: 1 };
}

interface ConditionRowProps {
  condition: FieldCondition;
  onChange: (next: FieldCondition) => void;
  onRemove: () => void;
  disabled: boolean;
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
  disabled,
}: ConditionRowProps) {
  const numberId = useId();

  const handleFieldChange = (field: ConditionField) => {
    onChange(defaultCondition(field));
  };

  return (
    <div className="flex items-start gap-2">
      {/* Field selector */}
      <Select
        value={condition.field}
        onValueChange={(v) => handleFieldChange(v as ConditionField)}
        disabled={disabled}
      >
        <SelectTrigger className="w-36 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="department">Department</SelectItem>
          <SelectItem value="status">Status</SelectItem>
          <SelectItem value="batchNumber">Batch number</SelectItem>
        </SelectContent>
      </Select>

      {/* Value selector — changes based on field */}
      <div className="flex flex-1 items-start gap-2">
        {condition.field === "department" && (
          <div className="flex-1">
            <MultiSelect
              options={DEPARTMENT_OPTIONS}
              selected={condition.value}
              onChange={(v) =>
                onChange({
                  field: "department",
                  op: "in",
                  value: v as Department[],
                })
              }
              placeholder="Select departments…"
            />
          </div>
        )}

        {condition.field === "status" && (
          <div className="flex-1">
            <MultiSelect
              options={STATUS_OPTIONS}
              selected={condition.value}
              onChange={(v) =>
                onChange({
                  field: "status",
                  op: "in",
                  value: v as UserStatus[],
                })
              }
              placeholder="Select statuses…"
            />
          </div>
        )}

        {condition.field === "batchNumber" && (
          <>
            <Select
              value={condition.op}
              onValueChange={(v) =>
                onChange({
                  field: "batchNumber",
                  op: v as (FieldCondition & { field: "batchNumber" })["op"],
                  value: condition.value,
                })
              }
              disabled={disabled}
            >
              <SelectTrigger className="w-28 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eq">= equal</SelectItem>
                <SelectItem value="lt">&lt; less than</SelectItem>
                <SelectItem value="gt">&gt; greater than</SelectItem>
                <SelectItem value="gte">≥ at least</SelectItem>
                <SelectItem value="lte">≤ at most</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id={numberId}
              type="number"
              min={1}
              className="w-24 shrink-0"
              value={condition.value}
              onChange={(e) =>
                onChange({
                  field: "batchNumber",
                  op: condition.op,
                  value: Number.parseInt(e.target.value, 10) || 1,
                })
              }
              disabled={disabled}
            />
          </>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        disabled={disabled}
      >
        <span className="sr-only">Remove condition</span>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const EMPTY_CONDITIONS: RuleGroup = { op: "AND", conditions: [] };

export default function GroupCriteriaManager({
  groupId,
  criteria,
  googleSyncPending,
  onCriteriaChange,
}: GroupCriteriaManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [localConditions, setLocalConditions] =
    useState<RuleGroup>(EMPTY_CONDITIONS);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    addGroupCriteriaAction,
    zodResolver(addGroupCriteriaSchema),
    {
      actionProps: {
        onSuccess: () => {
          toast.success("Rule created. Membership is being updated.");
          form.reset();
          setLocalConditions(EMPTY_CONDITIONS);
          setIsDialogOpen(false);
          onCriteriaChange();
        },
        onError: () => {
          toast.error(
            "Could not create rule. Please try again. If this keeps happening, email operations@start-berlin.com.",
          );
        },
      },
      formProps: {
        defaultValues: {
          groupId,
          name: "",
          conditions: EMPTY_CONDITIONS,
        },
      },
    },
  );

  const removeAction = useAction(removeGroupCriteriaAction, {
    onSuccess: () => {
      toast.success("Rule removed. Membership is being updated.");
      onCriteriaChange();
    },
    onError: () => {
      toast.error(
        "Could not remove rule. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    },
  });

  const setOp = (op: "AND" | "OR") => {
    const next = { ...localConditions, op };
    setLocalConditions(next);
    form.setValue("conditions", next);
  };

  const addCondition = () => {
    const next: RuleGroup = {
      ...localConditions,
      conditions: [
        ...localConditions.conditions,
        defaultCondition("department"),
      ],
    };
    setLocalConditions(next);
    form.setValue("conditions", next);
  };

  const updateCondition = (index: number, updated: FieldCondition) => {
    const conditions = [...localConditions.conditions];
    conditions[index] = updated;
    const next: RuleGroup = { ...localConditions, conditions };
    setLocalConditions(next);
    form.setValue("conditions", next);
  };

  const removeCondition = (index: number) => {
    const conditions = localConditions.conditions.filter((_, i) => i !== index);
    const next: RuleGroup = { ...localConditions, conditions };
    setLocalConditions(next);
    form.setValue("conditions", next);
  };

  const flatConditions = localConditions.conditions.filter(isFieldCondition);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Matching rules</h2>
        </div>
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              form.reset();
              setLocalConditions(EMPTY_CONDITIONS);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={googleSyncPending}>
              <Plus className="h-4 w-4 mr-1" />
              Add rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add matching rule</DialogTitle>
              <DialogDescription>
                Members who match this rule are added to the group
                automatically.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-5" onSubmit={handleSubmitWithAction}>
              <input type="hidden" {...form.register("groupId")} />

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="criteria-name">Rule name</FieldLabel>
                  <Input
                    id="criteria-name"
                    placeholder="e.g. Community members"
                    disabled={action.isPending}
                    {...form.register("name")}
                  />
                  <FieldError errors={[form.formState.errors.name]} />
                </Field>
              </FieldGroup>

              {/* Conditions builder */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Match</span>
                  <Select
                    value={localConditions.op}
                    onValueChange={(v) => setOp(v as "AND" | "OR")}
                    disabled={action.isPending}
                  >
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">all</SelectItem>
                      <SelectItem value="OR">any</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">
                    of the following conditions:
                  </span>
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  {flatConditions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No conditions yet — add one below.
                    </p>
                  ) : (
                    flatConditions.map((condition, index) => (
                      <ConditionRow
                        key={index}
                        condition={condition}
                        onChange={(updated) => updateCondition(index, updated)}
                        onRemove={() => removeCondition(index)}
                        disabled={action.isPending}
                      />
                    ))
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addCondition}
                    disabled={action.isPending}
                    className="mt-1 text-muted-foreground"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add condition
                  </Button>
                </div>

                {form.formState.errors.conditions && (
                  <p className="text-sm text-destructive">
                    {typeof form.formState.errors.conditions.message ===
                    "string"
                      ? form.formState.errors.conditions.message
                      : "Please add at least one valid condition."}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={action.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={action.isPending}>
                  {action.isPending ? "Adding…" : "Add rule"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {criteria.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule name</TableHead>
                <TableHead>Conditions</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {criteria.map((criteriaItem) => (
                <TableRow key={criteriaItem.id}>
                  <TableCell className="font-medium text-sm">
                    {criteriaItem.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRuleGroup(criteriaItem.conditions)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        removeAction.execute({
                          criteriaId: criteriaItem.id,
                          groupId,
                        })
                      }
                      disabled={removeAction.isPending || googleSyncPending}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <span className="sr-only">Remove rule</span>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed py-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No matching rules. Members who match a rule are added automatically.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={googleSyncPending}
            onClick={() => setIsDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add your first rule
          </Button>
        </div>
      )}
    </div>
  );
}
