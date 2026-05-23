"use client";

import { ShieldCheck, Trash2, UserCheck, UserCog } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImpersonateButton } from "./impersonate-button";

interface AdminActionCardsProps {
  userId: string;
  userEmail: string;
  firstName: string;
  lastName: string;
  canImpersonate: boolean;
  canProposeMembership: boolean;
  canRemoveMember: boolean;
  canManageAuthority: boolean;
}

export function AdminActionCards({
  userId,
  userEmail,
  firstName,
  lastName,
  canImpersonate,
  canProposeMembership,
  canRemoveMember,
  canManageAuthority,
}: AdminActionCardsProps) {
  const hasAnyAction =
    canImpersonate ||
    canProposeMembership ||
    canRemoveMember ||
    canManageAuthority;

  if (!hasAnyAction) return null;

  return (
    <div className="space-y-3">
      {canImpersonate && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Impersonate</CardTitle>
            </div>
            <CardDescription>
              Sign in as this member to see what they see. Useful for
              troubleshooting account issues.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImpersonateButton userId={userId} userEmail={userEmail} />
          </CardContent>
        </Card>
      )}

      {canProposeMembership && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">
                Propose for membership
              </CardTitle>
            </div>
            <CardDescription>
              Start the board admission workflow for {firstName} {lastName}. The
              board will be asked to vote on their legal membership.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link href={`/admin/people/${userId}/propose`}>
                Propose for membership
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canRemoveMember && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Remove member</CardTitle>
            </div>
            <CardDescription>
              Immediately revoke account access and start the cancellation
              process for {firstName} {lastName}. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="destructive" size="sm">
              <Link href={`/admin/people/${userId}/remove`}>Remove member</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canManageAuthority && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Manage permissions</CardTitle>
            </div>
            <CardDescription>
              Assign or revoke app permission grants for {firstName} {lastName}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href={`/admin/people/${userId}/permissions`}>
                Manage permissions
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
