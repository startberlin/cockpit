import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  FINANZORDNUNG_FILENAME,
  SATZUNG_FILENAME,
} from "./legal-document-paths";

export async function readSatzungBuffer(): Promise<Buffer> {
  return readFile(join(process.cwd(), "public", "legal", SATZUNG_FILENAME));
}

export async function readFinanzordnungBuffer(): Promise<Buffer> {
  return readFile(
    join(process.cwd(), "public", "legal", FINANZORDNUNG_FILENAME),
  );
}
