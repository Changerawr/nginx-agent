#!/bin/sh
set -e

echo "=== Changerawr Nginx Agent ==="
echo "Initializing..."

# Load config from /app/chragent.conf if it exists and env vars aren't set
if [ -f /app/chragent.conf ] && [ -z "$AGENT_SECRET" ]; then
    echo "Loading configuration from /app/chragent.conf"
    export $(grep -v '^#' /app/chragent.conf | xargs)
fi

# Create required directories if they don't exist
mkdir -p "${CERT_DIR:-/etc/ssl/changerawr}"
mkdir -p "${NGINX_DIR:-/etc/nginx/sites-enabled}"
mkdir -p /var/lib/nginx/logs
mkdir -p /run/nginx

# Set permissions
chmod 755 "${CERT_DIR:-/etc/ssl/changerawr}"
chmod 755 "${NGINX_DIR:-/etc/nginx/sites-enabled}"

# Configure nginx to include sites-enabled
if [ ! -f /etc/nginx/http.d/sites-enabled.conf ]; then
    echo "include /etc/nginx/sites-enabled/*.conf;" > /etc/nginx/http.d/sites-enabled.conf
fi

# Start nginx in the background
echo "Starting nginx..."
nginx

# Trap SIGTERM and SIGINT to gracefully shut down
trap 'echo "Shutting down..."; nginx -s quit; exit 0' TERM INT

# Show mode
if [ "${SANDBOX_MODE}" = "true" ]; then
    echo "*** RUNNING IN SANDBOX MODE ***"
    echo "No actual system commands will be executed"
else
    echo "Running in LIVE mode"
fi

# Start the agent
echo "Starting agent on port ${AGENT_PORT:-7842}..."
exec "$@"
