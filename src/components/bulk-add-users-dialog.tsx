"use client";

import { Crown, Plus, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PublicUser } from "@/db/people";

interface BulkAddUsersDialogProps {
  groupId: string;
  onUsersAdded: (users: PublicUser[], role: "admin" | "member") => void;
  children: React.ReactNode;
}

interface UserCriteria {
  departments: string[];
  roles: string[];
  statuses: string[];
  batchNumbers: number[];
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

export default function BulkAddUsersDialog({
  groupId,
  onUsersAdded,
  children,
}: BulkAddUsersDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [criteria, setCriteria] = useState<UserCriteria>({
    departments: [],
    roles: [],
    statuses: [],
    batchNumbers: [],
  });
  const [previewUsers, setPreviewUsers] = useState<PublicUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newBatchNumber, setNewBatchNumber] = useState<string>("");

  const fetchPreviewUsers = useCallback(async () => {
    if (
      criteria.departments.length === 0 &&
      criteria.roles.length === 0 &&
      criteria.statuses.length === 0 &&
      criteria.batchNumbers.length === 0
    ) {
      setPreviewUsers([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/users/search-by-criteria", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId,
          criteria,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const users = await response.json();
      setPreviewUsers(users);
    } catch (error) {
      toast.error("Failed to fetch matching users");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, criteria]);

  useEffect(() => {
    if (isOpen) {
      fetchPreviewUsers();
    }
  }, [isOpen, fetchPreviewUsers]);

  const handleAddCriteria = (
    type: keyof UserCriteria,
    value: string | number,
  ) => {
    setCriteria((prev) => ({
      ...prev,
      [type]: [...(prev[type] as any[]), value],
    }));
  };

  const handleRemoveCriteria = (
    type: keyof UserCriteria,
    value: string | number,
  ) => {
    setCriteria((prev) => ({
      ...prev,
      [type]: (prev[type] as any[]).filter((item) => item !== value),
    }));
  };

  const handleAddBatchNumber = () => {
    const num = parseInt(newBatchNumber, 10);
    if (!Number.isNaN(num) && num > 0 && !criteria.batchNumbers.includes(num)) {
      handleAddCriteria("batchNumbers", num);
      setNewBatchNumber("");
    }
  };

  const handleBulkAdd = async (role: "admin" | "member" = "member") => {
    if (previewUsers.length === 0) return;

    setIsAdding(true);
    try {
      const response = await fetch("/api/groups/bulk-add-users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          groupId,
          userIds: previewUsers.map((u) => u.id),
          role,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add users");
      }

      onUsersAdded(previewUsers, role);
      setIsOpen(false);
      setCriteria({
        departments: [],
        roles: [],
        statuses: [],
        batchNumbers: [],
      });
      setPreviewUsers([]);
      toast.success(
        `Added ${previewUsers.length} user${previewUsers.length !== 1 ? "s" : ""} to the group`,
      );
    } catch (error) {
      toast.error("Failed to add users to group");
      console.error(error);
    } finally {
      setIsAdding(false);
    }
  };

  const renderCriteriaSection = (
    title: string,
    type: keyof UserCriteria,
    options: Array<{ value: string; label: string }>,
    currentValues: string[],
  ) => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{title}</label>
      <Select onValueChange={(value) => handleAddCriteria(type, value)}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${title.toLowerCase()}...`} />
        </SelectTrigger>
        <SelectContent>
          {options
            .filter((option) => !currentValues.includes(option.value))
            .map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {currentValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {currentValues.map((value) => {
            const option = options.find((opt) => opt.value === value);
            return (
              <Badge key={value} variant="secondary" className="text-xs">
                {option?.label || value}
                <button
                  onClick={() => handleRemoveCriteria(type, value)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Users by Criteria</DialogTitle>
          <DialogDescription>
            Select criteria to add multiple users to this group at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {renderCriteriaSection(
            "Departments",
            "departments",
            DEPARTMENTS,
            criteria.departments,
          )}
          {renderCriteriaSection("Roles", "roles", ROLES, criteria.roles)}
          {renderCriteriaSection(
            "Statuses",
            "statuses",
            STATUSES,
            criteria.statuses,
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Batch Numbers</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Enter batch number..."
                value={newBatchNumber}
                onChange={(e) => setNewBatchNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddBatchNumber();
                  }
                }}
                className="flex-1 px-3 py-2 border rounded-md text-sm"
                min="1"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddBatchNumber}
                disabled={
                  !newBatchNumber || Number.isNaN(parseInt(newBatchNumber, 10))
                }
              >
                Add
              </Button>
            </div>
            {criteria.batchNumbers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {criteria.batchNumbers.map((num) => (
                  <Badge key={num} variant="secondary" className="text-xs">
                    Batch {num}
                    <button
                      onClick={() => handleRemoveCriteria("batchNumbers", num)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="font-medium">
              Matching Users ({previewUsers.length})
            </span>
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
            )}
          </div>

          {previewUsers.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-3">
              {previewUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-3 text-sm">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {user.firstName[0]}
                      {user.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <span className="font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      {user.email}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {user.department && (
                      <Badge variant="outline" className="text-xs">
                        {user.department}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      Batch {user.batchNumber}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {user.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading &&
            previewUsers.length === 0 &&
            (criteria.departments.length > 0 ||
              criteria.roles.length > 0 ||
              criteria.statuses.length > 0 ||
              criteria.batchNumbers.length > 0) && (
              <div className="text-center py-4 text-muted-foreground">
                No users match the selected criteria
              </div>
            )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          {previewUsers.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleBulkAdd("member")}
                disabled={isAdding}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add as Members
              </Button>
              <Button
                onClick={() => handleBulkAdd("admin")}
                disabled={isAdding}
              >
                <Crown className="h-4 w-4 mr-2" />
                Add as Admins
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
