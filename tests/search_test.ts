import { loadSearchIndex } from "../src/search.ts";
import { readConfig } from "../src/config.ts";
import { run } from "../src/cli.ts";
import { InboxError } from "../src/errors.ts";
import { assert, card, env, equal, listId } from "./helpers.ts";

const boardId = "b".repeat(24);
const nextId = "c".repeat(24);
const board = {
  name: "My board",
  url: "https://trello.com/b/board123/my-board",
};
const inbox = { name: "Inbox", idBoard: boardId };
const lists = [{ id: listId, name: "Inbox" }, { id: nextId, name: "Next" }];
const cards = [{ ...card, idList: nextId }];

Deno.test("index discovers the inbox board, joins list names, omits archived lists and uses header auth", async () => {
  const urls: string[] = [];
  const result = await loadSearchIndex(readConfig(env), (url, init) => {
    urls.push(String(url));
    assert(!String(url).includes("test-key"));
    assert(!String(url).includes("test-token"));
    assert(
      new Headers(init?.headers).get("Authorization")?.includes("test-token"),
    );
    equal(init?.redirect, "error");
    assert(init?.signal instanceof AbortSignal);
    return Promise.resolve(
      Response.json(
        urls.length === 1
          ? inbox
          : String(url).includes("?fields=name,url")
          ? board
          : String(url).includes("/lists/")
          ? lists
          : [...cards, { ...card, idList: "archived" }],
      ),
    );
  });
  equal(result, {
    board,
    inbox: { id: listId, name: "Inbox" },
    cards: [{ ...card, listName: "Next" }],
  });
  equal(urls, [
    `https://api.trello.com/1/lists/${listId}?fields=name,idBoard`,
    `https://api.trello.com/1/boards/${boardId}?fields=name,url`,
    `https://api.trello.com/1/boards/${boardId}/lists/open?fields=name`,
    `https://api.trello.com/1/boards/${boardId}/cards/open?fields=name,idList,url`,
  ]);
});

for (const status of [401, 403, 429, 500]) {
  Deno.test(`index reports HTTP ${status} without exposing response text`, async () => {
    const output: string[] = [];
    const exit = await run(["index", "--json"], {
      env,
      stdout: (s) => output.push(s),
      fetcher: () =>
        Promise.resolve(new Response("secret credential", { status })),
    });
    equal(exit, status < 429 ? 3 : 4);
    equal(JSON.parse(output[0]).success, false);
    assert(!output[0].includes("secret credential"));
  });
}

for (
  const broken of [null, {}, { name: "Inbox", idBoard: "../../other-board" }]
) {
  Deno.test(`index rejects invalid board discovery: ${JSON.stringify(broken)}`, async () => {
    try {
      await loadSearchIndex(
        readConfig(env),
        () => Promise.resolve(Response.json(broken)),
      );
      throw new Error("Expected failure");
    } catch (error) {
      assert(error instanceof InboxError);
      equal(error.code, "INVALID_RESPONSE");
    }
  });
}

Deno.test("index rejects non-Trello card/board URLs and malformed list data", async () => {
  for (const invalid of ["url", "lists", "board"]) {
    try {
      await loadSearchIndex(
        readConfig(env),
        (url) =>
          Promise.resolve(Response.json(
            String(url).includes(`/lists/${listId}`)
              ? inbox
              : String(url).includes("?fields=name,url")
              ? invalid === "board"
                ? { ...board, url: "https://example.com/b/unsafe" }
                : board
              : String(url).includes("/lists/open")
              ? invalid === "lists" ? [{}] : lists
              : [{
                ...card,
                idList: nextId,
                url: invalid === "url" ? "https://example.com" : card.url,
              }],
          )),
      );
      throw new Error("Expected failure");
    } catch (error) {
      assert(error instanceof InboxError);
      equal(error.code, "INVALID_RESPONSE");
    }
  }
});

Deno.test("index network failure is safe and CLI success is structured", async () => {
  try {
    await loadSearchIndex(readConfig(env), () => {
      throw new Error("secret details");
    });
    throw new Error("Expected failure");
  } catch (error) {
    assert(error instanceof InboxError);
    equal(error.code, "NETWORK_ERROR");
    assert(!error.message.includes("secret details"));
  }
  const output: string[] = [];
  equal(
    await run(["index", "--json"], {
      env,
      stdout: (s) => output.push(s),
      fetcher: (url) =>
        Promise.resolve(Response.json(
          String(url).includes(`/lists/${listId}`)
            ? inbox
            : String(url).includes("?fields=name,url")
            ? board
            : String(url).includes("/lists/open")
            ? lists
            : cards,
        )),
    }),
    0,
  );
  equal(JSON.parse(output[0]).index.cards[0].listName, "Next");
});
