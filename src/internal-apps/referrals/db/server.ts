import "server-only";

import db from "@/db";
import { createReferralStore } from "./store";

export const referralsStore = createReferralStore(db);
