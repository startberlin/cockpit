import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "About — Example app",
  description: "What the example app demonstrates.",
});

export default function ExampleAboutPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">About</h2>
        <p className="text-sm text-muted-foreground">
          A second page, so the app's own sidebar has something to navigate
          between.
        </p>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        <li className="rounded-md border p-3">
          Lives outside the <code>(app)</code> route group, so it renders its
          own sidebar instead of Cockpit's.
        </li>
        <li className="rounded-md border p-3">
          Opens in its own tab from the launcher, with a "Back to Cockpit" link
          in the sidebar footer.
        </li>
        <li className="rounded-md border p-3">
          Owns its table (<code>example_note</code>), its permission (
          <code>apps.example.access</code>), and its server action.
        </li>
      </ul>
    </div>
  );
}
