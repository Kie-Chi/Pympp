#!/bin/bash
# Docker run script for pympp
# Uses PYMPP_TYPE environment variable to determine mode

set -e

# Default to production mode
PYMPP_TYPE=${PYMPP_TYPE:-prod}

echo "=========================================="
echo "PYMPP Docker Runner"
echo "Mode: $PYMPP_TYPE"
echo "=========================================="

if [ "$PYMPP_TYPE" = "dev" ]; then
    echo "Running in DEVELOPMENT mode:"
    echo "  - Backend: Hot reload enabled, source mounted"
    echo "  - Frontend: Vite dev server, source mounted"
    echo ""
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
else
    echo "Running in PRODUCTION mode:"
    echo "  - Backend: No volume mounts, optimized image"
    echo "  - Frontend: Nginx serving static files"
    echo ""
    docker compose up --build -d
fi