browser.commands.onCommand.addListener(async (command) => {
  const storage = await browser.storage.local.get(["playState", "bookmarkData"]);
  const { playState = {}, bookmarkData = {} } = storage;
  const { index = 0, folderId, bookmarkIds = [] } = playState;

  if (!folderId || index >= bookmarkIds.length) {
    console.log("No valid play state or end reached.");
    return;
  }

  const bmId = bookmarkIds[index];
  const bm = await browser.bookmarks.get(bmId).then(r => r[0]);

  let nextIndex = index;

  if (command === "mark_done") {
    bookmarkData[bm.id] = {
      ...bookmarkData[bm.id],
      doneToday: true,
      lastChecked: new Date().toISOString()
    };
    nextIndex++;
  } else if (command === "skip_game") {
    console.log("Skipping game:", bm.title);
    nextIndex++;
  } else {
    console.warn("Unknown command:", command);
    return;
  }

  if (nextIndex < bookmarkIds.length) {
    const nextBm = await browser.bookmarks.get(bookmarkIds[nextIndex]).then(r => r[0]);
    await browser.tabs.create({ url: nextBm.url });
  } else {
    console.log("All games done or skipped.");
  }

  await browser.storage.local.set({
    playState: { index: nextIndex, folderId, bookmarkIds },
    bookmarkData
  });
});
