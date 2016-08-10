rem
rem nmon-repo start script for Windows
rem
rem TODO: change below script to windows

set FOREVER_OPTS="--minUptime 5000 --spinSleepTime 5000"

node node_modules/forever/bin/forever start \
    %FOREVER_OPTS% nmon-db.js

function start {
    node_modules/forever/bin/forever start \
    $FOREVER_OPTS nmon-db.js 
}

function stop {
    node_modules/forever/bin/forever stop nmon-db.js 
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
    echo "Usage: ./daemon.cmd [command]"
    echo "command: start, stop, restart, list"
    echo
}

if [ -z $1 ]; then
    help_
else
    $1
fi

start node node_modules/forever/bin/forever start %FOREVER_OPTS% nmon-db.js