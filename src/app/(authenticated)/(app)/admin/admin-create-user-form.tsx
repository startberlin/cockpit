"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CreateUserForm } from "@/components/create-user-form";

interface AdminCreateUserFormProps {
  batches: { number: number }[];
}

export function AdminCreateUserForm({ batches }: AdminCreateUserFormProps) {
  const router = useRouter();
  return (
    <CreateUserForm
      batches={batches}
      defaultStatus="member"
      onSuccess={() => {
        toast.success("User scheduled. Inngest workflow will provision them.");
        router.refresh();
      }}
    />
  );
}
