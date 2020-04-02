#!/bin/bash
kill -SIGINT $(ps -A | grep "gunicorn" | head -1 | awk '{$1=$1};1' | cut -d' ' -f 1)
nginx -s quit
echo "# mysql.server stop"
