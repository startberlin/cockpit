"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Users, Filter } from "lucide-react";
import { toast } from "sonner";
import type { GroupCriteria } from "@/types/group";

interface GroupCriteriaManagerProps {
  groupId: string;
  criteria: GroupCriteria[];
  onCriteriaChange: () => void;
}

interface CriteriaFormData {
  name: string;
  department?: string;
  roles?: string[];
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

const ROLES = [
  { value: "member", label: "Member" },
  { value: "board", label: "Board" },
  { value: "department_lead", label: "Department Lead" },
  { value: "admin", label: "Admin" },
];

const STATUSES = [
  { value: "onboarding", label: "Onboarding" },
  { value: "member", label: "Member" },
  { value: "supporting_alumni", label: "Supporting Alumni" },
  { value: "alumni", label: "Alumni" },
];

export default function GroupCriteriaManager({ groupId, criteria, onCriteriaChange }: GroupCriteriaManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState<CriteriaFormData>({
    name: "",
    department: undefined,
    roles: [],
    status: undefined,
    batchNumber: undefined,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      department: undefined,
      roles: [],
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
        if (formData.roles && formData.roles.length > 0) data.roles = formData.roles;
        if (formData.status) data.status = formData.status;
        if (formData.batchNumber) {
          const batchNum = parseInt(formData.batchNumber, 10);
          if (!isNaN(batchNum)) data.batchNumber = batchNum;
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
          toast.success(`Auto-add criteria created successfully! ${addedUsersCount} existing user${addedUsersCount === 1 ? '' : 's'} added to the group.`);
        } else {
          toast.success("Auto-add criteria created successfully! No existing users matched the criteria.");
        }
        
        resetForm();
        setIsDialogOpen(false);
        onCriteriaChange();
      } catch (error) {
        console.error("Error adding criteria:", error);
        toast.error("Failed to create auto-add criteria");
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

        toast.success("Auto-add criteria removed");
        onCriteriaChange();
      } catch (error) {
        console.error("Error removing criteria:", error);
        toast.error("Failed to remove auto-add criteria");
      }
    });
  };

  const handleRoleToggle = (role: string) => {
    const currentRoles = formData.roles || [];
    if (currentRoles.includes(role)) {
      setFormData({ ...formData, roles: currentRoles.filter(r => r !== role) });
    } else {
      setFormData({ ...formData, roles: [...currentRoles, role] });
    }
  };

  const formatCriteriaDisplay = (criteria: GroupCriteria) => {
    const parts: string[] = [];
    
    if (criteria.department) {
      parts.push(`Department: ${criteria.department}`);
    }
    if (criteria.roles && criteria.roles.length > 0) {
      parts.push(`Roles: ${criteria.roles.join(", ")}`);
    }
    if (criteria.status) {
      parts.push(`Status: ${criteria.status}`);
    }
    if (criteria.batchNumber) {
      parts.push(`Batch: ${criteria.batchNumber}`);
    }
    
    return parts.length > 0 ? parts.join(" • ") : "No specific criteria";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Auto-Add Criteria</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Criteria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Auto-Add Criteria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="criteria-name">Criteria Name</Label>
                <Input
                  id="criteria-name"
                  placeholder="e.g., 'New Community Members'"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <Label>Department (Optional)</Label>
                <Select value={formData.department || "any"} onValueChange={(value) => setFormData({ ...formData, department: value === "any" ? undefined : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Department</SelectItem>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        {dept.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Roles (Optional)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {ROLES.map((role) => (
                    <div key={role.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={role.value}
                        checked={formData.roles?.includes(role.value) || false}
                        onChange={() => handleRoleToggle(role.value)}
                        className="rounded"
                      />
                      <Label htmlFor={role.value}>{role.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Status (Optional)</Label>
                <Select value={formData.status || "any"} onValueChange={(value) => setFormData({ ...formData, status: value === "any" ? undefined : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any Status</SelectItem>
                    {STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="batch-number">Batch Number (Optional)</Label>
                <Input
                  id="batch-number"
                  type="number"
                  placeholder="Enter batch number"
                  value={formData.batchNumber || ""}
                  onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
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
                  {isPending ? "Adding..." : "Add Criteria"}
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
                  <CardTitle className="text-base font-medium">{criteriaItem.name}</CardTitle>
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
                  Future users matching these criteria will be automatically added to this group.
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Auto-Add Criteria</h3>
            <p className="text-sm text-gray-600 text-center max-w-sm mb-4">
              Set up criteria to automatically add future users to this group when they match specific attributes.
            </p>
            <Button variant="outline" onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Criteria
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}