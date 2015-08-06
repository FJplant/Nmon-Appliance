#!/bin/bash
ssh www.fjplant.com << EOF
export PATH=$PATH:/sbin
ifconfig
date
time
sqlplus / as sysdba << EOSP
select sysdate from dual;
select instance_name from v\\\$instance;
-- cuz redirected twice, back-slash inserted twice
quit
EOSP
EOF