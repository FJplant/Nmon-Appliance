#!/bin/bash

function start {
    node_modules/forever/bin/forever start nmonw.js 
}


function stop {
    node_modules/forever/bin/forever stop nmonw.js 
}

function list {
    node_modules/forever/bin/forever list
}

function help_ {
    echo
    echo "Usage: ./daemon.sh [command]"
    echo "command: start, stop, list"
    echo
}

if [ -z $1 ]; then
    help_
else
    $1
fi
