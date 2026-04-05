# PocketBase Migrations

This directory contains PocketBase schema migrations for CrowForge.

Migration files are JavaScript files that define collection schema changes and are automatically applied by PocketBase on startup when mounted into the container.

To apply migrations, ensure this directory is mounted to `/pb/pb_migrations` in the PocketBase container (already configured in `docker-compose.pocketbase.yml`).
