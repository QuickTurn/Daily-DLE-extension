
browser.commands.onCommand.addListener(async (command) => {

  const storage = await browser.storage.local.get(["playState", "bookmarkData"]);
  const { playState = {}, bookmarkData = {} } = storage;
  const { index = 0, folderId, bookmarkIds = [] } = playState;

  if (!folderId || index >= bookmarkIds.length) {
    console.warn("Kein gültiger PlayState oder Ende erreicht.");
    return;
  }

  const bmId = bookmarkIds[index];

  let bm;
  try {
    const result = await browser.bookmarks.get(bmId);
    bm = result[0];
  } catch (e) {
    console.error("Fehler beim Laden des Bookmarks:", e);
    return;
  }

  let nextIndex = index;

  if (command === "mark_done") {
    console.log("Markiere als erledigt:", bm.title);
    bookmarkData[bm.id] = {
      ...bookmarkData[bm.id],
      doneToday: true,
      lastChecked: new Date().toISOString()
    };
    nextIndex++;
  } else if (command === "skip_game") {
    console.log("Überspringe Spiel:", bm.title);
    nextIndex++;
  } else {
    console.warn("Unbekannter Command:", command);
    return;
  }

  if (nextIndex < bookmarkIds.length) {
    try {
      const nextBm = await browser.bookmarks.get(bookmarkIds[nextIndex]).then(r => r[0]);
      console.log("Öffne nächsten Bookmark:", nextBm.title);
      await browser.tabs.create({ url: nextBm.url });
    } catch (e) {
      console.error("Fehler beim Öffnen des nächsten Bookmarks:", e);
    }
  } else {
    console.log("Alle Spiele erledigt oder übersprungen.");
  }

  // Speicher neuen Zustand
  await browser.storage.local.set({
    playState: { index: nextIndex, folderId, bookmarkIds },
    bookmarkData
  });
});
