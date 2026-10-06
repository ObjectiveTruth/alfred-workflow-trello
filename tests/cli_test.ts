import { run } from "../src/cli.ts";
import { assert, card, env, equal } from "./helpers.ts";

Deno.test("CLI returns structured success only after the request resolves", async () => {
  const stdout: string[] = [];
  let resolve!: (response: Response) => void;
  const pending = run(["add", card.name, "--json"], {
    env,
    stdout: (text) => stdout.push(text),
    fetcher: () =>
      new Promise((r) => {
        resolve = r;
      }),
  });
  equal(stdout, []);
  resolve(Response.json(card));
  equal(await pending, 0);
  equal(JSON.parse(stdout[0]), { success: true, card });
});

for (const [status, exit] of [[401, 3], [403, 3], [429, 4], [500, 4]]) {
  Deno.test(`CLI HTTP ${status} gives JSON failure and exit ${exit}`, async () => {
    const output: string[] = [];
    equal(
      await run(["add", "test", "--json"], {
        env,
        fetcher: () => Promise.resolve(new Response("", { status })),
        stdout: (text) => output.push(text),
        stderr: () => {
          throw new Error("Unexpected stderr");
        },
      }),
      exit,
    );
    assert(JSON.parse(output[0]).success === false);
  });
}

Deno.test("CLI missing config, usage and empty text never call Trello", async () => {
  for (
    const args of [["add", "test", "--json"], ["add", " ", "--json"], [
      "bad",
      "--json",
    ], ["add", "a", "b", "--json"]]
  ) {
    const output: string[] = [];
    equal(
      await run(args, {
        env: () => undefined,
        stdout: (text) => output.push(text),
        fetcher: () => {
          throw new Error("Must not fetch");
        },
      }),
      2,
    );
    assert(JSON.parse(output[0]).success === false);
  }
});

Deno.test("CLI unexpected exceptions get exit 1 without disclosing details", async () => {
  const output: string[] = [];
  equal(
    await run(["add", "test", "--json"], {
      env: () => {
        throw new Error("private data");
      },
      stdout: (text) => output.push(text),
    }),
    1,
  );
  equal(JSON.parse(output[0]).error.code, "RUNTIME_ERROR");
  assert(!output[0].includes("private data"));
});

Deno.test("CLI supports plain output, stderr failures and credential-free help", async () => {
  const output: string[] = [];
  const errors: string[] = [];
  const deps = {
    env,
    stdout: (text: string) => output.push(text),
    stderr: (text: string) => errors.push(text),
  };
  equal(
    await run(["add", card.name], {
      ...deps,
      fetcher: () => Promise.resolve(Response.json(card)),
    }),
    0,
  );
  assert(output[0].includes(card.url));
  equal(await run([], deps), 2);
  assert(errors[0].includes("Usage:"));
  equal(
    await run(["--help"], {
      ...deps,
      env: () => {
        throw new Error("Must not read env");
      },
    }),
    0,
  );
});
