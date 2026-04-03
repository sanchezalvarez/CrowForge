#!/bin/bash
# CrowForge Server — Linux installation script
# Run as root: sudo bash install-linux.sh

set -e

echo "=== CrowForge Server Installation ==="

# Create user
useradd -r -s /bin/false crowforge 2>/dev/null || true

# Create directories
mkdir -p /opt/crowforge/data
cp -r . /opt/crowforge/
chown -R crowforge:crowforge /opt/crowforge

# Python venv
python3 -m venv /opt/crowforge/venv
/opt/crowforge/venv/bin/pip install -r /opt/crowforge/requirements.txt

# Generate API key if not set
if [ ! -f /opt/crowforge/.env ]; then
    API_KEY="sk-cf-$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
    echo "CROWFORGE_HOST_API_KEY=$API_KEY" > /opt/crowforge/.env
    chown crowforge:crowforge /opt/crowforge/.env
    chmod 600 /opt/crowforge/.env
    echo ""
    echo "Generated API key: $API_KEY"
    echo "Share this with your team!"
    echo ""
fi

# Install systemd service
cp deployment/crowforge.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable crowforge
systemctl start crowforge

echo ""
echo "=== Installation complete ==="
echo "CrowForge is running on port 8000"
echo "Check status: systemctl status crowforge"
echo "View logs: journalctl -u crowforge -f"
