import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";
import { DEPARTMENT_IDS } from "@/lib/departments";
import { peopleStatusParser } from "@/lib/people-search-params";

export const departmentParser = parseAsStringEnum([...DEPARTMENT_IDS]);
export const viewModeParser = parseAsStringEnum(["grid", "list"]).withDefault(
  "grid",
);

export const loadSearchParams = createLoader({
  page: parseAsInteger.withDefault(1),
  q: parseAsString.withDefault(""),
  department: parseAsArrayOf(departmentParser),
  batchNumber: parseAsArrayOf(parseAsInteger),
  status: parseAsArrayOf(peopleStatusParser),
});
