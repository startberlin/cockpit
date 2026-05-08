"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import * as React from "react";
import { toast } from "sonner";
import { PeopleTable } from "@/components/people-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PublicUser } from "@/db/people";
import type { PendingBoardAction } from "@/db/people-actions";
import type { UserStatus } from "@/db/schema/auth";
import { CreateUserDialog } from "./create-user-dialog";
import { ImportGoogleUserDialog } from "./import-google-user-dialog";

interface PeoplePageClientProps {
  users: PublicUser[];
  batches: { number: number }[];
  pendingActions: PendingBoardAction[];
  hasPendingActions: boolean;
}

function userStatusLabel(status: UserStatus): string {
  switch (status) {
    case "onboarding":
      return "Onboarding";
    case "member":
      return "Member";
    case "supporting_alumni":
      return "Supporting Alumni";
    case "alumni":
      return "Alumni";
    default:
      return status;
  }
}

function ActionRequiredList({
  pendingActions,
}: {
  pendingActions: PendingBoardAction[];
}) {
  if (pendingActions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-lg font-medium text-foreground">
          You&apos;re all caught up.
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          No board votes are waiting for you right now.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {pendingActions.map((action) => (
        <Card key={action.legalMembershipId}>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex flex-col gap-1">
              <p className="font-medium">{action.subjectName}</p>
              <p className="text-sm text-muted-foreground">
                {userStatusLabel(action.subjectOperationalStatus)} &middot;
                Board vote needed
              </p>
            </div>
            <Button asChild size="sm">
              <Link href={`/people/resolutions/${action.resolutionId}`}>
                Vote
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PeoplePageClient({
  users,
  batches,
  pendingActions,
  hasPendingActions,
}: PeoplePageClientProps) {
  const router = useRouter();
  const [view, setView] = useQueryState(
    "view",
    parseAsStringLiteral(["actions", "directory"] as const).withDefault(
      hasPendingActions ? "actions" : "directory",
    ),
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);

  const handleSuccess = React.useCallback(() => {
    router.refresh();

    toast.success("Adding member...", {
      description:
        "It may take a few minutes for the member to appear in the list.",
    });
  }, [router]);

  return (
    <>
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as "actions" | "directory")}
      >
        <TabsList>
          <TabsTrigger value="actions">
            Action required
            {pendingActions.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingActions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
        </TabsList>

        <TabsContent value="actions">
          <ActionRequiredList pendingActions={pendingActions} />
        </TabsContent>

        <TabsContent value="directory">
          <PeopleTable
            data={users}
            onCreateUserClick={() => setCreateOpen(true)}
            onImportUserClick={() => setImportOpen(true)}
          />
        </TabsContent>
      </Tabs>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        batches={batches}
        onSuccess={handleSuccess}
      />
      <ImportGoogleUserDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        batches={batches}
        onSuccess={() => {
          router.refresh();
          toast.success("Member imported from Google Workspace");
        }}
      />
    </>
  );
}
