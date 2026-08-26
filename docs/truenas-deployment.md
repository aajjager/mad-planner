# Deploy Mad Planner on TrueNAS SCALE

This guide deploys Mad Planner through the TrueNAS SCALE 24.10+ Apps interface and stores PostgreSQL data in a TrueNAS dataset.

## 1. Publish the container images

Mad Planner's GitHub workflow publishes the API and web images whenever relevant code reaches `main`. Push the latest commit, then open the repository's **Actions** tab and wait for **Publish container images** to finish successfully.

The first published packages must be publicly readable so TrueNAS can download them without GitHub credentials. On GitHub, open each package, choose **Package settings**, and change its visibility to **Public**:

- `mad-planner-api`
- `mad-planner-web`

## 2. Create persistent storage

In the TrueNAS web interface, create a dataset for PostgreSQL, for example:

```text
/mnt/tank/apps/mad-planner/postgres
/mnt/tank/apps/mad-planner/media
```

Replace `tank` with the name of your storage pool. The account running Docker must be able to write to this dataset.

## 3. Prepare the app configuration

Open `compose.truenas-app.yaml` in GitHub or VS Code and copy its contents. Before using it, change:

- both `CHANGE_THIS_PASSWORD` values to the same long alphanumeric password
- `CHANGE_THIS_FERNET_KEY` to the MFA encryption key used by this installation
- both `sha-REPLACE_WITH_GITHUB_SHA` image tags to the same published commit tag
- `/mnt/tank/apps/mad-planner/postgres` and `/mnt/tank/apps/mad-planner/media` to the datasets created above
- `8080:80` if port 8080 is already used on TrueNAS

Avoid punctuation in the database password because it is also included in a connection URL.

Do not save your real password or encryption key back into Git. Keep both in a password manager and protected configuration backup. Losing the MFA key prevents Mad Planner from reading enrolled authenticator secrets.

## 4. Install through TrueNAS Apps

1. Open **Apps**, then **Discover Apps**.
2. Open the three-dot menu and select **Install via YAML**.
3. Enter `mad-planner` as the application name.
4. Paste the edited contents of `compose.truenas-app.yaml` into **Custom Config**.
5. Click **Save** and wait for the application to report **Running**.

Open `http://TRUENAS-IP:8080`, replacing the address and port when necessary.

## Back up the database

Use TrueNAS dataset snapshots as the first layer of protection. Mad Planner also includes a portable PostgreSQL backup command.

The database backup contains the information managed by Mad Planner: accounts and families, recipes and ingredients, meal plans, grocery lists and purchase history, family preferences, invitations, and security settings. It is the recovery copy for an accidental database change, failed migration, or damaged database dataset. Normal container rebuilds do not erase the database because it uses persistent storage, but a separate backup protects against failures outside that normal update process.

The database dump does **not** contain uploaded recipe photos. Photos live in the separate media dataset and must be included in TrueNAS snapshots or file backups.

From the directory containing `compose.yaml`, run:

```sh
sh scripts/backup-database.sh
```

The command creates a timestamped custom-format PostgreSQL dump in `backups/`. Copy that file to a different dataset or computer; a backup stored only beside the application is not enough protection against pool failure.

On the Windows development computer, use:

```powershell
.\scripts\backup-database.ps1
```

Uploaded recipe photos live separately from PostgreSQL. Include the recipe-media dataset or Docker volume in snapshots and off-system backups. Take both a dataset snapshot and portable database backup before every update.

## Restore a database backup

Restore replaces the current database. Both restore scripts first create a fresh safety backup, stop the API and web services, restore the selected dump, and restart the application.

TrueNAS/Linux:

```sh
sh scripts/restore-database.sh backups/mad-planner-YYYYMMDD-HHMMSS.dump --confirm-restore
```

Windows:

```powershell
.\scripts\restore-database.ps1 -BackupFile .\backups\mad-planner-YYYYMMDD-HHMMSS.dump -ConfirmRestore
```

After restoration, check container health and verify login, recipes, planner entries, grocery lists, and recipe images.

## Update Mad Planner

The standalone YAML uses immutable `sha-...` image tags instead of `latest`. Before deployment, replace `REPLACE_WITH_GITHUB_SHA` in both image names with the short commit SHA shown by the successful GitHub Actions publication, for example `sha-a1b2c3d`. Both API and web must use the same commit tag.

After GitHub publishes new images, take a dataset snapshot first, change both tags to the new commit, then use the TrueNAS update or redeploy action. The API applies pending database migrations automatically during startup.

Redeploying replaces the disposable application containers, not the PostgreSQL dataset. The database remains at the configured `/mnt/.../postgres` path. Do not select storage-removal options or delete that dataset during an update.

For every update:

1. Take a TrueNAS snapshot of the Mad Planner PostgreSQL dataset.
2. Run the supported database backup script and copy the dump off-system.
3. Deploy the new images and wait for all health checks.
4. Confirm login, recipes, planner entries, and grocery generation.
5. Keep the previous image version available until verification is complete.

## Roll back an update

Keep a note of the previous API and web `sha-...` tag before every update. If the new version fails before applying a database migration, change both image tags back to the previous value and redeploy.

If the new API applied database migrations, restore the pre-update database snapshot or portable dump before starting the older images. Application code and database schema must be rolled back together. Never point an older API image at a database that has newer, incompatible migrations.

## Home-network security

Mad Planner has family accounts and access controls, but its current TrueNAS example uses plain HTTP. Keep it on a trusted home network and do not expose its port directly to the internet. HTTPS with a stable hostname is required before passkeys are enabled for production use.
