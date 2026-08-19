# Deploy Mad Planner on TrueNAS SCALE

This guide deploys Mad Planner with Docker Compose and stores PostgreSQL data in a TrueNAS dataset. Commands are run from the cloned `mad-planner` repository.

## 1. Create persistent storage

In the TrueNAS web interface, create a dataset for PostgreSQL, for example:

```text
/mnt/tank/apps/mad-planner/postgres
```

Replace `tank` with the name of your storage pool. The account running Docker must be able to write to this dataset.

## 2. Configure Mad Planner

Copy `.env.truenas.example` to `.env`:

```sh
cp .env.truenas.example .env
```

Edit `.env` and set a new long `POSTGRES_PASSWORD`, the dataset's `MADPLANNER_DATA_PATH`, and an available `MADPLANNER_PORT`.

The `.env` file is ignored by Git and must never be committed.

## 3. Start the application

```sh
docker compose -f compose.yaml -f compose.truenas.yaml up --build -d
docker compose -f compose.yaml -f compose.truenas.yaml ps
```

Wait until all three services report healthy. Open `http://TRUENAS-IP:8080`, replacing the address and port when necessary.

## Back up the database

```sh
mkdir -p backups
docker compose -f compose.yaml -f compose.truenas.yaml exec -T db pg_dump -U madplanner -d madplanner -Fc > backups/madplanner.dump
```

Copy the dump to storage covered by your TrueNAS snapshots or backup jobs. Take a backup before every update.

## Restore a database backup

Restoring replaces the current database contents. Stop the web and API first:

```sh
docker compose -f compose.yaml -f compose.truenas.yaml stop web api
docker compose -f compose.yaml -f compose.truenas.yaml exec -T db pg_restore -U madplanner -d madplanner --clean --if-exists < backups/madplanner.dump
docker compose -f compose.yaml -f compose.truenas.yaml start api web
```

Use the database name and user from `.env` if you changed their defaults.

## Update Mad Planner

Commit or stash local work and take a database backup first. Then:

```sh
git pull --ff-only
docker compose -f compose.yaml -f compose.truenas.yaml up --build -d
docker compose -f compose.yaml -f compose.truenas.yaml ps
```

The API applies database migrations during startup. For an unhealthy service, run `docker compose -f compose.yaml -f compose.truenas.yaml logs --tail 100`.

## Stop the application

```sh
docker compose -f compose.yaml -f compose.truenas.yaml down
```

This retains the database. Do not delete its dataset unless you intentionally want to remove the data.

## Home-network security

Mad Planner does not yet have user authentication. Keep it on a trusted home network and do not expose its port directly to the internet. Authentication and HTTPS through a reverse proxy can be added later.
