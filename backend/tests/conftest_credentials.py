"""Shared test configuration - credentials loaded from environment variables."""
import os

API_URL = os.environ.get("TEST_API_URL", "https://finanzas-ecuador-2.preview.emergentagent.com")
ADMIN_EMAIL = os.environ.get("TEST_ADMIN_EMAIL", "earauzt@gmail.com")
ADMIN_PASSWORD = os.environ.get("TEST_ADMIN_PASSWORD", "Realmadrid2011")
DEMO_EMAIL = os.environ.get("TEST_DEMO_EMAIL", "demo@fintrack.ec")
DEMO_PASSWORD = os.environ.get("TEST_DEMO_PASSWORD", "demo2026")
