#!/bin/bash

HOST="localhost"
PORT="6900"
INTERVAL="5"

LOGDIR="data"
PIDFILE="$LOGDIR/NMON.pid"

function start {
    DATE=$(eval date +_%y%m%d_%H%M)
    LOGFILE="$LOGDIR/$HOSTNAME$DATE.nmon"
    nmon -F $LOGFILE -t -s $INTERVAL
    PID=$(eval ps | grep nmon | head -n 1 | awk '{print $1}')
    echo $PID > $PIDFILE
    URL="http://$HOST:$PORT/nmonlog"
    forever start -c python nmon_agent.py $LOGFILE $INTERVAL $URL
}

function stop {
    forever stop nmon_agent.py
    PID="$(cat $PIDFILE)"
    kill -9 $PID
}

function list {
    forever list
}

function help_ {
    echo 
    echo "Usage: ./agent.sh [command]"
    echo "command: start, stop, list"
    echo
}

if [ -z $1 ]; then
    help_
else
    $1 
fi
