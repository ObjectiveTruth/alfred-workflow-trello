import { InboxError } from "./errors.ts";
import type { Card, Config, TrelloCredentials } from "./types.ts";

// The card operation only needs a header provider; a future OAuth provider can
// replace key/token authentication without changing payload generation.
export type Authorization = () => HeadersInit;
export type Fetch = typeof fetch;

export function keyTokenAuthorization(
  credentials: TrelloCredentials,
): Authorization {
  return () => ({
    Authorization: `OAuth oauth_consumer_key="${
      encodeURIComponent(credentials.apiKey)
    }", oauth_token="${encodeURIComponent(credentials.token)}"`,
  });
}

export function cardPayload(listId: string, name: string): URLSearchParams {
  if (!name.trim()) {
    throw new InboxError("INVALID_INPUT", "Enter a non-empty card title.", 2);
  }
  return new URLSearchParams({ idList: listId, name });
}

export async function createCard(
  config: Config,
  name: string,
  fetcher: Fetch = fetch,
  authorize: Authorization = keyTokenAuthorization(config.credentials),
): Promise<Card> {
  const body = cardPayload(config.listId, name);
  let response: Response;
  try {
    response = await fetcher("https://api.trello.com/1/cards", {
      method: "POST",
      headers: authorize(),
      body,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // Never echo fetch exceptions: they may contain credential-bearing details.
    // Do not retry a POST: a timeout can happen after Trello creates the card.
    throw new InboxError(
      "NETWORK_ERROR",
      "Couldn't confirm saving to Trello. Check your connection and list before retrying to avoid duplicates.",
      4,
    );
  }
  if (response.status === 401 || response.status === 403) {
    await response.body?.cancel();
    throw new InboxError(
      "AUTH_FAILED",
      "Trello rejected the configured credentials or list access. Check your API key/token and list permissions.",
      3,
    );
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new InboxError(
      "API_ERROR",
      `Trello returned HTTP ${response.status}. Check your list and try again later.`,
      4,
    );
  }
  try {
    const card: unknown = await response.json();
    if (
      typeof card === "object" && card !== null &&
      "id" in card && typeof card.id === "string" && card.id.length > 0 &&
      "name" in card && typeof card.name === "string" && card.name.length > 0 &&
      "url" in card && typeof card.url === "string" &&
      new URL(card.url).origin === "https://trello.com"
    ) {
      return { id: card.id, name: card.name, url: card.url };
    }
  } catch { /* Treat all malformed responses consistently. */ }
  throw new InboxError(
    "INVALID_RESPONSE",
    "Trello returned an unexpected response. Check your list before retrying to avoid duplicates.",
    4,
  );
}
