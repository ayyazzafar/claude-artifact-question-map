# Changelog

Newest first. Bump `VERSION` with every change, add a line here, then rebuild and republish your maps.

## 2.82 (25 Nov 2026)
- Desktop app support. Publish with the `desktop` capability, then pick **Install as app** in the artifact's menu (Claude desktop app). Inside the installed app the map:
  - shows the unread count on its Dock icon (no permission needed);
  - after one **Turn on** tap, shows the count in the macOS menu bar (Windows: system tray) and sends a notification for each new answer while the window is in the background.
- `build.py` adds the `claude-artifacts-manifest` tag listing the `notifications` and `menu-bar` permissions.
- Outside the installed app (browser, artifact panel, phone) nothing changes.

## 2.81 (24 Nov 2026)
- Fix "Updated NaNd ago": card times now accept ISO date strings (like `2026-11-24T05:10:07Z`) and numeric strings as well as ms numbers. Cards written that way by other sessions also sort and count as new correctly.

## 2.80 (22 Nov 2026)
- Moved into its own repo so every Claude session builds maps from one source.
- `build.py` reads the version from `VERSION` and takes an optional `--maps` file (your list of maps) instead of a fixed path.
- The answering-rules line inside each question now points to `PLAYBOOK.md` in this repo.
- Demo data in the template uses neutral names.

## Before 2.80
Versions 2.0 to 2.79 (30 Oct to 21 Nov 2026) were built inside a private repo. Highlights: tree of question cards with Markdown answers, ready-to-copy drafts with Sent tracking, unread and seen state synced across devices, workspaces and folders, search, Focus mode, phone layout, image attachments, quote replies, and a fallback for the comment-thread limit.
