#!/bin/bash

FOREVER_OPTS="--minUptime 5000 --spinSleepTime 5000"

function start {
    node_modules/forever/bin/forever start \
    $FOREVER_OPTS nmdb-server.js
}

function stop {
    node_modules/forever/bin/forever stop nmdb-server.js
}

function restart {
    stop
    start
}

function list {
    node_modules/forever/bin/forever list
}

function help_ {
    echo
    echo "Usage: ./daemon.sh [command]"
    echo "command: start, stop, restart, list"
    echo
}

if [ -z $1 ]; then
    help_
else
    $1
fi
