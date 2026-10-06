export class InboxError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = "InboxError";
  }
}

export function safeError(error: unknown): InboxError {
  return error instanceof InboxError ? error : new InboxError(
    "RUNTIME_ERROR",
    "Couldn't save to Trello. Check your configuration and try again.",
    1,
  );
}
