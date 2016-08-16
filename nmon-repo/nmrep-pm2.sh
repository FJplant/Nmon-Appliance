#!/bin/bash

PM2_OPTS="--log ./logs/nmrep-pm2.log --name "nmon-server" --kill-timeout 5000 --restart-delay 5000"

function start {
    pm2 start $PM2_OPTS nmon-server.js
}

function stop {
    pm2 stop nmon-server
}

function restart {
    pm2 restart $PM2_OPTS nmon-server
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
