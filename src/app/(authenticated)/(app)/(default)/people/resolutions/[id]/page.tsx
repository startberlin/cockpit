import { redirect } from "next/navigation";

export default async function ResolutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/tasks/vote-admission/${id}`);
}
