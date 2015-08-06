#!/bin/bash
iptables -P INPUT ACCEPT -v
iptables -F -v
iptables -A INPUT -i lo -j ACCEPT -v
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT -v
# SSH
echo --- ssh 22
iptables -A INPUT -p tcp --dport 22 -j ACCEPT -v

# SMTP
echo --- SMTP 25,465
iptables -A INPUT -p tcp --dport 25 -j ACCEPT -v
iptables -A INPUT -p tcp --dport 465 -j ACCEPT -v

# HTTP
echo --- http 80
iptables -A INPUT -p tcp --dport 80 -j ACCEPT -v

# POP3
echo --- POP3 110,995
iptables -A INPUT -p tcp --dport 995 -j ACCEPT -v

# IMAP
echo --- IMAP 143,993
iptables -A INPUT -p tcp --dport 993 -j ACCEPT -v

# Oracl 9521
echo --- orcl 9521
iptables -A INPUT -p tcp --dport 9521 -j ACCEPT -v

# Fisheye/Crucible 8060
echo --- fisheye crucible 8060
iptables -A INPUT -p tcp --dport 8060 -j ACCEPT -v

# Stash 7990
echo --- stash 7990
iptables -A INPUT -p tcp --dport 7990 -j ACCEPT -v

# Bamboo 8085
echo --- bamboo 8085
iptables -A INPUT -p tcp --dport 8085 -j ACCEPT -v

# Jira 8080
echo --- jira 8080
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT -v

# Confluence 8090
echo --- confluence 8090
iptables -A INPUT -p tcp --dport 8090 -j ACCEPT -v

# Crowd 8095
echo --- crowd 8095
iptables -A INPUT -p tcp --dport 8095 -j ACCEPT -v

# NMONDB 6900
echo --- NMONDB-junkoo 6900
iptables -A INPUT -p tcp --dport 6900 -j ACCEPT -v

# Ping ICMP
iptables -A INPUT -p icmp --icmp-type echo-request -j ACCEPT
iptables -A OUTPUT -p icmp --icmp-type echo-reply -j ACCEPT

# Oracle XE Listener
echo --- Oracle Listener 9521
iptables -A INPUT -p tcp --dport 9521 -j ACCEPT -v

# VNC server listener
echo --- VNC server listener 5901
iptables -A INPUT -p tcp --dport 5901 -j ACCEPT -v

# Splunk web listener
echo --- Splunk web listener 8001
iptables -A INPUT -p tcp --dport 8001 -j ACCEPT -v

# Drop all other inputs
iptables -P INPUT DROP -v
# drop forwarding(routing)
iptables -P FORWARD DROP -v
# enable all output
iptables -P OUTPUT ACCEPT -v

BLOCKDB="/root/ip.blocked"
IPS=$(grep -Ev "^#" $BLOCKDB)

for i in $IPS
do
  echo 'Block IP: ' $i
  iptables -A INPUT -s $i -j DROP -v
  iptables -A OUTPUT -d $i -j DROP -v
done

#
# Save settings
#
/sbin/service iptables save
#
# List rules
#
iptables -L -v