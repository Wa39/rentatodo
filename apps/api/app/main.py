"""FastAPI application entrypoint."""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.exceptions import AppError
from app.routers import auth, health

app = FastAPI(title="RentaTodo API")

app.include_router(health.router)
app.include_router(auth.router)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """Translate an AppError into the contract's structured error shape.

    Args:
        request: The incoming request (unused, required by FastAPI's
            exception handler signature).
        exc: The AppError raised somewhere in request handling.

    Returns:
        A JSON response with ``{"error": {"code", "message"}}`` and the
        status code the error was raised with.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )
