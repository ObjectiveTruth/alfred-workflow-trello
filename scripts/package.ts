import {
  ASSET,
  command,
  DISTRIBUTABLE,
  ensureRegularFile,
  readWorkflow,
  validateWorkflow,
} from "./common.ts";

validateWorkflow(await readWorkflow());
await ensureRegularFile("dist/trello-inbox");
const binary = await command("file", ["dist/trello-inbox"]);
if (!binary.includes("Mach-O 64-bit executable arm64")) {
  throw new Error("Build an Apple Silicon executable before packaging");
}
await Deno.mkdir("build", { recursive: true });
const stage = await Deno.makeTempDir({ dir: "build", prefix: "package-" });
try {
  await Deno.mkdir(`${stage}/bin`);
  // An explicit allowlist makes accidental inclusion of prefs, .env or source impossible.
  for (const name of DISTRIBUTABLE) {
    await ensureRegularFile(`alfred/${name}`);
    await Deno.copyFile(`alfred/${name}`, `${stage}/${name}`);
  }
  await Deno.copyFile("dist/trello-inbox", `${stage}/bin/trello-inbox`);
  for (
    const file of [
      "capture.sh",
      "action.sh",
      "filter.sh",
      "refresh.sh",
      "update.sh",
      "bin/trello-inbox",
    ]
  ) {
    await Deno.chmod(`${stage}/${file}`, 0o755);
  }
  const output = `${Deno.cwd()}/dist/${ASSET}`;
  try {
    await Deno.remove(output);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  await command("zip", [
    "-q",
    "-X",
    output,
    ...DISTRIBUTABLE,
    "bin/trello-inbox",
  ], stage);
  const contents = (await command("unzip", ["-Z1", output])).trim().split("\n")
    .sort();
  const expected = [...DISTRIBUTABLE, "bin/trello-inbox"].sort();
  if (JSON.stringify(contents) !== JSON.stringify(expected)) {
    throw new Error("Unexpected package contents");
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await Deno.readFile(output),
  );
  const hex = Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  await Deno.writeTextFile("dist/checksums.txt", `${hex}  ${ASSET}\n`);
  console.log(`Packaged dist/${ASSET}; SHA-256 written to dist/checksums.txt`);
} finally {
  await Deno.remove(stage, { recursive: true });
}
