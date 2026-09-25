# HTTPS setup

Mad Planner should use a stable hostname and HTTPS before enabling passkeys or browser notifications outside localhost. Keep the application port bound to the server itself and let a reverse proxy be the only public entry point. PostgreSQL remains private inside the Compose network.

## Cloudflare Tunnel (recommended when the domain uses Cloudflare)

Cloudflare Tunnel provides the public HTTPS certificate and reaches Mad Planner through an outbound-only connection. You do not need to forward ports 80, 443, or 8080 from the router. Mad Planner includes an optional `compose.cloudflare.yaml` overlay for Debian and other Docker Compose hosts.

### 1. Create the tunnel and hostname

1. Sign in to the Cloudflare dashboard and make sure your domain is active there.
2. Open **Networking → Tunnels**, choose **Create tunnel**, select `cloudflared`, and give it a name such as `mad-planner`.
3. In the tunnel, add a **Published application** route.
4. Choose a hostname such as `planner.example.com`.
5. Set the service type to **HTTP** and the service URL to `http://web:80`. `web` is the private Docker service name; do not enter the public hostname or `localhost` here.
6. Save the route. Cloudflare creates the tunnel DNS record automatically.

### 2. Store the tunnel token safely

On the tunnel's connector setup page, select Docker and copy only the long token following `--token`. Anyone possessing this token can run the tunnel, so keep it in the ignored `.env` file and in your password manager.

Set these values in `.env` on the Docker host:

```env
CLOUDFLARE_TUNNEL_TOKEN=replace-with-the-long-token
SESSION_COOKIE_SECURE=true
MADPLANNER_BIND_ADDRESS=127.0.0.1
```

`SESSION_COOKIE_SECURE=true` ensures login cookies are only sent over HTTPS. Binding port 8080 to `127.0.0.1` prevents other devices from bypassing Cloudflare while still leaving local troubleshooting available on the Docker host.

### 3. Start Mad Planner with the tunnel

```sh
docker compose -f compose.yaml -f compose.cloudflare.yaml up -d --build
docker compose -f compose.yaml -f compose.cloudflare.yaml ps
docker compose -f compose.yaml -f compose.cloudflare.yaml logs cloudflared --tail 50
```

The `cloudflared` service should remain running and report connected tunnel sessions. Open only `https://planner.example.com`, then verify login, MFA enrollment, recipe images, file uploads, browser notifications, and a page refresh.

Use the same two `-f` arguments for future starts, updates, and log checks. A normal `docker compose down` also finds and removes the tunnel container when the overlay is supplied:

```sh
docker compose -f compose.yaml -f compose.cloudflare.yaml down
```

If the tunnel is Healthy but the website is unavailable, confirm that its published application's service URL is exactly `http://web:80` and inspect `docker compose -f compose.yaml -f compose.cloudflare.yaml logs cloudflared`. Do not select HTTPS for the internal service; Nginx listens for HTTP on port 80 inside the Compose network.

Cloudflare Access can optionally add another login screen in front of Mad Planner. It is not required because Mad Planner already has accounts and MFA. If Access is enabled later, allow every family member's identity before relying on it.

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
