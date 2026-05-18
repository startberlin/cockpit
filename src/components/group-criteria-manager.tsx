"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useHookFormAction } from "@next-safe-action/adapter-react-hook-form/hooks";
import { Filter, Plus, Trash2, Users } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import {
  addGroupCriteriaAction,
  removeGroupCriteriaAction,
} from "@/app/(authenticated)/(app)/groups/[id]/criteria-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GroupCriteria } from "@/db/groups";
import { department, userStatus } from "@/db/schema/auth";
import { addGroupCriteriaSchema } from "@/lib/groups/criteria";

interface GroupCriteriaManagerProps {
  groupId: string;
  criteria: GroupCriteria[];
  onCriteriaChange: () => void;
}

const DEPARTMENT_LABELS: Record<string, string> = {
  partnerships: "Partnerships",
  operations: "Operations",
  community: "Community",
  growth: "Growth",
  events: "Events",
};

const STATUS_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  member: "Member",
  supporting_alumni: "Supporting alumni",
  alumni: "Alumni",
};

function formatCriteriaDisplay(criteria: GroupCriteria) {
  const parts: string[] = [];
  if (criteria.department) {
    parts.push(
      `Department: ${DEPARTMENT_LABELS[criteria.department] ?? criteria.department}`,
    );
  }
  if (criteria.status) {
    parts.push(`Status: ${STATUS_LABELS[criteria.status] ?? criteria.status}`);
  }
  if (criteria.batchNumber) {
    parts.push(`Batch: ${criteria.batchNumber}`);
  }
  return parts.length > 0 ? parts.join(" • ") : "All future members";
}

export default function GroupCriteriaManager({
  groupId,
  criteria,
  onCriteriaChange,
}: GroupCriteriaManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { form, handleSubmitWithAction, action } = useHookFormAction(
    addGroupCriteriaAction,
    zodResolver(addGroupCriteriaSchema),
    {
      actionProps: {
        onSuccess: ({ data }) => {
          const count = data?.addedUsersCount ?? 0;
          if (count > 0) {
            toast.success(
              `Matching rule created. ${count} existing member${count === 1 ? "" : "s"} added to the group.`,
            );
          } else {
            toast.success(
              "Matching rule created. No existing members matched the rule.",
            );
          }
          form.reset();
          setIsDialogOpen(false);
          onCriteriaChange();
        },
        onError: () => {
          toast.error(
            "Could not create matching rule. Please try again. If this keeps happening, email operations@start-berlin.com.",
          );
        },
      },
      formProps: {
        defaultValues: {
          groupId,
          name: "",
          department: undefined,
          status: undefined,
          batchNumber: undefined,
        },
      },
    },
  );

  const removeAction = useAction(removeGroupCriteriaAction, {
    onSuccess: () => {
      toast.success("Matching rule removed.");
      onCriteriaChange();
    },
    onError: () => {
      toast.error(
        "Could not remove matching rule. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Matching rules</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add matching rule</DialogTitle>
              <DialogDescription>
                Choose which members should be added to this group
                automatically.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleSubmitWithAction}>
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

                <Field>
                  <FieldLabel>Department</FieldLabel>
                  <Select
                    value={form.watch("department") ?? "any"}
                    onValueChange={(v) =>
                      form.setValue(
                        "department",
                        v === "any"
                          ? undefined
                          : (v as (typeof department.enumValues)[number]),
                      )
                    }
                    disabled={action.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any department</SelectItem>
                      {department.enumValues.map((d) => (
                        <SelectItem key={d} value={d}>
                          {DEPARTMENT_LABELS[d] ?? d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Select
                    value={form.watch("status") ?? "any"}
                    onValueChange={(v) =>
                      form.setValue(
                        "status",
                        v === "any"
                          ? undefined
                          : (v as (typeof userStatus.enumValues)[number]),
                      )
                    }
                    disabled={action.isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any status</SelectItem>
                      {userStatus.enumValues.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="batch-number">Batch</FieldLabel>
                  <Input
                    id="batch-number"
                    type="number"
                    placeholder="Batch number"
                    disabled={action.isPending}
                    {...form.register("batchNumber", {
                      setValueAs: (v) =>
                        v === "" ? undefined : Number.parseInt(v, 10),
                    })}
                  />
                  <FieldError errors={[form.formState.errors.batchNumber]} />
                </Field>
              </FieldGroup>

              {form.formState.errors.root && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={action.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={action.isPending}>
                  {action.isPending ? "Adding..." : "Add rule"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {criteria.length > 0 ? (
        <div className="space-y-3">
          {criteria.map((criteriaItem) => (
            <Card key={criteriaItem.id} className="border border-gray-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">
                    {criteriaItem.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      removeAction.execute({
                        criteriaId: criteriaItem.id,
                        groupId,
                      })
                    }
                    disabled={removeAction.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-gray-600">
                  {formatCriteriaDisplay(criteriaItem)}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Members who match this rule are added automatically.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No matching rules
            </h3>
            <p className="text-sm text-gray-600 text-center max-w-sm mb-4">
              Create a rule to add members automatically when their department,
              status, or batch matches.
            </p>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first rule
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
