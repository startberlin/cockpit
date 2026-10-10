"use client";

import { createContext, useContext } from "react";
import type { UploadTracker } from "../lib/upload-tracker";

export const UploadContext = createContext<UploadTracker | null>(null);

export function useUploadTracker() {
  return useContext(UploadContext);
}
