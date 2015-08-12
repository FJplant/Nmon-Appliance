#!/bin/bash

HOSTNAME=localhost
PORT=6900
#VERBOSE="-v"
OPTION="-w \\n\\n%{http_code} %{url_effective} %{time_total}\\n\\n"

function nmonlog_upload {
    echo -e "> upload nmonlog...\n"
    curl $VERBOSE "$OPTION" -X POST --data-binary @$1 http://$HOSTNAME:$PORT/nmonlog_bulk
}

function categories_list {
    echo -e "> list categories...\n"
    curl $VERBOSE "$OPTION" http://$HOSTNAME:$PORT/categories
}

function hosts_list {
    echo -e "> list hosts...\n"
    curl $VERBOSE "$OPTION" http://$HOSTNAME:$PORT/All/$1/hosts
}

function titles_list {
    echo -e "> list titles...\n"
    curl $VERBOSE "$OPTION" http://$HOSTNAME:$PORT/$1/$2/titles
}

function fields_list {
    echo -e "> list fields...\n"
    curl $VERBOSE "$OPTION" "http://$HOSTNAME:$PORT/$1/$2?data=\['"$3"'\]"
}

function help_ {
    echo "Usage: nmon-upldr.sh [resource][command] [arg1] [arg2]"
    echo
    echo "Examples:"
    echo "    ./nmon-upldr.sh nmonlog upload omrms12_1_110303_0000.nmon"
    echo "    ./nmon-upldr.sh categories list"
    echo "    ./nmon-upldr.sh hosts list CPU001"
    echo "    ./nmon-upldr.sh fields list All MEM memtotal"
    echo

}

if [ -z $1 ]; then
    help_
else
    $1_$2 $3 $4 $5
fi

