"""FastAPI application entrypoint."""

from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="RentaTodo API")

app.include_router(health.router)
