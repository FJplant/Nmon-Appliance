# Install script from https://www.hipchat.com/downloads
#!/bin/bash
echo "[Nmon.io nmon-agt]
name=Nmon.io nmon-agt
baseurl=http://downloads.nmon.io/linux/yum
enabled=1
gpgcheck=1
gpgkey=https://www.nmon.io/keys/nmon-agt-linux.key
" > /etc/yum.repos.d/nmon-agt.repo
yum install nmon-agt
