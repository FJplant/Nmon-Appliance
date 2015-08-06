#!/bin/bash

HOST="localhost"
PORT="6900"
INTERVAL="5"
COUNT="2880"
HOMEDIR="$HOME/nmon.io/nmon-agent"
#HOMEDIR="."

LOGDIR="$HOMEDIR/data"
PIDFILE="$LOGDIR/nmon-agt-4h.pid"
PYFILE="$HOMEDIR/nmon-agt.py"

function start {
    DATE=$(eval date +_%y%m%d_%H%M)
    LOGFILE="$LOGDIR/$HOSTNAME$DATE-4h.nmon"
    nmon -F $LOGFILE -t -s $INTERVAL -c $COUNT
    PID=$(eval ps | grep nmon | head -n 1 | awk '{print $1}')
    echo $PID > $PIDFILE
    URL="http://$HOST:$PORT/nmonlog"
    forever start -c python $PYFILE $LOGFILE $INTERVAL $URL
}

function stop {
    forever stop $PYFILE
    PID="$(cat $PIDFILE)"
    kill -USR2 $PID
}

function list {
    forever list
}

function help_ {
    echo 
    echo "Usage: ./nnon-agt-4h.sh [command]"
    echo "command: start, stop, list"
    echo
}

if [ -z $1 ]; then
    help_
else
    $1 
fi
