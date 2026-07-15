"""Domain-level errors that map directly to the contract's error shape."""


class AppError(Exception):
    """An error that should reach the client as
    ``{"error": {"code": ..., "message": ...}}``.

    Attributes:
        status_code: The HTTP status code this error should be returned as.
        code: A stable, machine-readable error code (e.g. ``"UNAUTHORIZED"``).
        message: A human-readable description of what went wrong.
    """

    def __init__(self, status_code: int, code: str, message: str) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)
