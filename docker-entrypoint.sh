#!/bin/sh
set -e


if [ -n "$CONFIG" ]; then
	echo "Found configuration variable, will write it to the /usr/src/garie-plugin/config.json"
	echo "$CONFIG" > /usr/src/garie-plugin/config.json
fi

if [ -n "$WEBBKOLL_HOST" ]; then
  echo "Waiting for http://$WEBBKOLL_HOST:$WEBBKOLL_PORT ..."
  until curl -s http://$WEBBKOLL_HOST:$WEBBKOLL_PORT > /dev/null; do
    echo "Still waiting for webbkoll to start up (it typically compiles some assets on first run)..."
    sleep 5
  done
  echo "Webbkoll is up!"
fi

exec "$@"
