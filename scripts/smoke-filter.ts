import { assert, equal } from "../tests/helpers.ts";

// Exercise the real packaged JXA adapter; no Trello access or user preferences.
export async function smokeFilter(
  workflow: string,
  stage: string,
): Promise<void> {
  const cache = `${stage}/filter-cache`;
  await Deno.mkdir(cache);
  const query = 'Call "RBC" 🥑';
  async function filter(text: string, session: Record<string, string> = {}) {
    const output = await new Deno.Command("/usr/bin/osascript", {
      args: ["-l", "JavaScript", `${workflow}/filter.js`, text, cache],
      clearEnv: true,
      env: { PATH: "/usr/bin:/bin", ...session },
    }).output();
    assert(output.success, new TextDecoder().decode(output.stderr));
    return JSON.parse(new TextDecoder().decode(output.stdout));
  }
  const empty = await filter("");
  equal(empty.items[0].valid, false);
  const cold = await filter(query);
  equal(cold.items.length, 1);
  equal(cold.items[0].arg, ["create", query]);
  equal(cold.items[0].subtitle, "Add to Inbox");
  equal(cold.rerun, 0.2);
  const timedOut = await filter(query, {
    tin_query: query,
    tin_started: String(Date.now() - 15000),
  });
  equal(timedOut.items[1].title, "Search unavailable");
  equal(timedOut.rerun, undefined);
  const fixture = {
    success: true,
    index: {
      inbox: { id: "fixture", name: "My Inbox" },
      cards: [
        {
          id: "2",
          name: "Call RBC about banking",
          listName: "Next",
          url: "https://trello.com/c/two",
        },
        {
          id: "1",
          name: "Call RBC",
          listName: "Inbox",
          url: "https://trello.com/c/one",
        },
        {
          id: "3",
          name: "RBC: call tomorrow",
          listName: "Waiting",
          url: "https://trello.com/c/three",
        },
        {
          id: "4",
          name: "Unrelated task",
          listName: "Done",
          url: "https://trello.com/c/four",
        },
      ],
    },
  };
  await Deno.writeTextFile(`${cache}/index.json`, JSON.stringify(fixture));
  const found = await filter("call rbc");
  equal(found.skipknowledge, true);
  equal(found.items[0].arg, ["create", "call rbc"]);
  equal(found.items[0].subtitle, "Add to My Inbox");
  equal(found.items.slice(1).map((item: { title: string }) => item.title), [
    "Call RBC",
    "Call RBC about banking",
    "RBC: call tomorrow",
  ]);
  equal(found.items[2].subtitle, "Next · Open in Trello");
  equal(found.items[1].arg, ["open", "https://trello.com/c/one"]);
  equal(found.rerun, undefined);
  // An arriving background refresh must not change selected matches.
  fixture.index.cards.reverse();
  fixture.index.cards[0].name = "Call RBC changed elsewhere";
  await Deno.writeTextFile(`${cache}/index.json`, JSON.stringify(fixture));
  const frozen = await filter("call rbc", found.variables);
  equal(frozen.items, found.items);
  const changedQuery = await filter("elsewhere", found.variables);
  equal(changedQuery.items[1].title, "Call RBC changed elsewhere");
  await Deno.writeTextFile(
    `${cache}/error.json`,
    JSON.stringify({ success: false }),
  );
  const stale = await filter("call rbc");
  equal(stale.items.at(-1).title, "Search could not refresh");
  await Deno.remove(`${cache}/index.json`);
  const failed = await filter(query);
  equal(failed.items[0].arg, ["create", query]);
  equal(failed.items[1].title, "Search unavailable");
  equal(failed.items[1].valid, false);
  console.log(
    "Search UI: Create first, blank input, loading, matching, list subtitles, errors and stable selection passed.",
  );
}
