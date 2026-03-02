#!/usr/bin/env python3
"""
启动 FastAPI 服务器
默认监听在 0.0.0.0:8000，允许外部访问
"""
import uvicorn
import socket

if __name__ == "__main__":
    # 获取本机IP
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    
    print("="*60)
    print("MIPS Pipeline Simulator API Server")
    print("="*60)
    print(f"Server starting on:")
    print(f"  - Local:   http://localhost:8000")
    print(f"  - Network: http://{local_ip}:8000")
    print(f"  - Public:  http://mobile.fl0wer.cn:8000 (if configured)")
    print("="*60)
    
    uvicorn.run(
        "pympp.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
