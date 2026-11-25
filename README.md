# Claude Artifact Question Map

A question-and-answer tree that runs as a [Claude](https://claude.ai) artifact. You ask questions on cards, a Claude Code session answers them on the same cards, and long, nested conversations stay easy to follow.

Built for people who work with several Claude sessions and get lost in long chat threads.

> Unofficial community project, not affiliated with Anthropic. It runs only as a claude.ai artifact, so changes to the artifact runtime can break it.

## What it does

- **Every question is a card.** Follow-up questions become child cards, so a long discussion turns into a tree you can fold, search and jump around.
- **Claude answers on the card.** Asking posts a comment on the artifact. That comment wakes the Claude Code session watching the map, and the session writes its answer into the card.
- **Drafts you can send.** When the answer includes a message for someone else, it appears as a draft with Copy and Sent buttons.
- **Unread tracking.** New and unread answers are marked, and that state syncs across your devices.
- **Desktop app.** Install the map as an app from the Claude desktop app (artifact menu → Install as app). It shows the unread count on its Dock icon and, once you allow it, in the menu bar, and notifies you of new answers.
- **Organised.** Workspaces, folders, several trees per map, search, Focus mode and a phone layout.

## What you need

- A claude.ai account that can publish artifacts with the `db`, `comments`, `assets` and `desktop` capabilities.
- A Claude Code session that publishes the map and watches it for comments. Comments are what wake it.
- Python 3 to run the build script.

## Setup

1. Build the page:
   ```bash
   python3 build.py --title "My Question Map" --topic "Project catch-up" --thread "My Claude session" --out out/my-map/index.html
   ```
2. Ask your Claude Code session to publish `out/my-map/index.html` as an artifact with the capabilities `{"db": {}, "comments": {}, "assets": {}, "desktop": {}}`. Publishing also makes the session watch it.
3. Open the artifact and ask your first question. Your session answers following [PLAYBOOK.md](PLAYBOOK.md).

After the first publish, rebuild with `--url <artifact url>` so the map knows its own address.

### Several maps

Use one map per Claude session. Wake-ups work per artifact, so a shared map would wake every session for every question. To let your maps link to each other, copy `maps.example.json` to `maps.json` (it's git-ignored), fill it in and pass `--maps maps.json`.

## Keeping every map up to date

This repo is the single source of the map code. Each map's cards live in its own artifact database, so updating the code never touches them.

- Every built page carries its version (`<meta name="qm-version">`), taken from `VERSION`.
- Add this rule to each project or repo that uses a map: *"Before working on the map, compare its qm-version with VERSION in github.com/ayyazzafar/claude-artifact-question-map. If the repo is newer, pull, rebuild and republish to the same URL."*
- Make code changes here, never inside one map: bump `VERSION`, add a line to `CHANGELOG.md`, then rebuild your maps.

## Files

| File | What it is |
|---|---|
| `build.py` | Builds one self-contained page from the files below |
| `template.dc.html` | The page layout (the designer's template; its demo data is ignored by the build) |
| `logic.js` | Data layer: cards, trees, sync with the artifact database, asking and sending |
| `support.js` | Small rendering runtime the template needs |
| `PLAYBOOK.md` | How the answering Claude session should write answers |
| `VERSION`, `CHANGELOG.md` | Version stamp and history |

## License

MIT, see [LICENSE](LICENSE). This covers the code written for this project (`build.py`, `logic.js` and the docs).

**Files from the Claude Design export:** `support.js` (the "dc-runtime") and `template.dc.html` (the page template) were produced by Claude Design and adapted here. They're not covered by the MIT license above, and their own terms are unclear. If they ever need to come out, remove those two files; `build.py` is the only code that reads them.
