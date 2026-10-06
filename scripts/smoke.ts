import { ASSET, command, readWorkflow, validateWorkflow } from "./common.ts";
import { assert, equal } from "../tests/helpers.ts";
import { smokeFilter } from "./smoke-filter.ts";

const root = Deno.cwd();
await Deno.mkdir("build", { recursive: true });
const relativeStage = await Deno.makeTempDir({
  dir: "build",
  prefix: "smoke-",
});
const stage = `${root}/${relativeStage}`;
const systemPath = "/usr/bin:/bin:/usr/sbin:/sbin";
const decoder = new TextDecoder();
try {
  await command("unzip", [
    "-q",
    `${root}/dist/${ASSET}`,
    "-d",
    `${stage}/workflow`,
  ]);
  validateWorkflow(await readWorkflow(`${stage}/workflow/info.plist`));
  await smokeFilter(`${stage}/workflow`, stage);
  const binary = `${stage}/workflow/bin/trello-inbox`;
  const help = await new Deno.Command(binary, {
    args: ["--help"],
    clearEnv: true,
    env: { PATH: systemPath },
  }).output();
  equal(help.code, 0);
  assert(decoder.decode(help.stdout).includes("Usage:"));
  const missing = await new Deno.Command(binary, {
    args: ["add", "smoke test", "--json"],
    clearEnv: true,
    env: { PATH: systemPath },
  }).output();
  equal(missing.code, 2);
  equal(
    JSON.parse(decoder.decode(missing.stdout)).error.code,
    "INVALID_CONFIG",
  );
  console.log("Packaged ARM64 binary runs with no Deno/Node/Homebrew in PATH.");

  const original = 'A title with "quotes", 🥑 and $(not-a-command)';
  for (
    const [status, payload, title] of [
      [
        "0",
        JSON.stringify({ success: true, card: { name: original } }),
        "Added to Trello Inbox",
      ],
      ["2", decoder.decode(missing.stdout), "Trello Inbox isn't configured"],
      [
        "3",
        JSON.stringify({
          success: false,
          error: { code: "AUTH_FAILED", message: "Check credentials" },
        }),
        "Trello authentication failed",
      ],
      ["1", "invalid JSON", "Couldn't save to Trello"],
    ]
  ) {
    const response = JSON.parse(
      await command("/usr/bin/osascript", [
        "-l",
        "JavaScript",
        `${stage}/workflow/notification.js`,
        status,
        payload,
        original,
      ]),
    );
    equal(response.alfredworkflow.variables.notification_title, title);
    assert(response.alfredworkflow.arg.includes(original));
  }
  console.log(
    "Alfred notification adapter handles confirmed success and failures.",
  );

  const mocks = `${stage}/mocks`;
  await Deno.mkdir(mocks);
  await Deno.writeTextFile(
    `${mocks}/curl`,
    '#!/bin/bash\nif [ "$MOCK_RELEASE" = offline ]; then exit 22; fi\nprintf \'{\n  "tag_name": "%s"\n}\n\' "$MOCK_RELEASE"\n',
  );
  await Deno.chmod(`${mocks}/curl`, 0o755);
  for (
    const [release, installed, valid, title] of [
      ["v0.2.0", "0.1.0", true, "Update to v0.2.0"],
      ["v0.1.0", "0.1.0", false, "Up to date"],
      ["v0.1.0", "0.2.0", false, "Up to date"],
      ["offline", "0.1.0", false, "Could not check for updates"],
    ] as const
  ) {
    const output = await new Deno.Command("/bin/bash", {
      args: [`${stage}/workflow/update.sh`],
      clearEnv: true,
      env: {
        PATH: `${mocks}:${systemPath}`,
        MOCK_RELEASE: release,
        update_repo: "ObjectiveTruth/alfred-workflow-trello",
        update_asset: ASSET,
        alfred_workflow_version: installed,
      },
    }).output();
    equal(output.code, 0);
    const item = JSON.parse(decoder.decode(output.stdout)).items[0];
    equal(item.valid, valid);
    assert(item.title.startsWith(title));
    if (valid) {
      equal(
        item.arg,
        `https://github.com/ObjectiveTruth/alfred-workflow-trello/releases/latest/download/${ASSET}`,
      );
    }
  }
  console.log(
    "Vendored updater handles newer/current/older releases and network failures.",
  );

  // Run the real export importer in an isolated working directory, never against
  // the author's source or installed workflow preferences.
  const sandbox = `${stage}/import-test`;
  await Deno.mkdir(`${sandbox}/alfred`, { recursive: true });
  const exported = await readWorkflow();
  exported.variables.TRELLO_API_TOKEN = "synthetic-export-value";
  for (const field of exported.userconfigurationconfig) {
    if (field.variable === "TRELLO_LIST_ID") {
      field.config.default = "synthetic-list-value";
    }
  }
  await Deno.writeTextFile(
    `${stage}/workflow/info.json`,
    JSON.stringify(exported),
  );
  await command("plutil", [
    "-convert",
    "xml1",
    "-o",
    `${stage}/workflow/info.plist`,
    `${stage}/workflow/info.json`,
  ]);
  await Deno.writeTextFile(
    `${stage}/workflow/prefs.plist`,
    "synthetic local preferences",
  );
  await command("zip", [
    "-q",
    `${stage}/export.alfredworkflow`,
    "info.plist",
    "icon.png",
    "prefs.plist",
    "bin/trello-inbox",
  ], `${stage}/workflow`);
  await command(Deno.execPath(), [
    "run",
    "--no-config",
    "--allow-read",
    "--allow-write",
    "--allow-run=plutil,unzip",
    `${root}/scripts/import-alfred-export.ts`,
    `${stage}/export.alfredworkflow`,
  ], sandbox);
  validateWorkflow(await readWorkflow(`${sandbox}/alfred/info.plist`));
  equal(
    Array.from(Deno.readDirSync(`${sandbox}/alfred`), (entry) => entry.name)
      .sort(),
    ["icon.png", "info.plist"],
  );
  const before = await Deno.readTextFile(`${sandbox}/alfred/info.plist`);
  exported.bundleid = "invalid.foreign.workflow";
  await Deno.writeTextFile(
    `${stage}/workflow/info.json`,
    JSON.stringify(exported),
  );
  await command("plutil", [
    "-convert",
    "xml1",
    "-o",
    `${stage}/workflow/info.plist`,
    `${stage}/workflow/info.json`,
  ]);
  await command("zip", [
    "-q",
    `${stage}/foreign.alfredworkflow`,
    "info.plist",
    "icon.png",
  ], `${stage}/workflow`);
  const rejected = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--no-config",
      "--allow-read",
      "--allow-write",
      "--allow-run=plutil,unzip",
      `${root}/scripts/import-alfred-export.ts`,
      `${stage}/foreign.alfredworkflow`,
    ],
    cwd: sandbox,
  }).output();
  assert(!rejected.success);
  equal(await Deno.readTextFile(`${sandbox}/alfred/info.plist`), before);
  console.log(
    "Export importer strips personal defaults/preferences and rejects foreign Bundle IDs.",
  );
} finally {
  await Deno.remove(stage, { recursive: true });
}
