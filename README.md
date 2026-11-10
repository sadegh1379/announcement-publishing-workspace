# Announcement Publishing Workspace

A small React and TypeScript workspace for publishing three prepared announcements. The publishing service is the supplied browser mock. Announcements cannot be created, edited, or deleted.

## Run

```bash
pnpm install
pnpm dev
```

Other checks:

```bash
pnpm check
pnpm build
```

Open the dev server in a browser. The mock keeps its records in session storage for this tab.

## What you can do

- Select an announcement and read its prepared content.
- Publish it, then follow that attempt from the list even if you select another announcement and publish that one too.
- Check status while an attempt is unresolved. The workspace also reads status on its own about every 1.5 seconds until the attempt is published, rejected, or no longer unconfirmed.
- After a lost response, check status or retry the same operation. Retrying does not create a second publication.
- After a rejection, read the reason and start a new operation with Publish again. A successful announcement is not published again.
- Refresh the page. Existing operations are restored with `listOperations()` and `getStatus()`. Refresh does not start a new publication.

The screen separates five situations: not submitted, processing, published, rejected, and unconfirmed. A failed request does not clear a result the service already confirmed, and it does not block the other announcements.

## Technical decisions

- UI state lives in one reducer. Service calls and polling live in `PublicationTracker`, which only reports events.
- Each announcement has one current operation. On restore, a published operation wins; otherwise the newest processing operation; otherwise the newest rejection.
- Operation ids look like `op-{announcementId}-{uuid}`. An unconfirmed retry reuses that id. A new attempt after rejection mints a new one.
- Snapshots for the same operation are applied only when their version is not older. A confirmed publication or rejection is not replaced by a different outcome.
- Follow-up reads use `getStatus()` for the announcement's own operation. The first status failure in `status-check-failure` is shown as a temporary notice, not as a rejection.
- Startup recovery calls `listOperations()` and retries `STATUS_UNAVAILABLE`, because each failed list call consumes one pending failure. A manual check does not hide that failure.

## Assumptions

- One current operation per announcement is enough. Older attempts stay on the service but are not shown once a better current operation exists.
- Selecting an announcement is not restored after refresh.
- No frontend database. The mock's session storage is the record of publication work.
- Closing the tab or clearing its storage ends that record. Cross-tab use is out of scope.
- The supplied `mocks/` directory is imported unchanged from `mocks/index.ts`.

## Limitations

- No automated tests.
- No republishing after a confirmed success.
- A lost publish response can move straight to processing when a status read already returned a snapshot. The attempt is still the same operation.
- Startup recovery may consume pending status failures before the first paint, so a refresh can open on the real result instead of the temporary failure.
