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
    return parseError(error.error);
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    if ("serverError" in error && typeof error.serverError === "string")
      return error.serverError;
    if ("validationErrors" in error) {
      const message = firstValidationMessage(error.validationErrors);
      if (message) return message;
    }
    if ("bindArgsValidationErrors" in error) {
      const message = firstValidationMessage(error.bindArgsValidationErrors);
      if (message) return message;
    }
    if ("message" in error && typeof error.message === "string")
      return error.message;
  }

  return typeof error === "string" && error.trim()
    ? error
    : "Something went wrong. Please try again.";
};

function firstValidationMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (!value || typeof value !== "object") return undefined;
  for (const child of Object.values(value)) {
    const message = firstValidationMessage(child);
    if (message) return message;
  }
  return undefined;
}
