# Question Map playbook (for the Claude session that answers)

This is for the Claude session that answers the map. Every question asked on a map ends with a line pointing here.

## How a question reaches you

1. The owner types a question on a card and presses Ask.
2. The page writes a database document `nodes/<id>` with `status: "pending"` and posts a "Send to Claude" comment on the artifact:
   `Question Map question (node <id>, under <parentId|top>, tree <treeId> "<tree name>"): <text>`
3. If your session watches the artifact, the comment wakes it. Read it with `ArtifactComments read`.

## How answering works

1. Research properly before you answer: the repo, your notes and the sources.
2. Write the answer with `ArtifactData update nodes/<id>` (pin `if_version`). Set these in **one** write:
   - `q`: a short, tidy version of the question. Keep the owner's own words in `raw`.
   - `a`: the answer, in Markdown. Lead with the answer.
   - `status: "done"` and `source: "thread"`. A card whose status is still `pending` keeps showing "Waiting for the answer", whatever is in `a`.
3. Reply in the comment thread with one line ("Answered on the card."), then resolve the thread.

### Rules

- **One question, one card.** If a message holds several questions and it was asked at the top of a tree, the pending card becomes one main card that sums up the message, and each question becomes its own child card. Deeper in a tree, the pending card takes the first question and each other question becomes a sibling card (same parent and tree).
- **Messages to send go in `msgs`, never in `a`.** Each item is `{label, to, replyTo, text}`. The page shows a Copy button and a Sent button for each one.
- **Only drafts to send right now.** Never put a draft on the map that has to wait for a date, an event or someone else's reply. Keep it yourself and add it when its time comes.
- **No blanks.** A draft is complete and ready to send: no `[placeholders]`, no TBD.
- **Label guesses** with "(my guess)" or "(my read)".
- **Quote replies:** if the message starts with `> ` lines, `q` is only the owner's own question, never the quoted words.
- **News on an answered card** goes on a new child card. If anything on the old card is now wrong, fix it at once: strike wrong lines with `~~like this~~`.
- **A draft that's been replaced:** set `cancelled: true`, `cancelReason` and `useInstead` (the id of the card to use) on the old draft, in the same write as the new one.
- **Steps the owner must take** get their own child card (for example "▶ Your step: …"), so they're never hidden inside a long answer.
- **Link related cards** instead of copying their text.

### When the owner presses Sent

The page posts a comment saying which draft was sent. Log it wherever you keep records, change that draft's `label` to start with "✅ sent <time>:", then resolve the thread. No reply is needed on the card.

## Data model (quick reference)

| Collection | What it holds |
|---|---|
| `nodes` | Cards: `q`, `a`, `raw`, `parent` (null = top of the tree), `tree`, `order`, `status`, `source`, `msgs`, `files`, `flag`, `read` |
| `trees`, `workspaces`, `folders` | How cards are grouped |
| `seen` | Which cards have been seen, synced across devices |
| `meta` | Settings, such as the `inbox` list used when the comment-thread limit is reached |

## Limits to know

- An artifact holds about 1,000 comment threads. Near the limit, the page reuses threads listed in `meta/inbox`.
- Database writes to existing documents need `if_version`. If a write fails because the version changed, read the document again and redo the write.
- A batch can hold up to 50 writes.
