import { ArrowLeft, ShieldX } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getUserById } from "@/db/people";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import { ContactCard } from "./contact-card";
import { GroupsCard } from "./groups-card";
import { ProfileCard } from "./profile-card";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserById(id);

  if (!user) {
    return createMetadata({
      title: "User Not Found",
      description: "The requested user could not be found.",
    });
  }

  return createMetadata({
    title: `${user.firstName} ${user.lastName}`,
    description: `Member profile for ${user.firstName} ${user.lastName}`,
  });
}

export default async function UserDetailPage({ params }: PageProps) {
  const canManageUsers = await can("users.manage");
  if (!canManageUsers) {
    return (
      <Empty className="min-h-[50vh]">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldX />
          </EmptyMedia>
          <EmptyTitle>Access Denied</EmptyTitle>
          <EmptyDescription>
            You don't have permission to view member details.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" asChild>
          <Link href="/people">Back to People</Link>
        </Button>
      </Empty>
    );
  }

  const { id } = await params;
  const user = await getUserById(id);

  if (!user) {
    notFound();
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/people">
            <ArrowLeft />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.firstName} {user.lastName}
          </h1>
          <p className="text-muted-foreground text-sm">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ProfileCard user={user} />
        <ContactCard user={user} />
        <GroupsCard groups={user.groups} />
      </div>
    </div>
  );
}
