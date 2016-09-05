#!/bin/bash
nohup python ./nmon-agt.py -c ../conf/nmon-agt-dev.conf -w >/dev/null 2>&1 &
