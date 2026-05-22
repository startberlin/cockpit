import { redirect } from "next/navigation";

export default function CancelPage() {
  redirect("/membership/cancel/confirm");
}
