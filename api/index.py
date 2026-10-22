"""ASGI entry point used by Vercel and local servers."""

from backend.application import create_app

app = create_app()
