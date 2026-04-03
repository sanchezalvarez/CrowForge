# Running CrowForge as a Team Server

## Quick start (Docker)

```bash
git clone https://github.com/sanchezalvarez/CrowForge
cd CrowForge
cp .env.example .env
# Edit .env — set CROWFORGE_HOST_API_KEY
docker-compose up -d
```

Server runs on http://YOUR-IP:8000

## Quick start (standalone)

```bash
pip install -r requirements.txt
CROWFORGE_HOST_API_KEY=sk-cf-mykey python start-server.py
```

## Connect from desktop app

In CrowForge -> Settings -> Connection:
- Mode: Connect to server
- URL: http://YOUR-SERVER-IP:8000
- API Key: (from your .env file)

## Environment variables

| Variable | Default | Description |
|---|---|---|
| CROWFORGE_DEPLOYMENT_MODE | host | Deployment mode (host for server) |
| CROWFORGE_HOST_API_KEY | (none) | API key for client auth |
| CROWFORGE_HOST_PORT | 8000 | Port to listen on |
| CROWFORGE_DB_PATH | ./crowforge.db | SQLite database path |
| CROWFORGE_LOG_LEVEL | INFO | Log level (INFO/DEBUG/WARNING) |

## Platforms

| Platform | Method | Guide |
|---|---|---|
| Linux VPS | systemd | `deployment/install-linux.sh` |
| Windows Server | NSSM service | `deployment/install-windows.ps1` |
| Synology NAS | Docker | `deployment/synology-setup.md` |
| Any Docker host | docker-compose | `docker-compose.yml` |

## Data persistence

SQLite database is stored in Docker volume `crowforge-data`.

Backup: `docker cp crowforge-backend:/data/crowforge.db ./backup.db`

Restore: `docker cp ./backup.db crowforge-backend:/data/crowforge.db`
