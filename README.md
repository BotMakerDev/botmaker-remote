# botmaker-remote

The Claude Code terminals on a dev box, from a phone. Pairs with
[botmaker-remote-server](https://github.com/BotMakerDev/botmaker-remote-server) over Tailscale.

**Why.** Claude Code's Remote Control binds one Claude account, and switching accounts with `cswap` ends
the session. This app attaches to *terminals* instead — one tmux window per account — so nothing switches
and nothing disconnects.

**What it does.** Three screens:

- **Connect** — scan the QR the server printed (or paste its `pair:` line). Remembered.
- **Sessions** — every window in the tmux session `claude`, with a badge: *working*, *waiting for you*
  (Claude Code's own `Stop`/`Notification` hooks say so), *no Claude*. ＋ opens a new window under any
  `cswap` account, with that account's 5h/7d usage beside it, started in a directory you pick: the last
  one used by default, the recent ones as chips, or *Change…* to browse the server's home (nothing above
  it). ✕ closes one.
- **Terminal** — xterm.js on the window, resizing with rotation and the keyboard. Drag a finger to scroll
  back through Claude Code's output (tmux's history; a server older than 0.2.0 does not turn tmux's mouse
  on, and dragging does nothing there). A bar of keys the soft
  keyboard lacks (`Esc`, `Tab`, `↑`, `↓`, `^C`, `⏎`) and **quick replies** (`y`, `continue`, `/clear`, …;
  edit the list with ⋯).

When the server does not answer, the Sessions screen says so and lists what to try for the address it was
paired with: for a Tailscale address, connect Tailscale, turn on Android's *Always-on VPN* for it and set its
battery use to *Unrestricted*; for a local address, join the same Wi-Fi. **Retry** checks again, and the
server's `--doctor` shows the same from the computer, with when it last saw the phone.

A *waiting* window raises a notification while the app is open. For a phone in a pocket, subscribe the
[ntfy](https://ntfy.sh) app to a topic and give the same URL to the server's `--ntfy`.

## Install

Android: [`botmaker-remote.apk`](https://github.com/BotMakerDev/botmaker-remote/releases/latest/download/botmaker-remote.apk)
(the app checks for a newer release itself). The phone must be on the same tailnet as the dev box.

Any browser works too: `web/` is a plain Vite app — `npm --prefix web run dev`, open it on the phone, pair.

## Build

```bash
npm --prefix web ci && npm --prefix web run build   # the web app (web/dist)
npm ci && npx cap sync android                      # into the Android shell
cd android && ./gradlew assembleDebug               # JDK 17–21, Android SDK in android/local.properties
```

`web/package.json`'s `version` is what the updater compares against the release tag — keep them in step.

## Releasing

From the umbrella: `./release.sh --remote <version>`. Tagged first with the pilot (nothing of ours
depends on it); the notes are the commit log, like the pilot's.
