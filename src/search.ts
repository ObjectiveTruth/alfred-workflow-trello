import { InboxError } from "./errors.ts";
import { type Fetch, keyTokenAuthorization } from "./trello.ts";
import type { Card, Config } from "./types.ts";

export interface SearchIndex {
  inbox: { id: string; name: string };
  cards: (Card & { listName: string })[];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function malformed(): never {
  throw new InboxError(
    "INVALID_RESPONSE",
    "Trello returned unexpected search data.",
    4,
  );
}

// Fetch only the configured Inbox's board. This is independent of Alfred and
// returns no descriptions, attachments, credentials or other board contents.
export async function loadSearchIndex(
  config: Config,
  fetcher: Fetch = fetch,
): Promise<SearchIndex> {
  async function get(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(`https://api.trello.com/1/${path}`, {
        headers: keyTokenAuthorization(config.credentials)(),
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new InboxError(
        "NETWORK_ERROR",
        "Search unavailable. Check your connection; you can still try capturing a card.",
        4,
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) {
        throw new InboxError(
          "AUTH_FAILED",
          "Search needs a Trello token with read access to your Inbox board.",
          3,
        );
      }
      throw new InboxError(
        "API_ERROR",
        `Search unavailable (Trello HTTP ${response.status}).`,
        4,
      );
    }
    try {
      return await response.json();
    } catch {
      malformed();
    }
  }

  const inbox = await get(`lists/${config.listId}?fields=name,idBoard`);
  if (
    !record(inbox) || typeof inbox.name !== "string" ||
    typeof inbox.idBoard !== "string" || !/^[a-f0-9]{24}$/i.test(inbox.idBoard)
  ) malformed();
  const [lists, cards] = await Promise.all([
    get(`boards/${inbox.idBoard}/lists/open?fields=name`),
    get(`boards/${inbox.idBoard}/cards/open?fields=name,idList,url`),
  ]);
  if (!Array.isArray(lists) || !Array.isArray(cards)) malformed();
  const names = new Map<string, string>();
  for (const list of lists) {
    if (
      !record(list) || typeof list.id !== "string" ||
      typeof list.name !== "string"
    ) malformed();
    names.set(list.id, list.name);
  }
  const result: SearchIndex = {
    inbox: { id: config.listId, name: inbox.name },
    cards: [],
  };
  for (const card of cards) {
    if (
      !record(card) || typeof card.id !== "string" ||
      typeof card.name !== "string" || typeof card.idList !== "string" ||
      typeof card.url !== "string"
    ) malformed();
    // Cards in archived lists are not search results even if a server includes them.
    const listName = names.get(card.idList);
    if (!listName) continue;
    if (!/^https:\/\/trello\.com\/c\/[^\s]+$/.test(card.url)) malformed();
    result.cards.push({
      id: card.id,
      name: card.name,
      url: card.url,
      listName,
    });
  }
  return result;
}
