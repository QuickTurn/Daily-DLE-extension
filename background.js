browser.commands.onCommand.addListener(async (command) => {
  const storage = await browser.storage.local.get(["playState", "bookmarkData"]);
  const { playState = {}, bookmarkData = {} } = storage;
  const { index = 0, folderId, bookmarkIds = [] } = playState;

  if (!folderId || index >= bookmarkIds.length) return;

  const bmId = bookmarkIds[index];
  const bm = await browser.bookmarks.get(bmId).then(r => r[0]);

  if (command === "mark_done") {
    bookmarkData[bm.id] = {
      ...bookmarkData[bm.id],
      doneToday: true,
      lastChecked: new Date().toISOString()
    };
  }

  const nextIndex = index + 1;
  if (nextIndex < bookmarkIds.length) {
    const nextBm = await browser.bookmarks.get(bookmarkIds[nextIndex]).then(r => r[0]);
    await browser.tabs.create({ url: nextBm.url });
    await browser.storage.local.set({
      bookmarkData,
      playState: { index: nextIndex, folderId, bookmarkIds }
    });
  } else {
    console.log("Reached end of bookmark list.");
    await browser.storage.local.set({ bookmarkData, playState: { index: 0 } });
  }
});
