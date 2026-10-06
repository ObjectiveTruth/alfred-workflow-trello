import {
  BUNDLE_ID,
  command,
  PRIVATE_CONFIG,
  readWorkflow,
  validateWorkflow,
} from "./common.ts";

const archive = Deno.args[0];
if (!archive || Deno.args.length !== 1) {
  throw new Error(
    "Usage: deno task import-alfred ~/Downloads/Trello-Inbox.alfredworkflow",
  );
}
const files = (await command("unzip", ["-Z1", archive])).trim().split("\n");
if (
  files.some((path) => path.startsWith("/") || path.split("/").includes(".."))
) {
  throw new Error("Unsafe path in workflow archive");
}
for (const name of ["info.plist", "icon.png"]) {
  if (files.filter((path) => path === name).length !== 1) {
    throw new Error(`Archive must contain exactly one ${name}`);
  }
}
if (files.some((path) => path.split("/").at(-1) === "prefs.plist")) {
  console.warn(
    "Ignoring prefs.plist from export; personal preferences are never imported.",
  );
}
await Deno.mkdir("build", { recursive: true });
const stage = await Deno.makeTempDir({ dir: "build", prefix: "import-" });
try {
  // Extract bytes to fixed paths, not archive-controlled paths or symlinks.
  for (const name of ["info.plist", "icon.png"]) {
    const output = await new Deno.Command("unzip", {
      args: ["-p", archive, name],
      stdout: "piped",
      stderr: "piped",
    }).output();
    if (!output.success) throw new Error(`Could not read ${name}`);
    await Deno.writeFile(`${stage}/${name}`, output.stdout);
  }
  const workflow = await readWorkflow(`${stage}/info.plist`);
  if (workflow.bundleid !== BUNDLE_ID) {
    throw new Error("Export belongs to a different workflow");
  }
  for (const name of PRIVATE_CONFIG) {
    delete workflow.variables[name];
    for (const field of workflow.userconfigurationconfig) {
      if (field.variable === name) field.config.default = "";
    }
  }
  validateWorkflow(workflow);
  await Deno.writeTextFile(`${stage}/info.json`, JSON.stringify(workflow));
  await command("plutil", [
    "-convert",
    "xml1",
    "-o",
    `${stage}/info.plist`,
    `${stage}/info.json`,
  ]);
  for (const name of ["info.plist", "icon.png"]) {
    await Deno.copyFile(`${stage}/${name}`, `alfred/${name}`);
  }
  console.log(
    "Imported canvas metadata and icon; cleared credential/list defaults. Review git diff before committing.",
  );
  console.log(
    "Bundled binaries and scripts were not imported. Edit scripts in this repository.",
  );
} finally {
  await Deno.remove(stage, { recursive: true });
}
