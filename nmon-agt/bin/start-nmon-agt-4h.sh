#!/bin/bash
nohup python ./nmon-agt.py -c ../conf/nmon-agt-4h.conf -w >/dev/null 2>&1 &
