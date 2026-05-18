"use client";

import { useQuery } from "@tanstack/react-query";
import { Crown, Plus, Users, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import {
  bulkAddUsersAction,
  searchUsersByCriteriaAction,
} from "@/app/(authenticated)/(app)/groups/[id]/bulk-actions";
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
import { department, userStatus } from "@/db/schema/auth";
import { DEPARTMENTS } from "@/lib/enums";
import type { NormalizedGroupCriteriaInput } from "@/lib/groups/criteria";
import { USER_STATUS_INFO } from "@/lib/user-status";

interface BulkAddUsersDialogProps {
  groupId: string;
  onUsersAdded: (users: PublicUser[], role: "admin" | "member") => void;
  children: React.ReactNode;
}

interface UserCriteria {
  departments: string[];
  statuses: string[];
  batchNumbers: number[];
}

export default function BulkAddUsersDialog({
  groupId,
  onUsersAdded,
  children,
}: BulkAddUsersDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [criteria, setCriteria] = useState<UserCriteria>({
    departments: [],
    statuses: [],
    batchNumbers: [],
  });
  const [newBatchNumber, setNewBatchNumber] = useState<string>("");

  const hasCriteria =
    criteria.departments.length > 0 ||
    criteria.statuses.length > 0 ||
    criteria.batchNumbers.length > 0;

  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ["group-criteria-preview", groupId, criteria],
    queryFn: async () => {
      const result = await searchUsersByCriteriaAction({
        groupId,
        match: "any",
        criteria: criteria as NormalizedGroupCriteriaInput["criteria"],
      });
      if (!result?.data) throw new Error("Failed to search members.");
      return result.data;
    },
    enabled: isOpen && hasCriteria,
    staleTime: 0,
  });

  const previewUsers = hasCriteria ? (searchData?.users ?? []) : [];

  const addAction = useAction(bulkAddUsersAction, {
    onSuccess: ({ data }) => {
      onUsersAdded(previewUsers, "member");
      setIsOpen(false);
      setCriteria({ departments: [], statuses: [], batchNumbers: [] });
      const count = data?.added ?? 0;
      toast.success(
        `Added ${count} member${count !== 1 ? "s" : ""} to the group.`,
      );
    },
    onError: () => {
      toast.error(
        "Could not add members to group. Please try again. If this keeps happening, email operations@start-berlin.com.",
      );
    },
  });

  const handleAddCriteria = (
    type: keyof UserCriteria,
    value: string | number,
  ) => {
    setCriteria((prev) => ({
      ...prev,
      [type]: [...(prev[type] as (string | number)[]), value],
    }));
  };

  const handleRemoveCriteria = (
    type: keyof UserCriteria,
    value: string | number,
  ) => {
    setCriteria((prev) => ({
      ...prev,
      [type]: (prev[type] as (string | number)[]).filter(
        (item) => item !== value,
      ),
    }));
  };

  const handleAddBatchNumber = () => {
    const num = parseInt(newBatchNumber, 10);
    if (!Number.isNaN(num) && num > 0 && !criteria.batchNumbers.includes(num)) {
      handleAddCriteria("batchNumbers", num);
      setNewBatchNumber("");
    }
  };

  const handleBulkAdd = (role: "admin" | "member") => {
    if (previewUsers.length === 0) return;
    addAction.execute({
      groupId,
      userIds: previewUsers.map((u) => u.id),
      role,
    });
  };

  const renderCriteriaSection = (
    title: string,
    type: "departments" | "statuses",
    enumValues: readonly string[],
    getLabel: (v: string) => string,
    currentValues: string[],
  ) => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{title}</label>
      <Select onValueChange={(value) => handleAddCriteria(type, value)}>
        <SelectTrigger>
          <SelectValue placeholder={`Choose ${title.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {enumValues
            .filter((v) => !currentValues.includes(v))
            .map((v) => (
              <SelectItem key={v} value={v}>
                {getLabel(v)}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {currentValues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {currentValues.map((value) => (
            <Badge key={value} variant="secondary" className="text-xs">
              {getLabel(value)}
              <button
                onClick={() => handleRemoveCriteria(type, value)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add matching members</DialogTitle>
          <DialogDescription>
            Choose the department, status, or batch that should be added to this
            group now.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {renderCriteriaSection(
            "Departments",
            "departments",
            department.enumValues,
            (v) => DEPARTMENTS[v as keyof typeof DEPARTMENTS] ?? v,
            criteria.departments,
          )}
          {renderCriteriaSection(
            "Statuses",
            "statuses",
            userStatus.enumValues,
            (v) =>
              USER_STATUS_INFO[v as keyof typeof USER_STATUS_INFO]?.label ?? v,
            criteria.statuses,
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Batches</label>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Batch number"
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
                Add batch
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

        <div className="border-t pt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="font-medium">
              Matching members ({previewUsers.length})
            </span>
            {isSearching && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2" />
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
                        {DEPARTMENTS[user.department] ?? user.department}
                      </Badge>
                    )}
                    {user.batchNumber != null && (
                      <Badge variant="outline" className="text-xs">
                        Batch {user.batchNumber}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {USER_STATUS_INFO[user.status]?.label ?? user.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isSearching &&
            previewUsers.length === 0 &&
            (criteria.departments.length > 0 ||
              criteria.statuses.length > 0 ||
              criteria.batchNumbers.length > 0) && (
              <div className="text-center py-4 text-muted-foreground">
                No members match the selected rules
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
                disabled={addAction.isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add as group members
              </Button>
              <Button
                onClick={() => handleBulkAdd("admin")}
                disabled={addAction.isPending}
              >
                <Crown className="h-4 w-4 mr-2" />
                Add as group admins
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
