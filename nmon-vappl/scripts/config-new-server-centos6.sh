#/bin/bash
# Script for linux configuration and package install after minimal install
# Author: Youngmo Kwon 2015.8.3.

echo "[`date`] Change your root password first..."
passwd
echo
echo "[`date`] cat /etc/redhat-release and df -h..."
echo "Redhat release: `cat /etc/redhat-release`"
echo "Disk configuration: "
df -h
echo "dmesg output: "
read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo
dmesg

echo "[`date`] Automatic configuration will start in 10 seconds..."
read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo
echo "[`date`] Automatic configuration started..."

echo "[`date`] Making swap file..."
dd if=/dev/zero of=/.aaSwapfile1 bs=1024 count=8388608
chmod 0600 /.aaSwapfile1
mkswap /.aaSwapfile1
swapon /.aaSwapfile1
free -m
swapon -s

echo "[`date`] Inserting swapfile to /etc/fstab"
echo "/.aaSwapfile1                                   none    swap    sw              0 0" >> /etc/fstab
echo "[`date`] Result..."
cat /etc/fstab
read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo

echo "[`date`] Making some directories..."
mkdir -p /DATA/cd-images
mkdir -p /DATA/backup
mkdir -p /DATA/logs_var
mkdir -p /app/atlassian
mkdir -p /app/splunk

echo "[`date`] Copying some profile and scripts..."
scp nmon.io:~/.bash* ~/
scp nmon.io:~/myfirewall.sh ~/

#echo "203.178.137.175                         ftp.nara.wide.ad.jp" >> /etc/hosts
#echo "202.232.140.170                         ftp.iij.ad.jp" >> /etc/hosts
echo "nameserver 8.8.8.8" >> /etc/resolv.conf
echo "nameserver 8.8.4.4" >> /etc/resolv.conf

echo "[`date`] Installing base RPMs..."
yum install -y deltarpm
yum install -y bind-utils
yum install -y iptables-services

echo "[`date`] Installing gcc, git, lsof..."
yum install -y gcc python curl libcurl unzip lsof
yum install -y gcc-c++ make

echo "[`date`] Installing Node.js, npm..."
curl -sL https://rpm.nodesource.com/setup | bash -
yum install -y nodejs
npm install winston
npm install forever

echo "[`date`] Configuring local firewall..."
#for CentOS 7
#systemctl stop firewalld
#systemctl mask firewalld
#systemctl enable iptables
#systemctl start iptables

read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo
~/myfirewall.sh > /dev/null &
echo "[`date`] Please set hostname using nmtui (CentOS 7) or vi /etc/sysconfig/network (CentOS 6)..."
read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo

# for CentOS 7
#nmtui
# for CentOS 6
vi /etc/sysconfig/network
echo "[`date`] Check host name: `hostname`"
echo "[`date`] Add configured hostname to /etc/hosts using vi"
vi /etc/hosts

echo "[`date`] Next step: installing RPMs"
read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo

echo "[`date`] Installing NFS utils..."
yum install -y rpcbind nfs-utils nfs-utils-lib
yum install -y nfs4-acl-tools

read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo
echo "[`date`] Starting NFS services"

#for centos 7
#systemctl enable rpcbind
#systemctl enable nfs-server
#systemctl enable nfs-lock
#systemctl enable nfs-idmap
#systemctl start rpcbind
#systemctl start nfs-server
#systemctl start nfs-lock
#systemctl start nfs-idmap

#for centos 6
chkconfig --level 35 rpcbind on
chkconfig --level 35 nfs on
/etc/rc.d/init.d/rpcbind start
/etc/rc.d/init.d/nfs start
/etc/rc.d/init.d/nfslock start

read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo
echo "[`date`] Installing httpd and httpd..."
yum install -y httpd

echo "[`date`] Installing Node.js and MongoDB..."
yum install -y gcc-c++ make
curl -sL https://rpm.nodesource.com/setup | bash -
yum install -y nodejs npm
cat > /etc/yum.repos.d/mongodb-org-3.0.repo << EOF
[mongodb-org-2.6]
name=MongoDB 2.6 Repository
baseurl=http://downloads-distro.mongodb.org/repo/redhat/os/x86_64/
gpgcheck=0
enabled=1
EOF
yum install -y mongodb-org

echo "[`date`] Installing ip-traf utils"
yum install -y ip-traf

echo "[`date`] Please change kernel counts"
read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo
vi /etc/yum.conf

echo "[`date`] Starting package updates"
yum update -y

echo "[`date`] System will reboot automatically in ten seconds... "
read -t 10 -p "[Hit ENTER or wait ten seconds] "; echo
init 6