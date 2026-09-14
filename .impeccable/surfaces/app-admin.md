---
version: 1
slug: "app-admin"
primary_target: "app/admin"
related_targets: ["app/components/admin"]
---

Scope: /admin, /admin/activity, /admin/logins. Visitor mode: Operate.

Audience & job: one person — the account named in ADMIN_USER_ID. They arrive with a concrete question, almost always "這筆怎麼不見了？", occasionally "有沒有不是我在登入？". Everyone else gets 404, never 403: a 403 confirms the console exists.

Task & proof: find the last change to a named thing, read which fields moved, put it back. Proof is the field-level diff plus the before-snapshot that makes restore real rather than advisory.

Direction: 查詢主控台 (surface seed 4214d2cf, dealt lead, code-led). The query bar leads the page; results are the echo of a query, not a feed you scroll. Two raises are load-bearing, not decoration:
- 還原 lives on the event row itself (from the declined HyperCard challenger — browse and author as two modes of one object). Do not move it behind a detail page or a separate admin mode.
- Filters freeze the view (from the declined oscilloscope trigger). Polling never splices rows into what is being read; new events queue behind a counter the reader accepts. Breaking this turns the surface back into a feed.

Memorable moment: the row opening. clip-path inset from the top with a blur that resolves, 420ms exponential ease-out — the row lifts to show the diff rather than shoving the list down. It is the surface's only authored motion; adding a second one dilutes it.

Constraints: chips must be able to build any query without typing — the whole structure dies on a phone otherwise. `photos` is deliberately absent from the chip row because that tab has no write path at all. Restore is refused for `create` (undo-create is delete, and the app already owns deletion) and for events with no snapshot (bulk category operations).

Unresolved: LINE-sourced expense writes are Phase 2 and currently produce no log entry, so an expense can appear with no matching record. AI generation, GPX import, sheet export and share-link changes are also Phase 2. App-layer logging cannot see writes that bypass app/api/* — accepted, because a DB trigger would lose actor, tab and device.
