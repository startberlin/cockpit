"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department } from "@/db/schema/auth";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";
import { changeDepartmentAction } from "./change-department-action";
import { changePersonalEmailAction } from "./change-personal-email-action";
import { resetPasswordAction } from "./reset-password-action";

interface MembershipCardMenuProps {
  userId: string;
  canPropose: boolean;
  canRemove: boolean;
  canChangeDepartment: boolean;
  canChangePersonalEmail: boolean;
  canResetPassword: boolean;
  currentDepartment: Department | null;
  personalEmail: string | null;
}

export function MembershipCardMenu({
  userId,
  canPropose,
  canRemove,
  canChangeDepartment,
  canChangePersonalEmail,
  canResetPassword,
  currentDepartment,
  personalEmail,
}: MembershipCardMenuProps) {
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  const [selectedDept, setSelectedDept] = useState<string>(
    currentDepartment ?? "",
  );
  const [emailInput, setEmailInput] = useState("");

  const { execute: changeDept, isPending: isDeptPending } = useAction(
    changeDepartmentAction,
    {
      onSuccess: () => {
        setDeptDialogOpen(false);
        toast.success("Department updated");
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Failed to update department");
      },
    },
  );

  const { execute: changeEmail, isPending: isEmailPending } = useAction(
    changePersonalEmailAction,
    {
      onSuccess: () => {
        setEmailDialogOpen(false);
        toast.success("Personal email updated");
      },
      onError: ({ error }) => {
        toast.error(
          error.serverError ??
            error.validationErrors?.personalEmail?._errors?.[0] ??
            "Failed to update email",
        );
      },
    },
  );

  const { execute: resetPassword, isPending: isPasswordPending } = useAction(
    resetPasswordAction,
    {
      onSuccess: () => {
        setPasswordDialogOpen(false);
        toast.success("Password reset and sent to the user");
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Failed to reset password");
      },
    },
  );

  if (
    !canPropose &&
    !canRemove &&
    !canChangeDepartment &&
    !canChangePersonalEmail &&
    !canResetPassword
  ) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canChangeDepartment && (
            <DropdownMenuItem onSelect={() => setDeptDialogOpen(true)}>
              {currentDepartment ? "Change Department" : "Assign Department"}
            </DropdownMenuItem>
          )}
          {canChangePersonalEmail && (
            <DropdownMenuItem onSelect={() => setEmailDialogOpen(true)}>
              Change Personal Email
            </DropdownMenuItem>
          )}
          {canPropose && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/people/${userId}/propose`}>
                Propose for membership
              </Link>
            </DropdownMenuItem>
          )}
          {(canResetPassword || canRemove) && <DropdownMenuSeparator />}
          {canResetPassword && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              disabled={!personalEmail}
              onSelect={() => setPasswordDialogOpen(true)}
            >
              Reset Password
            </DropdownMenuItem>
          )}
          {canRemove && (
            <DropdownMenuItem
              asChild
              className="text-destructive focus:text-destructive"
            >
              <Link href={`/admin/people/${userId}/remove`}>
                Remove from START Berlin
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={deptDialogOpen}
        onOpenChange={(open) => {
          if (!isDeptPending) setDeptDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {currentDepartment ? "Change Department" : "Assign Department"}
            </DialogTitle>
            <DialogDescription>
              {currentDepartment
                ? "Select a new department for this member."
                : "Assign this member to a department."}
              {currentDepartment && (
                <span className="mt-1 block text-sm text-amber-600">
                  Note: moving this member out of your department will remove
                  your ability to undo this action.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a department" />
            </SelectTrigger>
            <SelectContent>
              {DEPARTMENT_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {DEPARTMENT_NAMES[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isDeptPending}
              onClick={() => setDeptDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                isDeptPending ||
                !selectedDept ||
                selectedDept === currentDepartment
              }
              onClick={() =>
                changeDept({
                  userId,
                  department: selectedDept as Department,
                })
              }
            >
              {isDeptPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={emailDialogOpen}
        onOpenChange={(open) => {
          if (!isEmailPending) setEmailDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Personal Email</DialogTitle>
            <DialogDescription>
              A security notice will be sent to the current address. A
              confirmation will be sent to the new address.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="email"
            placeholder="new@example.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            disabled={isEmailPending}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isEmailPending}
              onClick={() => setEmailDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isEmailPending || !emailInput}
              onClick={() => changeEmail({ userId, personalEmail: emailInput })}
            >
              {isEmailPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          if (!isPasswordPending) setPasswordDialogOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              A temporary password will be generated and sent to{" "}
              <strong>{personalEmail}</strong> (and their START Berlin address
              as a copy). They will be required to change it on their next
              sign-in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPasswordPending}
              onClick={() => setPasswordDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPasswordPending}
              onClick={() => resetPassword({ userId })}
            >
              {isPasswordPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
