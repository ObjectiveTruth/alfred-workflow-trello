// JXA runs on stock macOS; no external JavaScript runtime is needed.
function run(argv) {
  var status = Number(argv[0]);
  var title = "Couldn't save to Trello";
  var message = "Could not confirm creation. Check your list before retrying.";
  var result;
  try {
    result = JSON.parse(argv[1]);
  } catch (_) {
    result = null;
  }
  if (status === 0 && result && result.success && result.card) {
    title = "Added to Trello Inbox";
    message = result.card.name;
  } else {
    if (result && result.error) {
      if (result.error.code === "INVALID_CONFIG") {
        title = "Trello Inbox isn't configured";
      } else if (result.error.code === "AUTH_FAILED") {
        title = "Trello authentication failed";
      }
      message = result.error.message;
    }
    message += status !== 0
      ? " Text copied to clipboard: "
      : " Original text: ";
    message += argv[2];
  }
  return JSON.stringify({
    alfredworkflow: {
      arg: message,
      variables: { notification_title: title },
    },
  });
}
