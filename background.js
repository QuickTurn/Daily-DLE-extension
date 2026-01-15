async function getBookmarkById(bmId) {
  try {
    const result = await browser.bookmarks.get(bmId);
    return result[0];
  } catch (e) {
    console.error("Failed to load bookmark:", e);
    return null;
  }
}

async function markBookmarkDone(bmId, bookmarkData) {
  bookmarkData[bmId] = {
    ...bookmarkData[bmId],
    doneToday: true,
    lastChecked: new Date().toISOString()
  };
  return bookmarkData;
}

async function openNextBookmark(bookmarkIds, nextIndex) {
  if (nextIndex >= bookmarkIds.length) {
    console.log("All games completed or skipped.");
    return false;
  }

  const nextBm = await getBookmarkById(bookmarkIds[nextIndex]);
  if (nextBm) {
    console.log("Opening next bookmark:", nextBm.title);
    await browser.tabs.create({ url: nextBm.url });
    return true;
  }

  return false;
}

async function handlePlayCommand(command) {
  const storage = await browser.storage.local.get(["playState", "bookmarkData"]);
  const { playState = {}, bookmarkData = {} } = storage;
  const { index = 0, folderId, bookmarkIds = [] } = playState;

  if (!folderId || index >= bookmarkIds.length) {
    console.warn("No valid playState or end reached.");
    return;
  }

  const bmId = bookmarkIds[index];
  const bm = await getBookmarkById(bmId);
  if (!bm) return;

  let nextIndex = index;
  let updatedBookmarkData = bookmarkData;

  if (command === "mark_done") {
    console.log("Marking as done:", bm.title);
    updatedBookmarkData = await markBookmarkDone(bm.id, bookmarkData);
    nextIndex++;
  } else if (command === "skip_game") {
    console.log("Skipping game:", bm.title);
    nextIndex++;
  } else {
    console.warn("Unknown command:", command);
    return;
  }

  await openNextBookmark(bookmarkIds, nextIndex);

  await browser.storage.local.set({
    playState: { index: nextIndex, folderId, bookmarkIds },
    bookmarkData: updatedBookmarkData
  });
}

async function resetDailyStatus() {
  const { bookmarkData = {} } = await browser.storage.local.get("bookmarkData");
  const now = new Date();
  const todayUTC = now.toISOString().split("T")[0];
  let hasChanges = false;

  for (const [id, data] of Object.entries(bookmarkData)) {
    if (!data.lastChecked) continue;
    const lastDate = data.lastChecked.split("T")[0];
    if (lastDate < todayUTC) {
      data.doneToday = false;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    await browser.storage.local.set({ bookmarkData });
    console.log("Daily reset executed:", new Date().toLocaleString());
  }
}

function scheduleDailyReset() {
  const now = new Date();
  const target = new Date();
  target.setUTCHours(0, 0, 0, 0);
  
  if (target < now) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  const delayMinutes = (target - now) / 60000;

  browser.alarms.create("dailyReset", {
    delayInMinutes: delayMinutes,
    periodInMinutes: 24 * 60
  });
}

browser.commands.onCommand.addListener(handlePlayCommand);

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReset") {
    resetDailyStatus();
  }
});

scheduleDailyReset();