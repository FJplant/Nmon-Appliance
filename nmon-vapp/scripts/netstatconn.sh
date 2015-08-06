#!/bin/bash
while [ true ]
do
  echo '---- Display current tcp connections except 127.0.0.1 (local loopback) ----------------'
  netstat -n | grep ESTABLISHED | sed -e '/127.0.0.1/d';
##  netstat | grep ESTABLISHED | grep 80;
  sleep 2;
done