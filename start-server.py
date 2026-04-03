#!/usr/bin/env python3
"""
CrowForge Server — Standalone startup script
Usage: python start-server.py

Environment variables:
  CROWFORGE_HOST_API_KEY   API key for client authentication (required for host mode)
  CROWFORGE_HOST_PORT      Port to listen on (default: 8000)
  CROWFORGE_DB_PATH        Path to SQLite database (default: ./crowforge.db)
  CROWFORGE_LOG_LEVEL      Log level: INFO, DEBUG, WARNING (default: INFO)

Example:
  CROWFORGE_HOST_API_KEY=sk-cf-mykey123 python start-server.py
"""

import os
import sys

# Set host mode automatically when using this script
os.environ.setdefault("CROWFORGE_DEPLOYMENT_MODE", "host")
os.environ.setdefault("CROWFORGE_HOST_PORT", "8000")
os.environ.setdefault("CROWFORGE_LOG_LEVEL", "INFO")

# Default DB path to current directory if not set
if not os.environ.get("CROWFORGE_DB_PATH"):
    os.environ["CROWFORGE_DB_PATH"] = os.path.join(os.getcwd(), "crowforge.db")

# Check API key
api_key = os.environ.get("CROWFORGE_HOST_API_KEY", "")
if not api_key:
    print("=" * 60)
    print("WARNING: No API key set!")
    print("Set CROWFORGE_HOST_API_KEY environment variable.")
    print("Example:")
    print("  CROWFORGE_HOST_API_KEY=sk-cf-secret123 python start-server.py")
    print("=" * 60)
    print()
    # In Docker/non-interactive mode, just warn and continue
    if not sys.stdin.isatty():
        print("Running without API key (non-interactive mode).")
    else:
        answer = input("Continue without API key? (y/N): ").strip().lower()
        if answer != "y":
            sys.exit(1)

# Run backend
import uvicorn
from backend.app import app

port = int(os.environ.get("CROWFORGE_HOST_PORT", "8000"))
log_level = os.environ.get("CROWFORGE_LOG_LEVEL", "info").lower()

uvicorn.run(app, host="0.0.0.0", port=port, log_level=log_level, access_log=True)
