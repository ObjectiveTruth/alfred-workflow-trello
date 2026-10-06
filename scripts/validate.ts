import {
  command,
  DISTRIBUTABLE,
  ensureRegularFile,
  readWorkflow,
  validateWorkflow,
} from "./common.ts";

validateWorkflow(await readWorkflow());
for (const name of DISTRIBUTABLE) await ensureRegularFile(`alfred/${name}`);

// Include untracked source during local development, as well as tracked files in CI.
const paths = (await command("git", [
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
]))
  .split("\0").filter(Boolean);
for (const path of paths) {
  if (
    /(^|\/)(prefs\.plist|\.env(?:\..*)?|[^/]+\.(?:p12|pem|key))$/.test(path) &&
    !path.endsWith(".env.example")
  ) {
    throw new Error(
      `Private configuration/signing file must not be tracked: ${path}`,
    );
  }
  if (/^(dist\/|build\/|alfred\/bin\/[^.])/.test(path)) {
    throw new Error(`Generated artifact must not be tracked: ${path}`);
  }
  if (/\.(ts|js|sh|md|json|plist|ya?ml)$/.test(path)) {
    const text = await Deno.readTextFile(path);
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) {
      throw new Error(`Possible private key in ${path}`);
    }
    if (
      /\bTRELLO_(?:API_KEY|API_TOKEN|LIST_ID)\s*[=:]\s*["']?[a-f0-9]{24,}\b/i
        .test(text)
    ) {
      throw new Error(`Possible personal Trello configuration in ${path}`);
    }
  }
}
// Also reject ignored prefs accidentally left in the distributable source tree.
async function checkTree(dir: string): Promise<void> {
  for await (const entry of Deno.readDir(dir)) {
    if (entry.name === "prefs.plist" || entry.name.startsWith(".env")) {
      throw new Error(`Private file in Alfred source: ${dir}/${entry.name}`);
    }
    if (entry.isSymlink) {
      throw new Error(`Symlink in Alfred source: ${entry.name}`);
    }
    if (entry.isDirectory) await checkTree(`${dir}/${entry.name}`);
  }
}
await checkTree("alfred");
console.log(
  "Workflow metadata, distributable files and configuration checks passed.",
);
