// Reagiert auf die Hotkeys. Entweder Überspringen oder als erledigt markieren.
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
      await browser.tabs.create({ url: nextBm.url }); // bewusst neuer Tab (Punkt 5 NICHT umgesetzt)
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

// Setzt täglich die doneToday-Flags zurück, wenn der Tag wechselt.
async function resetDailyStatus() {
  const { bookmarkData = {} } = await browser.storage.local.get("bookmarkData");
  const now = new Date();
  const todayUTC = now.toISOString().split("T")[0];

  for (const [id, data] of Object.entries(bookmarkData)) {
    if (!data.lastChecked) continue;
    const lastDate = data.lastChecked.split("T")[0];
    if (lastDate < todayUTC) {
      data.doneToday = false;
    }
  }

  await browser.storage.local.set({ bookmarkData });
  console.log("✅ Daily reset ausgeführt:", new Date().toLocaleString());
}

// Plant einen wiederkehrenden Alarm, der täglich um 02:00 (GMT+2) den Reset auslöst.
function scheduleDailyReset() {
  // 02:00 GMT+2 entspricht 00:00 UTC
  const now = new Date();
  const target = new Date();
  target.setUTCHours(0, 0, 0, 0); // 00:00 UTC = 02:00 GMT+2
  if (target < now) target.setUTCDate(target.getUTCDate() + 1);
  const delayMinutes = (target - now) / 60000;

  browser.alarms.create("dailyReset", {
    delayInMinutes: delayMinutes,
    periodInMinutes: 24 * 60
  });
}

// Startet den täglichen Reset, wenn der Alarm auslöst.
browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReset") {
    resetDailyStatus();
  }
});

// Initiale Planung beim Laden des Hintergrundskripts.
scheduleDailyReset();
