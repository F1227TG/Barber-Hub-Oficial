"""Small response helpers shared by extracted routers."""

from fastapi.responses import JSONResponse


def ok(data: object, status_code: int = 200, *, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": True, "data": data},
        headers=headers,
    )
