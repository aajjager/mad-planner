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
```

Replace `tank` with the name of your storage pool. The account running Docker must be able to write to this dataset.

## 3. Prepare the app configuration

Open `compose.truenas-app.yaml` in GitHub or VS Code and copy its contents. Before using it, change:

- both `CHANGE_THIS_PASSWORD` values to the same long alphanumeric password
- `/mnt/tank/apps/mad-planner/postgres` to the dataset created above
- `8080:80` if port 8080 is already used on TrueNAS

Avoid punctuation in the database password because it is also included in a connection URL.

Do not save your real password back into Git.

## 4. Install through TrueNAS Apps

1. Open **Apps**, then **Discover Apps**.
2. Open the three-dot menu and select **Install via YAML**.
3. Enter `mad-planner` as the application name.
4. Paste the edited contents of `compose.truenas-app.yaml` into **Custom Config**.
5. Click **Save** and wait for the application to report **Running**.

Open `http://TRUENAS-IP:8080`, replacing the address and port when necessary.

## Back up the database

Use TrueNAS dataset snapshots as the first layer of protection. A portable `pg_dump` backup can also be created from the TrueNAS shell after identifying the app's database container.
Take a snapshot or portable backup before every update.

## Update Mad Planner

After GitHub publishes new `latest` images, open the installed app in TrueNAS and use its update or redeploy action. Take a dataset snapshot first. The API applies pending database migrations automatically during startup.

## Home-network security

Mad Planner does not yet have user authentication. Keep it on a trusted home network and do not expose its port directly to the internet. Authentication and HTTPS through a reverse proxy can be added later.
