# Background Web Push

Mad Planner can deliver incomplete-plan reminders and feedback-completed notices
while no app tab is open. It uses standard encrypted Web Push with VAPID, not the
Linux implementation worker. The API checks for notifications every minute.

## Server setup

1. Deploy the API and web images from the same reviewed release. Migration
   `20261021_33` adds device subscriptions; existing family data is preserved.
2. Generate one stable VAPID key pair using the API Python environment:

   ```sh
   python scripts/generate-push-keys.py /private/location/push.env mailto:YOUR-CONTACT-EMAIL
   ```

   The parent directory must already exist. The script creates a new file with
   mode 600 and refuses to overwrite it. On Windows, also restrict file access
   with the directory's normal account permissions. Do not commit the file.
3. Set these API environment variables, copying their values directly from the
   private file (the development Compose file forwards them from its environment):

   ```yaml
   PUSH_ENABLED: "true"
   PUSH_VAPID_PRIVATE_KEY: "YOUR_PRIVATE_KEY"
   PUSH_VAPID_PUBLIC_KEY: "YOUR_PUBLIC_KEY"
   PUSH_VAPID_SUBJECT: "mailto:YOUR-CONTACT-EMAIL"
   ```

   For a TrueNAS YAML installation, add these under the existing API service's
   `environment`. Keep database, media, MFA and worker settings unchanged.
   Recreate the API container after changing settings. Back up the signing key
   securely; generating a new pair requires devices to unsubscribe and re-enable.
4. Use a stable HTTPS hostname, such as the configured production Cloudflare
   Tunnel address, and secure session cookies. Permit outbound HTTPS to browser
   push providers. No incoming notification port or router rule is required.
5. The optional isolated implementation worker runtime contains API dependencies.
   After merging this dependency change, rebuild its trusted image with
   `sh worker/build-tools.sh` before the next implementation job. Its dependency
   check intentionally fails closed against an old image. Never replace it while
   an implementation job is running. Existing previews have push disabled.

## Enable a device

Open **Family → Background notifications on this device**, then enable and accept
the browser prompt. This also enables the existing account notification preference.
On iPhone/iPad, install Mad Planner with **Add to Home Screen**, open that installed
app, and then enable notifications. Browser/OS power settings and force-quitting a
browser can delay or prevent delivery; delivery is best effort, not guaranteed.

Each browser must opt in. Device registration is tied to its current authenticated
session. Logout, session expiry, removed family access, or a deleted account stops
delivery. Sign in again and enable on the device after a session expires. Disabling
the existing account notification preference pauses all its devices; disabling in
the background section removes just this device's registration.

Planning sends at most once per device per day after **09:00 Europe/Copenhagen**,
using the family's enabled meal types, exclusions and reminder horizon. Complete
plans and disabled family reminders do not generate reminders. Feedback notices
cover new, unread completions after device registration and within the existing
five-day visibility window. The normal in-app notices remain available.

Payloads use the user's current English, Danish or Dutch locale and generic text;
they do not include recipe names, feedback contents, credentials or family names.
Clicking opens the relevant app page, which still requires a login. Existing
foreground browser notifications defer to a registered background subscription
to avoid duplicate delivery from polling.

Subscriptions and send history are stored in PostgreSQL. Successful deliveries
are deduplicated across API restarts; PostgreSQL serializes dispatcher instances
using an advisory transaction lock. Lost provider responses or a process crash
between sending and recording can still produce a duplicate. Temporary failures
retry; endpoints returning 404/410 are deleted. Endpoint registration is restricted
to Google, Mozilla, Apple and Microsoft browser push providers; outbound redirects
are disabled. Endpoint URLs and encryption keys are private capabilities: do not
publish them or put them in logs.

## Verification

Automated tests cover session ownership, opt-in, opt-out, preferences, daily
deduplication, expired sessions/endpoints, temporary failures, real payload
encryption/signing with a mocked transport, service-worker display and safe click
destinations. They do not demonstrate delivery through an actual phone provider.

After configuring HTTPS/VAPID, enable one test device, close the app, and complete
one of that account's feedback requests from Admin. Check delivery within a few
minutes, click through to Family, and verify logout and disable stop further
delivery. Test daily planning separately with an incomplete upcoming plan and
family reminders enabled. Check OS permissions and API logs if delivery fails;
do not paste subscription secrets or signing keys into support messages.

Protocol references: [MDN Push subscription](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe),
[pywebpush](https://github.com/web-push-libs/pywebpush), and
[Apple Web Push support](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers).
