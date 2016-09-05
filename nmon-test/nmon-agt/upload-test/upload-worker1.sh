#!/bin/bash
#./upload-nmon-tokyo.sh > ../logs/upload-nmon-tokyo.log
#./upload-yns-tokyo.sh > ../logs/upload-yns-tokyo.log
export NMON_AGT_HOME="../../../nmon-agt"
./upload-aix-db1.sh > $NMON_AGT_HOME/logs/upload-aix-db1.log
./upload-aix-db2.sh > $NMON_AGT_HOME/logs/upload-aix-db2.log
#./upload-aix-db3.sh > ../logs/upload-aix-db3.log
#./upload-aix-db4.sh > ../logs/upload-aix-db4.log
