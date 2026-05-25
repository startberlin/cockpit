"use client";

import posthog from "posthog-js";
import { useEffect } from "react";

interface Props {
  id: string;
  email: string;
  name: string;
  status: string;
  department: string | null;
  batchNumber: number | null;
  legalMembershipState: string;
  eventEmailPreference: string | null;
  memberSinceDate: string | null;
}

export function PostHogIdentifyClient({
  id,
  email,
  name,
  status,
  department,
  batchNumber,
  legalMembershipState,
  eventEmailPreference,
  memberSinceDate,
}: Props) {
  useEffect(() => {
    posthog.identify(id, {
      email,
      name,
      status,
      department,
      batch_number: batchNumber,
      legal_membership_state: legalMembershipState,
      event_email_preference: eventEmailPreference,
      member_since: memberSinceDate,
    });
  }, [
    id,
    email,
    name,
    status,
    department,
    batchNumber,
    legalMembershipState,
    eventEmailPreference,
    memberSinceDate,
  ]);

  return null;
}
