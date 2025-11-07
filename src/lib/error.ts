type NextSafeActionError = {
  error: {
    serverError: string;
  };
};

function isNextSafeActionError(error: unknown): error is NextSafeActionError {
  return (
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    typeof error.error === "object" &&
    error.error !== null &&
    "serverError" in error.error
  );
}

export const parseError = (error: unknown): string => {
  let message = "An error occurred";

  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === "object" && "message" in error) {
    message = error.message as string;
  } else if (isNextSafeActionError(error)) {
    message = error.error.serverError;
  } else {
    message = String(error);
  }

  return message;
};
