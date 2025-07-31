const title = document.getElementById("title");
const status = document.getElementById("status");
const doneBtn = document.getElementById("doneBtn");
const skipBtn = document.getElementById("skipBtn");

async function getPlayState() {
  const { playState, bookmarkData = {} } = await browser.storage.local.get(["playState", "bookmarkData"]);
  const { index = 0, folderId, bookmarkIds = [] } = playState || {};
  return { index, folderId, bookmarkIds, bookmarkData };
}

async function save(index, bookmarkData) {
  await browser.storage.local.set({
    playState: { ...(await browser.storage.local.get("playState")).playState, index },
    bookmarkData
  });
}

async function proceed(markAsDone = false) {
  const { index, folderId, bookmarkIds, bookmarkData } = await getPlayState();
  if (index >= bookmarkIds.length) {
    title.textContent = "All done!";
    status.textContent = "";
    return;
  }

  const bmId = bookmarkIds[index];
  const bm = await browser.bookmarks.get(bmId).then(r => r[0]);
  title.textContent = `Now: ${bm.title}`;

  if (markAsDone) {
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
    await save(nextIndex, bookmarkData);
    status.textContent = `Opened: ${nextBm.title}`;
  } else {
    title.textContent = "Finished!";
    status.textContent = "You've gone through all sites.";
    await save(nextIndex, bookmarkData);
  }
}

doneBtn.addEventListener("click", () => proceed(true));
skipBtn.addEventListener("click", () => proceed(false));

proceed(false); // Load current item
