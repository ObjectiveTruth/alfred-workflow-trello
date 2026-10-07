// Alfred adapter, executed by macOS JXA. Reads only the local search cache.
// Network activity runs separately so the Create row never waits for Trello.
ObjC.import("Foundation");

function env(name) {
  var value = $.NSProcessInfo.processInfo.environment.objectForKey(name);
  return value.isNil() ? "" : ObjC.unwrap(value);
}

function readJSON(path) {
  try {
    var text = $.NSString.stringWithContentsOfFileEncodingError(
      path,
      $.NSUTF8StringEncoding,
      null,
    );
    return JSON.parse(ObjC.unwrap(text));
  } catch (_) {
    return null;
  }
}

function normalize(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function matches(cards, query) {
  var needle = normalize(query.trim());
  var words = needle.split(/\s+/);
  return cards.map(function (card) {
    var name = normalize(card.name);
    // All query words must match the title, in any order. Prefer exact titles,
    // then prefixes, then phrases; stable ties prevent jitter between refreshes.
    if (
      !words.every(function (word) {
        return name.indexOf(word) !== -1;
      })
    ) return null;
    var score = name === needle
      ? 0
      : name.indexOf(needle) === 0
      ? 1
      : name.indexOf(needle) !== -1
      ? 2
      : 3;
    return { card: card, score: score };
  }).filter(function (row) {
    return row !== null;
  }).sort(function (a, b) {
    return a.score - b.score || a.card.name.localeCompare(b.card.name) ||
      a.card.id.localeCompare(b.card.id);
  }).slice(0, 5).map(function (row) {
    return row.card;
  });
}

function run(argv) {
  var query = argv[0] || "";
  var cache = argv[1];
  var data = readJSON(cache + "/index.json");
  var error = readJSON(cache + "/error.json");
  var index = data && data.success && data.index;
  var now = Date.now();
  var started = env("tin_query") === query
    ? Number(env("tin_started")) || now
    : now;
  if (!query.trim()) {
    var board = index && index.board;
    var hasBoard = board && typeof board.url === "string" &&
      /^https:\/\/trello\.com\/b\/[^\s]+$/.test(board.url);
    var loading = !hasBoard && !error && now - started < 12000;
    var boardOutput = {
      skipknowledge: true,
      items: [{
        uid: "tin-board",
        title: hasBoard
          ? "Open Trello board"
          : loading
          ? "Loading Trello board…"
          : "Trello board unavailable",
        subtitle: hasBoard
          ? board.name + " · Open in Trello"
          : loading
          ? "Finding the board for your Inbox"
          : "Check your connection and workflow configuration, then try again.",
        valid: !!hasBoard,
        arg: hasBoard ? ["open", board.url] : undefined,
      }],
      variables: {
        tin_query: query,
        tin_rows: "",
        tin_started: loading ? String(started) : "",
      },
    };
    if (loading) boardOutput.rerun = 0.2;
    return JSON.stringify(boardOutput);
  }
  // Once matches are visible, freeze this query's results for the session.
  // Typing a changed query takes a fresh snapshot; selecting with arrows does not.
  if (env("tin_query") === query && env("tin_rows")) {
    try {
      return JSON.stringify({
        skipknowledge: true,
        items: JSON.parse(env("tin_rows")),
      });
    } catch (_) { /* Rebuild an invalid session. */ }
  }
  var hasIndex = index && index.inbox && Array.isArray(index.cards);
  var items = [{
    uid: "tin-create",
    title: "Create “" + query + "”",
    subtitle: "Add to " + (hasIndex ? index.inbox.name : "Inbox"),
    valid: true,
    arg: ["create", query],
    variables: { tin_cache: cache },
    text: { copy: query },
  }];
  var output = { skipknowledge: true, items: items };
  if (hasIndex) {
    matches(index.cards, query).forEach(function (card) {
      items.push({
        uid: "tin-card-" + card.id,
        title: card.name,
        subtitle: card.listName + " · Open in Trello",
        valid: true,
        arg: ["open", card.url],
        text: { copy: card.url },
        quicklookurl: card.url,
      });
    });
  }
  if (error) {
    items.push({
      uid: "tin-search-error",
      title: hasIndex ? "Search could not refresh" : "Search unavailable",
      subtitle: hasIndex
        ? "Showing saved results; list names may be out of date"
        : "You can still create a card. Check your connection and token read access.",
      valid: false,
    });
  }
  if (!hasIndex && !error && now - started < 12000) {
    // Only the Create row exists while loading, so adding results cannot replace
    // an existing selected card. Keep its stable UID across reruns.
    output.rerun = 0.2;
    output.variables = {
      tin_query: query,
      tin_started: String(started),
      tin_rows: "",
    };
  } else {
    if (!hasIndex && !error) {
      items.push({
        uid: "tin-search-timeout",
        title: "Search unavailable",
        subtitle: "You can still create a card. Try searching again shortly.",
        valid: false,
      });
    }
    output.variables = {
      tin_query: query,
      tin_rows: JSON.stringify(items),
      tin_started: "",
    };
  }
  return JSON.stringify(output);
}
