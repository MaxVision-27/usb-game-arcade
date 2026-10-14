USB GAME ARCADE
===============

Small browser games that run straight from the USB in Chrome or Edge.
No internet, no install, no admin.


1. FIRST-TIME SETUP
-------------------
Everything lives in one folder on the USB:

    D:\Homework\START.html
    D:\Homework\README.txt
    D:\Homework\REBUILD-LIBRARY.bat
    D:\Homework\app\
    D:\Homework\data\
    D:\Homework\games\

You can rename the folder or move it, as long as everything inside stays
together.

Double-click START.html. If it opens in something other than Chrome/Edge,
right-click START.html > Open with > Microsoft Edge (or Google Chrome).

The tab is always called "Notes" with a plain page icon.


2. SAVING PROGRESS TO THE USB
-----------------------------
Best scores, play time, favorites and game progress (like Ore Mill) always
save in the browser you're using. To ALSO save them on the USB so they follow
you between computers:

  - First time on a computer: click "Connect USB" (top right), pick the
    arcade folder on the USB (the one with START.html in it), and allow
    editing.
  - Every session after that: click "Connect USB" once and press "Allow".
    The browser requires this click. It can't be skipped.

The button shows "USB (tick) saved" when it's working.
Saves live in data\saves.js. data\saves.bak.js is a copy taken each time you
connect.

If a computer blocks the folder picker:
  - Saves still go into that computer's browser.
  - To carry them home: click "Export". It saves saves.js to Downloads. Copy
    that file into the USB's data folder, replacing the old one.
  - To load USB saves into a browser by hand: click "Import" and choose
    data\saves.js from the USB.

When two copies meet, they are merged per game: the best score and play time
keep the higher number, and game progress keeps the most recent copy.

Close the tab and use "Safely Remove / Eject" before pulling the USB out.
FAT32 drives can lose recent writes if yanked.


3. PLAYING
----------
Library: search, sort (A-Z / Recently played), the star button shows
favorites only. Hover a cover and click its star to favorite it. Click a
cover to play.

Keys in every game:
  Arrows or WASD     move / steer
  Space or Enter     main action
  Esc                pause menu (Resume / Restart / Exit to library)
  F                  fullscreen
  `                  hide screen (the key under Esc)

Each game lists its own keys on its start screen and in the pause menu.

HIDE SCREEN: press ` and a plain notes page covers everything. The game
pauses. Press ` again to come back, then Esc or Resume to keep playing.
The notes page also appears by itself when the window loses focus
(Alt+Tab, clicking another window). You can type in it; it's kept.

Ore Mill keeps mining while you're away, up to 8 hours.


4. ADDING GAMES
---------------
Each game is a folder inside games\:

    games\
      stackfall\
        index.html     (the same 6 lines in every game)
        game.js        (the game)
        game.json      (title, description, controls...)
        cover.svg      (optional; .svg .png .jpg all work, 2:3 portrait)

To add a game, copy its folder into games\, then update the library one of
two ways:

  A) Double-click REBUILD-LIBRARY.bat. A window lists the games it found.
     Press a key to close it, then reload START.html (F5).
  B) In the app: click "Connect USB", then "Rescan". No F5 needed.

Folders starting with _ or . are hidden (that's why _Template doesn't show).
To remove a game, delete its folder and rebuild or rescan.

GAME PACKS: extra games may be posted on the GitHub Releases page. Download
a pack's .zip, extract it, move the game folder into games\, then rebuild or
rescan.
To publish one: zip the game folder itself (so the zip contains
my-game\index.html...), go to Releases > Draft a new release, name it
"Pack: My Game", attach the zip, publish. Only share games you made.


5. WRITING YOUR OWN GAME
------------------------
  1. Copy games\_Template and rename the copy, e.g. games\my-game
     (no _ at the start, or it stays hidden).
  2. Edit game.json:

     {
       "title": "My Game",
       "description": "Shown under the cover.",
       "controls": [["Arrows", "Move"], ["Space", "Jump"]],
       "cover": "cover.svg",
       "version": "1.0.0",
       "color": "#4fc3f7"
     }

     Only "title" is really needed. No "cover" = a colored tile with the
     title. "color" tints the card. It must be valid JSON: double quotes,
     commas between items, no comma after the last one.

  3. Write the game in game.js. Open the folder's index.html directly in
     Chrome to test it on its own (scores aren't saved that way). Press F5
     after each change.
  4. Rebuild or rescan, and it's in the library.

A game is one call:

    Engine.start({
      width: 320, height: 200,   // your size in pixels, scaled to fit
      init(data) { },            // data.best, data.state (what you saved)
      update(dt) { },            // 60 times a second
      draw(ctx) { },             // draw with the normal canvas API
      onPause() { },             // optional: save here
    });

Inside it you can use:
    Engine.down('left')     key held? 'left' 'right' 'up' 'down' 'action',
                            or any key code like 'KeyZ', 'Digit1'
    Engine.hit('action')    key pressed just now?
    Engine.mouse            .x .y .down .hit
    Engine.text('Hi', x, y, size, color, align)
    Engine.score(n)         the launcher keeps the best
    Engine.save(anything)   comes back as data.state next time

The full list is at the top of app\engine.js. Esc, F and ` are used by the
arcade, so don't use them in your game.

Keep games original: your own names, art and ideas. Don't copy sprites,
characters, music or code from other games.


6. TROUBLESHOOTING
------------------
"No games found"
  -> Run REBUILD-LIBRARY.bat (or Connect USB + Rescan), then press F5.
     Check the folder is named exactly "games".

A new game doesn't show up
  -> Rebuild or Rescan. If the window says SKIPPED, read why: usually a
     missing index.html, or a typo in game.json (a missing comma or quote).
  -> Folder names starting with _ are hidden on purpose.

A game opens to a black screen
  -> Its game.js has an error. Open its index.html directly, press F12,
     and look at the red text in the Console tab.

Cover shows a colored tile instead of the picture
  -> The "cover" name in game.json doesn't match the file name exactly.

Keys don't do anything in a game
  -> Click on the game once so it has focus.

REBUILD-LIBRARY.bat closes instantly or says scripts are disabled
  -> Right-click app\rebuild.ps1 > Run with PowerShell. If Windows says the
     file is blocked: right-click it > Properties > tick "Unblock" > OK.

"Connect USB" does nothing, or shows an error
  -> Click it again (the browser sometimes needs a second click).
  -> If it still fails, the computer blocks it: use Export/Import
     (section 2). Playing still works fine.
  -> If it says to pick the folder with START.html: you picked the wrong
     folder. Open the USB, click the arcade folder once, "Select Folder".

Button shows "USB (warning) not saving"
  -> The USB was unplugged or permission expired. Click the button again.

Scores or progress went backwards
  -> Close the tab. In data\, rename saves.bak.js to saves.js (delete or
     rename the bad one first). Reopen START.html.

Nothing happens when double-clicking START.html, or a blank page
  -> Open it with Edge or Chrome (right-click > Open with). Make sure the
     app, data and games folders are next to START.html.


7. SCHOOL LAPTOP TEST CHECKLIST (about 5 minutes)
-------------------------------------------------
 [ ] 1. Double-click START.html. Tab says "Notes". Three covers show:
        Coil, Ore Mill, Stackfall.
 [ ] 2. Click Stackfall. Press Space. Pieces fall; arrows move, Up rotates,
        Space drops.
 [ ] 3. Press Esc. The pause menu shows the controls. Click Resume.
 [ ] 4. Press `. Notes page. Type a word. Press ` again: pause menu is
        back. Press Esc to resume.
 [ ] 5. Alt+Tab away and back: the notes page should be showing.
 [ ] 6. Press F (fullscreen), then F again.
 [ ] 7. Esc > Exit to library. "Recent games" shows Stackfall with a best
        score.
 [ ] 8. Play Coil until you crash. Play Ore Mill: click the rock 20 times,
        then buy a Hand Drill (press 2). Exit.
 [ ] 9. Click "Connect USB", pick the arcade folder on the USB, Allow.
          Works -> button shows "USB (tick) saved". Click "Rescan": it
                   should say "Found 3 games".
          Fails -> note the error. Use Export/Import on this laptop.
 [ ] 10. Close the tab, reopen START.html. Scores are still there.
 [ ] 11. At home, open START.html from the USB. Scores and Ore Mill
         progress are there (only if step 9 worked or you Exported), and
         Ore Mill says "While you were away".
