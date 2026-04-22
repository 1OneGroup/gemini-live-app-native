# Rollback — host-mode Gemini Live → Docker

If host-mode shows problems (echo, silent calls, crashes, etc.), revert to Docker:

## 1. Stop systemd, start Docker

```bash
sudo systemctl stop gemini-live-app-native
docker start gemini-live-app-native
# (the container was STOPPED — not removed — during cutover; volumes intact)
```

If `docker start` fails, recreate from compose:

```bash
docker compose -f /home/office/gemini-live-app-native/docker-compose.yml up -d
```

## 2. Restore Caddyfile

Edit `/docker/caddy/Caddyfile`, change:

```
gemini-live.tech.onegroup.co.in {
    # Host-mode (systemd) since 2026-04-22; old target: gemini-live-bridge:8100
    reverse_proxy host.docker.internal:8100
}
```

back to:

```
gemini-live.tech.onegroup.co.in {
    reverse_proxy gemini-live-bridge:8100
}
```

Reload Caddy (no recreate needed for this — the `extra_hosts` and UFW rule can stay):

```bash
sudo docker exec caddy-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

## 3. Verify

```bash
curl -sS https://gemini-live.tech.onegroup.co.in/health
# Expected: {"status":"ok",...}
```

## 4. Optional cleanup of host-mode artifacts

If rolling back permanently:

```bash
sudo systemctl disable gemini-live-app-native
sudo rm /etc/systemd/system/gemini-live-app-native.service
sudo systemctl daemon-reload
# UFW rule is harmless to leave; remove if cleanliness matters:
sudo ufw delete allow from 172.26.0.0/16 to any port 8100 proto tcp
```

## What is preserved through the cutover

- Docker container `gemini-live-app-native` is stopped, not deleted.
- Docker named volumes `gemini-live-app-native_call-data` and `gemini-live-app-native_prompt-data` are untouched (will be deleted only after operator confirms ≥7 days of stable host operation).
- Image `1onegroup/gemini-live-app-native:latest` is still in `docker images`.
- Host data dir `/home/office/gemini-live-app-native/data/` survives rollback (Docker reads from its own volumes; rollback does not touch host data).
- Caddyfile pre-host-mode backup at `/docker/caddy/Caddyfile.bak.pre-host-mode`.
- Caddy compose pre-host-mode backup at `/docker/caddy/docker-compose.yml.bak.pre-host-mode`.

## Notes on networking

`host.docker.internal:host-gateway` does NOT work for containers on a custom user
network like `shared-proxy` — it resolves to docker0's gateway (172.17.0.1) which
inter-bridge isolation drops. We hard-coded the shared-proxy gateway IP
(172.26.0.1) in `extra_hosts:` instead. If shared-proxy is ever recreated and
gets a different gateway IP, edit `/docker/caddy/docker-compose.yml` to match.

UFW INPUT default policy is DROP; the rule
`ufw allow from 172.26.0.0/16 to any port 8100 proto tcp` lets the caddy
container reach the host's systemd-served port. Without it, traffic is silently
dropped.
