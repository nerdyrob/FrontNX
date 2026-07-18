#!/usr/bin/env bash
cd "$(dirname "$0")"
IP=$(hostname -I | awk '{print $1}')
PORT=3001 HOST=0.0.0.0 node build/server/index.mjs &
SERVER_PID=$!
sleep 2
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://$IP:3001" 2>/dev/null
elif command -v sensible-browser >/dev/null 2>&1; then
  sensible-browser "http://$IP:3001"
elif command -v gnome-open >/dev/null 2>&1; then
  gnome-open "http://$IP:3001"
fi
echo "Server running at http://$IP:3001"
wait $SERVER_PID
