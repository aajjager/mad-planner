# Admin implementation workflow

## Status

The queue, administrator controls, and Linux controller are implemented in source.
They are disabled by default. The worker must be connected to the deployed API
and a protected phone-accessible preview address before the workflow can be used.
A complete live feedback-to-merge run has not yet been verified.

## Agreed behaviour

1. Only the system administrator can start an implementation from approved
   improvement, bug, or feature feedback. Questions are not implementation jobs.
2. A Linux worker claims one job at a time and creates an isolated checkout on a
   `codex/` branch. It must never edit the running app's checkout or read its `.env`.
3. Codex implements the request and relevant tests, follows AGENTS.md, and updates
   the appropriate weekly changelog category and translated guide where relevant.
4. A controller outside the agent runs the required tests and builds. An agent's
   report alone is not proof of a passing check. Failures remain visible in Admin.
5. After passing checks, the controller commits and pushes only the job branch,
   opens a reviewable pull request, and deploys a separate preview with disposable
   test data. The production database and media must never be mounted there.
6. Admin shows job status, change summary, validation results, pull request,
   preview link, and the exact commit tested. Preview access must require
   authentication or a private network; public port forwarding alone is not enough.
7. Request changes records administrator feedback and starts a new revision. Old
   approvals are invalidated whenever the preview commit or merge base changes.
8. Approve authorizes merging only the exact tested commit into main. The controller
   verifies pull request identity, head SHA, base, checks, and recorded approval
   before merging. Conflicts or intervening changes require testing and approval
   again. TrueNAS deployment remains a separate manual action.

## Worker setup prepared on Debian

- User: `docker`; existing application: `/home/docker/mad-planner`.
- Dedicated worker repository: `/home/docker/madplanner-worker/repository`.
- User-local tools: `/home/docker/.local/bin`.
- Runtime files: `/home/docker/.local/share/madplanner-worker`.
- Node.js 24.22.0, Codex CLI 0.163.0, GitHub CLI 2.102.0.

Do not store SSH passwords, GitHub tokens, Codex credentials, or app worker tokens
in this repository, generated prompts, job logs, or chat messages.

From an SSH session on the worker machine:

```sh
export PATH="$HOME/.local/bin:$PATH"
codex login --device-auth
gh auth login --hostname github.com --git-protocol https --web
codex login status
gh auth status
```

The administrator completes browser sign-in. Codex device login may need enabling
in ChatGPT security settings. See [Codex authentication](https://learn.chatgpt.com/docs/auth).

## Implemented boundaries and validation

- Persistent jobs and revision history use an additive Alembic migration.
- Queue, revision, cancel, and exact-commit approval endpoints require a system administrator.
- A separate worker token authenticates atomic claims, five-minute leases, and
  heartbeats. Expired jobs fail visibly instead of silently reexecuting. An
  administrator must request a new revision to retry. Cancellation invalidates claims.
- Admin controls and guide descriptions are translated into English, Danish, and Dutch.
- Agent code runs in a resource-limited Docker container with only an exported
  source tree and a dedicated Codex authentication directory. No Docker socket,
  GitHub credentials, worker token, controller configuration, or production files
  are mounted. A separate CONNECT proxy limits inference egress to specific OpenAI
  hosts on port 443; direct LAN and other Internet connections are blocked.
  Codex uses its full-access mode *inside this external sandbox* because nested
  bubblewrap namespaces are unavailable on this Debian Docker host. Host security
  settings are not changed. Validation containers have no network or credentials.
- Keep deployment, validation, Git operations, and approval checks in a trusted
  controller. Never execute feedback text as a shell command or trust modified
  job code to approve itself. Redact credentials from logs.
- Give previews unique Compose project names, ports, volumes, and test accounts.
- GitHub authentication is used only by the trusted controller. Merging verifies
  the exact PR head, base, branch, checks, and approval. It creates a merge commit
  whose tree must equal the tested tree, then performs a normal fast-forward-only
  push. A concurrent main update rejects that push. Branch protection may reject
  direct pushes; the controller does not bypass it or force-push.
- Test permissions, failed checks, duplicate claims, stale approvals, restarts,
  revision requests, isolation, and the complete phone review path before enabling.

## Connect the worker (required before enabling)

1. Publish/deploy this implementation to the Mad Planner instance that owns the
   administrator feedback inbox. The existing TrueNAS app will not gain endpoints
   merely because Linux tools were installed.
2. Configure two additional **API environment variables** on that instance:
   `IMPLEMENTATION_WORKER_TOKEN` (a random token generated with
   `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`) and
   `IMPLEMENTATION_PREVIEW_URL` (the protected preview address used by the phone). Use a separate preview
   hostname/IP from the live app so cookies are not shared. Preview nginx also
   forwards only a separate test-session cookie to preview application code.
   Keep the token out of Git, chat, and command logs. Do not replace database or MFA
   credentials. The base development Compose file forwards these optional values.
3. On Linux, copy `worker/config.example.json` to
   `~/.config/madplanner-worker/config.json`, set mode `600`, and fill in `app_url`,
   the **same** worker token, and a separate test-only preview password. Leave
   `preview_bind` at `127.0.0.1` for an HTTPS reverse proxy or tunnel; a private VPN
   address is another option. Do not expose the preview as an unprotected public port.
4. Install the trusted controller and egress proxy in
   `~/madplanner-worker/controller/`. Keep these outside every job checkout. Build
   its runtime with `sh worker/build-tools.sh` from the reviewed source. Dependency
   changes require rebuilding this trusted image after manual review.
5. Use a dedicated directory for Codex credentials:
   `~/.local/share/madplanner-worker/auth/` (mode `700`, auth file mode `600`).
   It must contain only worker Codex state, never GitHub credentials or app secrets.
   This directory is already prepared on the development server. For a fresh login,
   run `CODEX_HOME="$HOME/.local/share/madplanner-worker/auth" codex login --device-auth`.
6. Install `worker/madplanner-worker.service` under `~/.config/systemd/user/`.
   Run `systemctl --user daemon-reload` and, **after configuration and tests**,
   `systemctl --user enable --now madplanner-worker`. User lingering may need an
   administrator to enable it for operation after logout. Check
   `journalctl --user -u madplanner-worker` for controller errors.
7. Test one small approved request. Review its branch, independent check results,
   visible preview commit, phone login, request-changes behaviour, and approval.
   A preview account is created before publishing the web port:
   `preview@example.invalid`, with the test-only password from the private config.
   Each revision gets a fresh database and media volume; production data is not copied.
8. Approval merges only; update TrueNAS images separately after GitHub publishes them.

The controller intentionally rejects changes to worker files, Git configuration,
AGENTS.md, environment files, and dependency manifests. Those need manual review.
The sole manifest exception is a change to API `project.version` alone: it must
match the current Copenhagen completion week and the first release in CHANGELOG.md.
The runtime dependency comparison also ignores only that version metadata field.
Ignored dependency folders are never traversed or published, including symlinks;
the web `node_modules` symlink is unlinked before validation copies trusted modules.
Links in actual published source remain forbidden.
It processes one preview at a time, keeping a ready preview until a decision.
The initial worker uses the feedback text and review notes; attachments are not
automatically supplied to Codex. Requests must be understandable from their text
or use the manual implementation workflow.

Preview containers are labelled `madplanner.preview=true` and named `mp-preview-*`;
old preview containers are replaced on the next deployment. Test volumes, networks,
images, job workspaces, and failed deployment artifacts need periodic administrator
cleanup; never remove similarly named production storage.

Worker-to-app connectivity and the protected phone preview address are still pending.
Do not label the overall workflow ready until the complete live path is verified.

## Verification recorded during setup

- The full local API suite passed (106 tests); 105 API tests and 62 web tests also
  passed inside the isolated Debian runtime before the final failure-artifact test was added.
- Production web build and source lint passed inside that runtime.
- Four controller boundary tests passed.
- An authenticated Codex write succeeded inside the external Docker sandbox.
- Runtime probes confirmed OpenAI-only agent egress and blocked direct LAN, direct
  Internet, and GitHub connections from the agent container.
- The preview deployment smoke test passed with a fresh migrated database, seeded
  test account, static web gateway, and version marker. Login through nginx, the
  separate test-session cookie, and five example recipes were verified.
- The complete phone/approval/merge path still requires the deployment addresses;
  these tests are not evidence that the live workflow is enabled.
