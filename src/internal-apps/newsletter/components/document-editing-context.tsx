"use client";

import type { Editor } from "@tiptap/core";
import { createContext, useContext } from "react";

export const DocumentEditingContext = createContext<boolean | null>(null);

export function useDocumentEditable(editor: Editor): boolean {
  return useContext(DocumentEditingContext) ?? editor.isEditable;
}
