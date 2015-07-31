#!/bin/bash

HOST="localhost"
PORT="6900"
LOGDIR="data"

function main {
    DATE=$(eval date +_%y%m%d_%H%M)
    LOGFILE="$LOGDIR/$HOSTNAME$DATE.nmon"
    nmon -F $LOGFILE -t -s $1
    PID=$(eval ps | grep nmon | head -n 1 | awk '{print $1}')
    URL="http://$HOST:$PORT/nmonlog"
    python nmon_agent.py $LOGFILE $1 $URL
    kill -9 $PID
}

function help_ {
    echo 
    echo "Usage: ./agent.sh interval"
    echo 
    echo "example) ./agent.sh 30"
    echo
}

if [ -z $1 ]; then
    help_
else
    main $1 
fi
