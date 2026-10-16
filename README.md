# USB Game Arcade

A small game arcade that runs straight from a USB drive. Double-click `START.html` and play. No internet, no install, no admin rights, and no server. It works in Chrome or Edge on Windows.

- Library with covers, search, sorting, favorites, and a "Recent games" row
- Three library layouts to pick from: Steam-style, PlayStation-style, or Xbox-style (arrow keys and game controllers work in the console styles)
- Best scores and play time on every game
- Progress is saved **on the USB**, so it follows you between computers
- Every game pauses with Esc and has a fullscreen mode (F)
- `` ` `` key instantly hides everything behind a plain notes page
- Add games by copying a folder. Write your own with the included template

## Games

| Game | What it is |
|---|---|
| **Stackfall** | Steer falling pieces and fill rows to clear them |
| **Coil** | Steer a growing line, eat sparks, don't crash |
| **Ore Mill** | Click the rock, buy machines, they keep mining while you're away |

All games, art and names are original.

## Download

1. Click the green **Code** button above, then **Download ZIP**.
2. Extract the ZIP.
3. Copy the extracted folder onto your USB drive. Rename it to anything you like, for example `Homework`.
4. Open the folder and double-click **START.html**.

## Adding games

Each game is a folder inside `games\`:

```
games\
  my-game\
    index.html
    game.js
    game.json      (title, description, controls, cover, version, color)
    cover.svg      (optional)
```

Copy the folder in, then double-click **REBUILD-LIBRARY.bat** and reload (F5). Or click **Connect USB → Rescan** inside the app.

## Game packs

Extra games are posted separately on the [Releases](https://github.com/MaxVision-27/usb-game-arcade/releases) page, so the main download stays small. Each pack is a `.zip` holding one game folder.

**To install a pack:** download the `.zip` under **Assets**, extract it, move the game folder into `games\`, then rebuild or rescan and press F5.

**To publish a pack:** zip the game folder itself, so the zip contains `my-game\...` at the top. Then go to **Releases → Draft a new release**, name it `Pack: My Game`, attach the zip, and publish. Only post games you made. Use your own names, art and sounds.

## Writing your own game

Copy `games\_Template`, rename it, and edit `game.js`. A whole game is one call:

```js
Engine.start({
  width: 320, height: 200,      // scaled to fit the screen
  init(data) { },               // data.best, data.state
  update(dt) { },               // 60 times a second
  draw(ctx) { },                // normal canvas drawing
});
```

Input, the mouse, scores, and saves are one-liners: `Engine.down('left')`, `Engine.hit('action')`, `Engine.mouse`, `Engine.score(n)`, `Engine.save(state)`. The full list is at the top of `app/engine.js`. Open a game's `index.html` directly to test it on its own.

## Saving progress to the USB

Click **Connect USB** and pick the arcade's folder (the one with `START.html`). After that, one "Allow" click per session. If a computer blocks the folder picker, progress still saves in that browser, and **Export / Import** move it to and from the USB.

## Keys

| Key | Action |
|---|---|
| Arrows / WASD | Move |
| Space / Enter | Main action |
| `Esc` | Pause menu |
| `F` | Fullscreen |
| `` ` `` | Hide screen / come back |

Each game lists its own controls on its start screen and in the pause menu.

See **README.txt** in the download for full instructions, troubleshooting, and a test checklist.

## License

[MIT](LICENSE)
