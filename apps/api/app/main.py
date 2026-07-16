"""FastAPI application entrypoint."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.exceptions import AppError
from app.routers import auth, health

app = FastAPI(title="RentaTodo API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Translate FastAPI's request-validation errors into the contract's
    structured error shape instead of the default ``{"detail": [...]}``.

    Every invalid/missing field is joined into one message, so the client
    sees all of them at once instead of having to resubmit repeatedly.

    Args:
        request: The incoming request (unused, required by FastAPI's
            exception handler signature).
        exc: The validation error raised while parsing the request.

    Returns:
        A 422 JSON response with ``{"error": {"code": "VALIDATION_ERROR",
        "message"}}``.
    """
    message = "; ".join(
        f"{'.'.join(str(part) for part in error['loc'][1:])}: {error['msg']}"
        for error in exc.errors()
    )
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": message}},
    )
