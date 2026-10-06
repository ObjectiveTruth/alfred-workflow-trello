import { command, readWorkflow, TARGET, validateWorkflow } from "./common.ts";

validateWorkflow(await readWorkflow());
await Deno.mkdir("dist", { recursive: true });
console.log(
  await command("deno", [
    "compile",
    "--target",
    TARGET,
    "--no-prompt",
    "--allow-net=api.trello.com",
    "--allow-env=TRELLO_API_KEY,TRELLO_API_TOKEN,TRELLO_LIST_ID",
    "--output",
    "dist/trello-inbox",
    "src/cli.ts",
  ]),
);
console.log(`Built dist/trello-inbox (${TARGET})`);
