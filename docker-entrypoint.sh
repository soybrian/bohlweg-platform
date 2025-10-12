#!/bin/sh
set -e

# Ensure data directory exists and has correct permissions
mkdir -p /app/data
chown -R nextjs:nodejs /app/data

# Switch to nextjs user and execute the command
exec su-exec nextjs "$@"
