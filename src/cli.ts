import { readConfig, type ReadEnv } from "./config.ts";
import { InboxError, safeError } from "./errors.ts";
import { createCard, type Fetch } from "./trello.ts";
import type { Result } from "./types.ts";

interface Dependencies {
  env?: ReadEnv;
  fetcher?: Fetch;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}

export async function run(
  args: string[],
  deps: Dependencies = {},
): Promise<number> {
  const stdout = deps.stdout ?? console.log;
  const stderr = deps.stderr ?? console.error;
  const json = args.at(-1) === "--json";
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    stdout('Usage: trello-inbox add "Card title" [--json]');
    return 0;
  }
  let result: Result;
  let exitCode = 0;
  try {
    const positional = json ? args.slice(0, -1) : args;
    if (positional.length !== 2 || positional[0] !== "add") {
      throw new InboxError(
        "INVALID_INPUT",
        'Usage: trello-inbox add "Card title" [--json]',
        2,
      );
    }
    if (!positional[1].trim()) {
      throw new InboxError("INVALID_INPUT", "Enter a non-empty card title.", 2);
    }
    const card = await createCard(
      readConfig(deps.env),
      positional[1],
      deps.fetcher,
    );
    result = { success: true, card };
  } catch (error) {
    const safe = safeError(error);
    exitCode = safe.exitCode;
    result = {
      success: false,
      error: { code: safe.code, message: safe.message },
    };
  }
  if (json) stdout(JSON.stringify(result));
  else if (result.success) {
    stdout(`Added to Trello Inbox: ${result.card.name}\n${result.card.url}`);
  } else stderr(result.error.message);
  return exitCode;
}

if (import.meta.main) Deno.exit(await run(Deno.args));
