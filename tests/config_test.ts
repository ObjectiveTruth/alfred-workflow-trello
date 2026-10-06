import { readConfig } from "../src/config.ts";
import { InboxError } from "../src/errors.ts";
import { assert, env, environment, equal, listId } from "./helpers.ts";

Deno.test("configuration reads only the three expected variables and trims values", () => {
  const accessed: string[] = [];
  equal(
    readConfig((name) => {
      accessed.push(name);
      return ` ${env(name)} `;
    }),
    {
      credentials: { apiKey: "test-key", token: "test-token" },
      listId,
    },
  );
  equal(accessed, Object.keys(environment));
});

for (const name of Object.keys(environment)) {
  for (const value of [undefined, "", "  "]) {
    Deno.test(`configuration rejects missing/blank ${name}: ${JSON.stringify(value)}`, () => {
      try {
        readConfig((key) => key === name ? value : env(key));
        throw new Error("Expected invalid config");
      } catch (error) {
        assert(error instanceof InboxError);
        equal(error.code, "INVALID_CONFIG");
        equal(error.exitCode, 2);
      }
    });
  }
}

Deno.test("configuration rejects a list name or URL", () => {
  for (const list of ["Inbox", "https://trello.com/b/test", "abcdef"]) {
    try {
      readConfig((name) => name === "TRELLO_LIST_ID" ? list : env(name));
      throw new Error("Expected invalid list ID");
    } catch (error) {
      assert(error instanceof InboxError);
      equal(error.exitCode, 2);
    }
  }
});
