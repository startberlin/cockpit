"use server";

import { revalidatePath } from "next/cache";
import db from "@/db";
import { actionClient } from "@/lib/action-client";
import { newId } from "@/lib/id";
import { can } from "@/lib/permissions/server";
import { exampleNote } from "../db/schema";
import { createNoteSchema } from "./create-note-schema";

export const createNoteAction = actionClient
  .inputSchema(createNoteSchema)
  .action(async ({ parsedInput, ctx: { user } }) => {
    // The route layout's requireAppAccess() does NOT protect this: server
    // actions are independently addressable endpoints. Every module action
    // re-checks for itself.
    if (!(await can("apps.example.access"))) {
      throw new Error("You are not authorized to use the example app.");
    }

    await db.insert(exampleNote).values({
      id: newId("exampleNote"),
      userId: user.id,
      body: parsedInput.body,
    });

    revalidatePath("/example");
  });
