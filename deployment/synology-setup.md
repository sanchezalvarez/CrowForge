# CrowForge on Synology NAS

## Requirements
- Synology NAS with Docker package installed
- DSM 7.0+

## Steps

### 1. Upload files to NAS
Upload the entire CrowForge folder to your NAS (e.g., /volume1/docker/crowforge)

### 2. Create docker-compose via Synology Container Manager
Open Container Manager -> Project -> Create

Or SSH into your NAS and run:

```bash
cd /volume1/docker/crowforge
cp .env.example .env
nano .env   # Set your API key
```

Set your API key:
```
CROWFORGE_HOST_API_KEY=sk-cf-yourkey
```

Start the container:
```bash
docker-compose up -d
```

### 3. Port forwarding (optional, for external access)
In DSM -> Control Panel -> Router Configuration:
- Add port forwarding rule: external 8000 -> NAS-IP:8000

### 4. Connect from CrowForge desktop app
In CrowForge Settings -> Connection:
- Mode: Connect
- URL: http://YOUR-NAS-IP:8000
- API Key: (from your .env file)

### 5. Backup
```bash
docker cp crowforge-backend:/data/crowforge.db ./backup.db
```
