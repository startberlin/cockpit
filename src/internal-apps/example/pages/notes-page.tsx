import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { NoteForm } from "@/internal-apps/example/components/note-form";
import { listExampleNotes } from "@/internal-apps/example/db/queries";
import { createMetadata } from "@/lib/metadata";

export const metadata = createMetadata({
  title: "Example app",
  description: "Scaffold app proving the internal-app seams.",
});

export default async function ExamplePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth");
  }

  const notes = await listExampleNotes(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Example app</h2>
        <p className="text-sm text-muted-foreground">
          A scaffold proving an internal app can own a route, a table, a
          permission, and a server action. Delete it once a real app exists.
        </p>
      </div>

      <NoteForm />

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border p-3 text-sm">
              <p>{note.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {/* Rendered on the server, so the timezone must be explicit —
                    otherwise the host's timezone leaks into the output. */}
                {note.createdAt.toLocaleString("en-GB", {
                  timeZone: "Europe/Berlin",
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
