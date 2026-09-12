#!/bin/sh
# Certbot deploy hook: only reload Nginx if a renewed certificate loads correctly.
set -eu

/usr/sbin/nginx -t
/bin/systemctl reload nginx
