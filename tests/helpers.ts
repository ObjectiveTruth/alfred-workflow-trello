export function assert(
  condition: unknown,
  message = "Assertion failed",
): asserts condition {
  if (!condition) throw new Error(message);
}

export function equal(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// Synthetic values only; never real credentials or personal Trello IDs.
export const listId = "a".repeat(24);
export const environment: Record<string, string> = {
  TRELLO_API_KEY: "test-key",
  TRELLO_API_TOKEN: "test-token",
  TRELLO_LIST_ID: listId,
};
export const env = (name: string) => environment[name];
export const card = {
  id: "test-card",
  name: "Buy cardboard",
  url: "https://trello.com/c/test",
};
