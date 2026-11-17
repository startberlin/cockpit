import { createLoader, parseAsInteger, parseAsStringEnum } from "nuqs/server";
import { PEOPLE_STATUSES } from "./user-status";

export const peopleStatusParser = parseAsStringEnum([...PEOPLE_STATUSES]);

export const loadGroupPeopleParams = createLoader({
  page: parseAsInteger.withDefault(1),
  status: peopleStatusParser,
});
