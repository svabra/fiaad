from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from fastapi import Header, HTTPException, Request, status

from daaif_api.models import RequestContext


async def request_context(
    request: Request,
    authorization: str | None = Header(default=None),
    x_tenant_id: str | None = Header(default=None, alias="X-Tenant-ID"),
    x_user_id: str | None = Header(default=None, alias="X-User-ID"),
    x_correlation_id: str | None = Header(default=None, alias="X-Correlation-ID"),
) -> RequestContext:
    settings = request.app.state.settings
    correlation_id = x_correlation_id or str(uuid4())
    if settings.auth_mode == "dev":
        try:
            return RequestContext(
                tenant_id=x_tenant_id or "estv",
                user_id=x_user_id or "data.analyst@local",
                roles=("analyst", "catalog-reader"),
                correlation_id=correlation_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid development identity headers.") from exc

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required.")
    try:
        payload = jwt.decode(
            authorization.removeprefix("Bearer ").strip(),
            settings.auth_jwt_secret.get_secret_value(),
            algorithms=["HS256"],
            issuer=settings.auth_jwt_issuer,
            audience=settings.auth_jwt_audience,
        )
        return RequestContext(
            tenant_id=payload["tid"],
            user_id=payload["sub"],
            roles=tuple(payload.get("roles", ())),
            correlation_id=correlation_id,
        )
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bearer token.") from exc


def encode_internal_context(context: RequestContext, secret: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "iss": "daaif-api",
            "aud": "daaif-backend",
            "sub": context.user_id,
            "tid": context.tenant_id,
            "roles": list(context.roles),
            "cid": context.correlation_id,
            "iat": now,
            "exp": now + timedelta(minutes=2),
        },
        secret,
        algorithm="HS256",
    )

