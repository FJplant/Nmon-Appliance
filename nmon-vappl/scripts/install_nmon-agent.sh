#!/bin/bash
echo "[`date`] Installing nmon-agent component of Nmon.io]
name=FJinT Nmon-io nmon-agent
baseurl=http://downloads.nmon.io/linux/yum
enabled=1
gpgcheck=1
gpgkey=https://nmon.io/keys/nmon-agent-linux.key
" > /etc/yum.repos.d/Nmon.io-nmon-agent-linux.repo
yum install nmon-agent
