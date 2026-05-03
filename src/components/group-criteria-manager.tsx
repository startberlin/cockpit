"use client";

import { Filter, Plus, Trash2, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GroupCriteria } from "@/db/groups";

interface GroupCriteriaManagerProps {
  groupId: string;
  criteria: GroupCriteria[];
  onCriteriaChange: () => void;
}

interface CriteriaFormData {
  name: string;
  department?: string;
  status?: string;
  batchNumber?: string;
}

const DEPARTMENTS = [
  { value: "partnerships", label: "Partnerships" },
  { value: "operations", label: "Operations" },
  { value: "community", label: "Community" },
  { value: "growth", label: "Growth" },
  { value: "events", label: "Events" },
];

const STATUSES = [
  { value: "onboarding", label: "Onboarding" },
  { value: "member", label: "Member" },
  { value: "supporting_alumni", label: "Supporting alumni" },
  { value: "alumni", label: "Alumni" },
];

function findLabel(
  options: Array<{ value: string; label: string }>,
  value: string,
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export default function GroupCriteriaManager({
  groupId,
  criteria,
  onCriteriaChange,
}: GroupCriteriaManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<CriteriaFormData>({
    name: "",
    department: undefined,
    status: undefined,
    batchNumber: undefined,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      department: undefined,
      status: undefined,
      batchNumber: undefined,
    });
  };

  const handleAddCriteria = () => {
    startTransition(async () => {
      try {
        const data: any = {
          groupId,
          name: formData.name,
        };

        if (formData.department) data.department = formData.department;
        if (formData.status) data.status = formData.status;
        if (formData.batchNumber) {
          const batchNum = parseInt(formData.batchNumber, 10);
          if (!Number.isNaN(batchNum)) data.batchNumber = batchNum;
        }

        const response = await fetch("/api/groups/criteria", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error("Failed to add criteria");
        }

        const responseData = await response.json();
        const addedUsersCount = responseData.addedUsersCount || 0;

        if (addedUsersCount > 0) {
          toast.success(
            `Matching rule created. ${addedUsersCount} existing member${addedUsersCount === 1 ? "" : "s"} added to the group.`,
          );
        } else {
          toast.success(
            "Matching rule created. No existing members matched the rule.",
          );
        }

        resetForm();
        setIsDialogOpen(false);
        onCriteriaChange();
      } catch (error) {
        console.error("Error adding criteria:", error);
        toast.error(
          "Could not create matching rule. Please try again. If this keeps happening, email operations@start-berlin.com.",
        );
      }
    });
  };

  const handleRemoveCriteria = (criteriaId: string) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/groups/criteria/${criteriaId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to remove criteria");
        }

        toast.success("Matching rule removed.");
        onCriteriaChange();
      } catch (error) {
        console.error("Error removing criteria:", error);
        toast.error(
          "Could not remove matching rule. Please try again. If this keeps happening, email operations@start-berlin.com.",
        );
      }
    });
  };

  const formatCriteriaDisplay = (criteria: GroupCriteria) => {
    const parts: string[] = [];

    if (criteria.department) {
      parts.push(`Department: ${findLabel(DEPARTMENTS, criteria.department)}`);
    }
    if (criteria.roles && criteria.roles.length > 0) {
      parts.push("Old role condition no longer applies");
    }
    if (criteria.status) {
      parts.push(`Status: ${findLabel(STATUSES, criteria.status)}`);
    }
    if (criteria.batchNumber) {
      parts.push(`Batch: ${criteria.batchNumber}`);
    }

    return parts.length > 0 ? parts.join(" • ") : "All future members";
  };

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
                Choose which future members should be added to this group
                automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="criteria-name">Rule name</Label>
                <Input
                  id="criteria-name"
                  placeholder="e.g. Community members"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div>
                <Label>Department</Label>
                <Select
                  value={formData.department || "any"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      department: value === "any" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any department</SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Status</Label>
                <Select
                  value={formData.status || "any"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      status: value === "any" ? undefined : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any status</SelectItem>
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="batch-number">Batch</Label>
                <Input
                  id="batch-number"
                  type="number"
                  placeholder="Batch number"
                  value={formData.batchNumber || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, batchNumber: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddCriteria}
                  disabled={!formData.name.trim() || isPending}
                >
                  {isPending ? "Adding..." : "Add rule"}
                </Button>
              </div>
            </div>
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
                    onClick={() => handleRemoveCriteria(criteriaItem.id)}
                    disabled={isPending}
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
                  Future members who match this rule will be added to this group
                  automatically.
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
              Create a rule to add future members automatically when their
              department, status, or batch matches.
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
