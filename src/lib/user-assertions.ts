import type { User } from "@/db/schema/auth";

type WithEmail<T> = T & { email: string };
type WithPersonalEmail<T> = T & { personalEmail: string };

export function assertHasEmail<T extends Pick<User, "email">>(
  user: T,
  context?: string,
): WithEmail<T> {
  if (!user.email) {
    throw new Error(
      `User is missing an email address${context ? ` (${context})` : ""}`,
    );
  }
  return user as WithEmail<T>;
}

export function assertHasPersonalEmail<T extends Pick<User, "personalEmail">>(
  user: T,
  context?: string,
): WithPersonalEmail<T> {
  if (!user.personalEmail) {
    throw new Error(
      `User is missing a personal email address${context ? ` (${context})` : ""}`,
    );
  }
  return user as WithPersonalEmail<T>;
}
