#!/usr/bin/env python3
"""
启动 FastAPI 服务器
默认监听在 0.0.0.0:8000，允许外部访问
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "pympp.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
