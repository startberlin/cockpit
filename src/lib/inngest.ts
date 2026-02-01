import "server-only";

import { EventSchemas, type GetEvents, Inngest } from "inngest";
import type { Department, UserStatus } from "@/db/schema/auth";

type Events = {
  "user.created": {
    data: {
      firstName: string;
      lastName: string;
      personalEmail: string;
      batchNumber: number;
      department: Department;
      status: UserStatus;
    };
  };
  "slack/user.joined": {
    data: {
      id: string;
    };
  };
  "cockpit/user.updated": {
    data: {
      id: string;
    };
  };
  "group.created": {
    data: {
      id: string;
      name: string;
      slug: string;
      integrations: {
        slack: boolean;
        email: boolean;
      };
    };
  };
};

export const inngest = new Inngest({
  id: "start-cockpit",
  schemas: new EventSchemas().fromRecord<Events>(),
});

export type InngestEvents = GetEvents<typeof inngest>;
