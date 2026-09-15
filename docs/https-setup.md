# HTTPS setup

Mad Planner should use a stable hostname and HTTPS before enabling passkeys or browser notifications outside localhost. Keep the application port bound to the server itself and let a reverse proxy be the only public entry point. PostgreSQL remains private inside the Compose network.

## Debian with Caddy

Create a DNS record for your chosen hostname pointing to the Debian server. Public certificates require ports 80 and 443 to reach Caddy. For a private-only hostname, Caddy can use its local certificate authority, but every phone and computer must trust that authority.

Install Caddy using its official Debian package instructions: <https://caddyserver.com/docs/install#debian-ubuntu-raspbian>

In Mad Planner's `.env`, set:

```env
MADPLANNER_BIND_ADDRESS=127.0.0.1
MADPLANNER_PORT=8080
SESSION_COOKIE_SECURE=true
```

Recreate Mad Planner, copy `deploy/Caddyfile.example` to `/etc/caddy/Caddyfile`, replace `planner.example.com` with the real hostname, then reload Caddy:

```sh
docker compose up -d
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Open only `https://your-hostname`. Confirm that HTTP redirects to HTTPS, login survives a refresh, recipe images load, and backup uploads work. Do not expose port 8080 through the router.

## TrueNAS SCALE

Use a reverse-proxy app already trusted in your environment (for example Caddy, Traefik, or Nginx Proxy Manager). Forward the HTTPS hostname to Mad Planner's web port on the TrueNAS host. Set `SESSION_COOKIE_SECURE=true` in the API environment after HTTPS works, and keep the database service without published ports.

Certificate and proxy configuration differs between TrueNAS installations, so record the hostname, proxy app, certificate source, and internal target in the system backup notes.
