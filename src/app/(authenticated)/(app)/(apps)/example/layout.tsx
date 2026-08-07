import { requireAppAccess } from "@/lib/apps/server";

/**
 * Access gate for the example app. Lives in the layout so it covers every
 * nested route, including ones added later.
 *
 * This guards page renders only — server actions are separate endpoints and
 * re-check `can()` themselves.
 */
export default async function ExampleAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAppAccess("example");

  return children;
}
