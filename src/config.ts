import { InboxError } from "./errors.ts";
import type { Config } from "./types.ts";

export type ReadEnv = (name: string) => string | undefined;

export function readConfig(
  env: ReadEnv = (name) => Deno.env.get(name),
): Config {
  const apiKey = env("TRELLO_API_KEY")?.trim();
  const token = env("TRELLO_API_TOKEN")?.trim();
  const listId = env("TRELLO_LIST_ID")?.trim();
  if (!apiKey || !token || !listId) {
    throw new InboxError(
      "INVALID_CONFIG",
      "Set TRELLO_API_KEY, TRELLO_API_TOKEN and TRELLO_LIST_ID in Workflow Configuration or your environment.",
      2,
    );
  }
  if (!/^[a-f0-9]{24}$/i.test(listId)) {
    throw new InboxError(
      "INVALID_CONFIG",
      "TRELLO_LIST_ID must be the list's 24-character ID, not its name or URL.",
      2,
    );
  }
  return { credentials: { apiKey, token }, listId };
}
