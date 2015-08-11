#!/bin/bash
nohup python nmon-agt.py -c nmon-agt.conf -w >/dev/null 2>&1 &
