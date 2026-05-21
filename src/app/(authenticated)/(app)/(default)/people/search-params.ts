import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";
import { userStatus } from "@/db/schema/auth";
import { DEPARTMENT_IDS } from "@/lib/departments";

export const departmentParser = parseAsStringEnum([...DEPARTMENT_IDS]);
export const statusParser = parseAsStringEnum([...userStatus.enumValues]);
export const viewModeParser = parseAsStringEnum(["grid", "list"]).withDefault(
  "grid",
);

export const loadSearchParams = createLoader({
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  department: parseAsArrayOf(departmentParser),
  batchNumber: parseAsArrayOf(parseAsInteger),
  status: parseAsArrayOf(statusParser),
});
