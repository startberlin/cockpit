type NextSafeActionOnErrorArgs = {
  error: {
    serverError?: string;
    validationErrors?: unknown;
    bindArgsValidationErrors?: unknown;
  };
  input?: unknown;
};

function isNextSafeActionOnErrorArgs(
  error: unknown,
): error is NextSafeActionOnErrorArgs {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof (error as NextSafeActionOnErrorArgs).error === "object" &&
    (error as NextSafeActionOnErrorArgs).error !== null
  );
}

export const parseError = (error: unknown): string => {
  // Handle next-safe-action onError args shape: { error: { serverError?, validationErrors?, ... }, input }
  if (isNextSafeActionOnErrorArgs(error)) {
    if (error.error.serverError) {
      return error.error.serverError;
    }
    return "An error occurred";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return (error as { message: string }).message;
  }

  return String(error);
};
