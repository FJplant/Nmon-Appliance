#!/bin/bash

PM2_OPTS="--log ./logs/nmrep-pm2.log --name "nmdb-server" --kill-timeout 5000 --restart-delay 5000"

function start {
    pm2 start $PM2_OPTS nmdb-server.js
}

function stop {
    pm2 stop nmdb-server
}

function restart {
    pm2 restart $PM2_OPTS nmdb-server
}

function list {
    pm2 list
}

function help_ {
    echo
    echo "Usage: ./nmrep-pm2 [command]"
    echo "command: start, stop, restart, list"
    echo
}

if [ -z $1 ]; then
    help_
else
    $1
fi
