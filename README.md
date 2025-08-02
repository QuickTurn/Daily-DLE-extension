# Daily-DLE Extension

## Overview

**Daily-DLE Extension** is a lightweight Firefox add-on designed to streamline your daily routine of visiting browser-based games, especially designed for the "DLE" games (like Wordle, Globle, ReHeardle etc.).
It allows you to select one of your existing browser bookmark folders and navigate through all saved websites using simple hotkeys. No need to switch tabs or open bookmarks manually.

Perfect for speeding up your daily DLE game streaks!

---

## Features

- **Bookmark Folder Selection**  
  Choose any folder from your browser’s bookmarks. The extension automatically loads all websites inside it.

- **Play Mode**  
  Automatically opens all saved websites in sequence using your chosen hotkeys. It remembers your current progress and skips websites you've already marked as "Done".

- **Categories**  
  Assign one of four predefined categories to each bookmark:  
  - `Word-Game`, `Geo-Game`, `Music-Game`, `Puzzle-Game`  
  You can also disable entire categories from Play Mode using a checkbox per category. Bookmarks without a category default to "Uncategorized".

- **Done Today Tracking**  
  Mark websites as "Done Today", so you know which ones you’ve already visited. These checkmarks reset automatically every night at **00:00 UTC**.

---

## Hotkeys

You can use the following keyboard shortcuts to control Play Mode:

- `Ctrl + Shift + Y` → **Mark current website as done** and open the next one  
- `Ctrl + Alt + Y` → **Skip current website** without marking it as done

> These hotkeys work even without having the extension popup open.

---

## Why Use It?

If you're playing multiple daily games across different websites (like Wordle, Globle, ReHeardle etc.), this extension helps you:

- Avoid having to open the Bookmark Folder and Search the next Website each time
- Keep track of which games you've already played  
- Categorize and organize your game bookmarks  
- Stay in the flow with keyboard-based navigation

---

## Notes

- This extension currently works with **Firefox** and reads from your **browser's bookmark folders**
- Bookmark changes (e.g. adding new Websites) are picked up automatically the next time you open the extension

---

## Future Ideas

- Custom categories
- Per-bookmark reset times  
- Automatic detection of game completion via content scripts

---

## License

MIT – feel free to use, adapt, and build upon it.
