import { readConfig } from "../src/config.ts";
import { InboxError } from "../src/errors.ts";
import { cardPayload, createCard, type Fetch } from "../src/trello.ts";
import { assert, card, env, equal, listId } from "./helpers.ts";

Deno.test("payload preserves punctuation, Unicode, whitespace and shell-like input", () => {
  const name = ' Buy 🥑 & cardboard\n"quoted" $(do-not-run) ';
  const payload = cardPayload(listId, name);
  equal(payload.get("idList"), listId);
  equal(payload.get("name"), name);
  equal(Array.from(payload.keys()), ["idList", "name"]);
});

Deno.test("create card uses POST, header auth, restricted URL and parses confirmed success", async () => {
  const fetcher: Fetch = (url, init) => {
    equal(url, "https://api.trello.com/1/cards");
    equal(init?.method, "POST");
    equal(init?.redirect, "error");
    equal(
      new Headers(init?.headers).get("Authorization"),
      'OAuth oauth_consumer_key="test-key", oauth_token="test-token"',
    );
    assert(init?.signal instanceof AbortSignal);
    equal((init?.body as URLSearchParams).get("name"), card.name);
    return Promise.resolve(Response.json({ ...card, extra: "ignored" }));
  };
  equal(await createCard(readConfig(env), card.name, fetcher), card);
});

Deno.test("authentication can be replaced independently of card creation", async () => {
  await createCard(readConfig(env), card.name, (_url, init) => {
    equal(new Headers(init?.headers).get("Authorization"), "Bearer test");
    return Promise.resolve(Response.json(card));
  }, () => ({ Authorization: "Bearer test" }));
});

for (
  const [status, code, exit] of [
    [401, "AUTH_FAILED", 3],
    [403, "AUTH_FAILED", 3],
    [400, "API_ERROR", 4],
    [429, "API_ERROR", 4],
    [500, "API_ERROR", 4],
  ] as const
) {
  Deno.test(`HTTP ${status} is safe and returns ${code}`, async () => {
    try {
      await createCard(
        readConfig(env),
        card.name,
        () => Promise.resolve(new Response("secret response body", { status })),
      );
      throw new Error("Expected API failure");
    } catch (error) {
      assert(error instanceof InboxError);
      equal(error.code, code);
      equal(error.exitCode, exit);
      assert(!error.message.includes("secret"));
    }
  });
}

for (
  const body of [
    "bad JSON",
    "null",
    "{}",
    JSON.stringify({ ...card, id: 4 }),
    JSON.stringify({ ...card, url: "https://example.com/c/test" }),
  ]
) {
  Deno.test(`malformed response is rejected: ${body}`, async () => {
    try {
      await createCard(
        readConfig(env),
        card.name,
        () => Promise.resolve(new Response(body)),
      );
      throw new Error("Expected malformed response");
    } catch (error) {
      assert(error instanceof InboxError);
      equal(error.code, "INVALID_RESPONSE");
    }
  });
}

Deno.test("network exceptions are sanitized and never retried", async () => {
  let calls = 0;
  try {
    await createCard(readConfig(env), card.name, () => {
      calls++;
      throw new Error("secret-token");
    });
    throw new Error("Expected failure");
  } catch (error) {
    assert(error instanceof InboxError);
    equal(error.code, "NETWORK_ERROR");
    assert(!error.message.includes("secret-token"));
    assert(error.message.includes("before retrying"));
  }
  equal(calls, 1);
});
