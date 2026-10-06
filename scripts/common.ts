export const BUNDLE_ID = "ca.miguelmendez.alfred.trello-inbox";
export const REPOSITORY = "ObjectiveTruth/alfred-workflow-trello";
export const ASSET = "Trello-Inbox.alfredworkflow";
export const TARGET = "aarch64-apple-darwin";
export const DISTRIBUTABLE = [
  "info.plist",
  "icon.png",
  "capture.sh",
  "notification.js",
  "update.sh",
  "UPDATER-LICENSE",
  "UPDATER.md",
];
export const PRIVATE_CONFIG = [
  "TRELLO_API_KEY",
  "TRELLO_API_TOKEN",
  "TRELLO_LIST_ID",
];

export async function command(
  cmd: string,
  args: string[],
  cwd?: string,
): Promise<string> {
  const output = await new Deno.Command(cmd, {
    args,
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (!output.success) {
    throw new Error(
      `${cmd} failed: ${new TextDecoder().decode(output.stderr)}`,
    );
  }
  return new TextDecoder().decode(output.stdout);
}

export interface Workflow {
  bundleid: string;
  version: string;
  variables: Record<string, string>;
  userconfigurationconfig: {
    variable: string;
    config: { default: string; [key: string]: unknown };
  }[];
  [key: string]: unknown;
}

export async function readWorkflow(
  path = "alfred/info.plist",
): Promise<Workflow> {
  return JSON.parse(
    await command("plutil", ["-convert", "json", "-o", "-", path]),
  );
}

export function validateWorkflow(workflow: Workflow): void {
  if (workflow.bundleid !== BUNDLE_ID) {
    throw new Error("Unexpected workflow Bundle ID");
  }
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(workflow.version)) {
    throw new Error("Workflow version must be stable SemVer (X.Y.Z)");
  }
  for (const name of PRIVATE_CONFIG) {
    const fields = workflow.userconfigurationconfig.filter((field) =>
      field.variable === name
    );
    if (fields.length !== 1 || fields[0].config.default !== "") {
      throw new Error(
        `${name} must have exactly one configuration field with a blank default`,
      );
    }
    if (workflow.variables[name]) {
      throw new Error(`${name} must not have an environment default`);
    }
  }
  if (
    workflow.variables.update_repo !== REPOSITORY ||
    workflow.variables.update_asset !== ASSET
  ) {
    throw new Error(
      "Updater repository or asset does not match this repository",
    );
  }
}

export async function ensureRegularFile(path: string): Promise<void> {
  if (!(await Deno.lstat(path)).isFile) {
    throw new Error(`Expected regular file: ${path}`);
  }
}
