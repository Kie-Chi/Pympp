"""
Config API endpoints
Provides global configuration management with SSE real-time sync
"""
import os
import json
import asyncio
from fastapi import APIRouter, HTTPException, Header, Depends
from fastapi.responses import StreamingResponse
from typing import Optional

from ..db.config_repo import get_config_repository, ConfigRepository
from ..db.config_models import GlobalConfig
from ..log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/config", tags=["config"])

# Global event for SSE notifications
config_update_event = asyncio.Event()

# Store latest config for SSE subscribers
latest_config_cache: Optional[dict] = None


def get_auth_token() -> str:
    """Get AUTH_TOKEN from environment"""
    return os.environ.get("AUTH_TOKEN", "")


def verify_admin_token(x_auth_token: Optional[str] = Header(None, alias="X-Auth-Token")):
    """Verify admin authentication token"""
    expected_token = get_auth_token()

    # If no token configured, admin mode is disabled
    if not expected_token:
        raise HTTPException(status_code=403, detail="Admin mode is disabled (no AUTH_TOKEN configured)")

    if not x_auth_token:
        raise HTTPException(status_code=401, detail="X-Auth-Token header is required")

    if x_auth_token != expected_token:
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    return x_auth_token


def notify_config_update(config: GlobalConfig):
    """Notify all SSE subscribers of config update"""
    global latest_config_cache
    latest_config_cache = config.to_dict()
    config_update_event.set()
    # Reset event for next update
    asyncio.get_event_loop().call_soon(lambda: config_update_event.clear())


@router.get("")
async def get_config(
    repo: ConfigRepository = Depends(get_config_repository)
):
    """
    Get current global configuration
    Available to all users (read-only)
    """
    config = repo.get_config()
    return config.to_dict()


@router.put("")
async def update_config(
    config_data: dict,
    _: str = Depends(verify_admin_token),
    repo: ConfigRepository = Depends(get_config_repository)
):
    """
    Update global configuration
    Requires valid X-Auth-Token header
    """
    # Create GlobalConfig from request data
    try:
        new_config = GlobalConfig.from_dict(config_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid config data: {str(e)}")

    # Update in database
    updated_config = repo.update_config(new_config)

    # Notify SSE subscribers
    notify_config_update(updated_config)

    logger.info(f"Global config updated by admin")

    return updated_config.to_dict()


@router.get("/stream")
async def config_stream():
    """
    SSE endpoint for real-time config updates
    Returns event stream with config updates
    """
    async def event_generator():
        global latest_config_cache

        # Send initial config
        repo = get_config_repository()
        initial_config = repo.get_config()
        yield f"data: {json.dumps(initial_config.to_dict())}\n\n"

        # Then wait for updates
        while True:
            try:
                await asyncio.wait_for(config_update_event.wait(), timeout=30.0)
                if latest_config_cache:
                    yield f"data: {json.dumps(latest_config_cache)}\n\n"
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                yield f": heartbeat\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.get("/status")
async def get_admin_status():
    """
    Check if admin mode is available
    Returns whether AUTH_TOKEN is configured
    """
    token = get_auth_token()
    return {
        "admin_available": bool(token),
        "message": "Admin mode is enabled" if token else "Admin mode is disabled"
    }


@router.post("/verify")
async def verify_token(
    _: str = Depends(verify_admin_token)
):
    """
    Verify admin authentication token
    Returns success if token is valid
    """
    return {"valid": True}