#!/bin/bash

. `dirname $0`/user.sh #readin the username

nmagt_account=

if [ -z "$NMAGT_USER" ]; then
        nmagt_account="nmagt"
else
        nmagt_account=$NMAGT_USER
fi

if [[ $1 == "-u" ]]; then
    echo uninstalling Nmon-agent as a service
    if [[ -x $(which update-rc.d) ]]; then
        update-rc.d -f $nmagt_account remove
        rm -f /etc/init.d/$nmagt_account
    else
        rm -f /etc/init.d/$nmagt_account /etc/rc1.d/{S,K}95$nmagt_account
        for (( i=1; i<=5; i++ )); do
            rm -f /etc/rc$i.d/{S,K}95$nmagt_account
        done
    fi
else

    if [[ -d /etc/init.d ]]; then
        echo installing Nmon-agent as a service
        NMAGT_BIN=`dirname $0`
        cat >/etc/init.d/$nmagt_account <<EOF
#!/bin/bash

# Nmon-agent Linux service controller script
cd "$NMAGT_BIN"

case "\$1" in
    start)
        ./start-nmagt.sh
        ;;
    stop)
        ./stop-nmagt.sh
        ;;
    restart)
        ./stop-nmagt.sh
        ./start-nmagt.sh
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart}"
        exit 1
        ;;
esac
EOF
        chmod +x /etc/init.d/$nmagt_account
        if [[ -x $(which update-rc.d) ]]; then
            update-rc.d -f $nmagt_account defaults
        else
            ln -s /etc/init.d/$nmagt_account /etc/rc1.d/K95$nmagt_account
            ln -s /etc/init.d/$nmagt_account /etc/rc2.d/K95$nmagt_account
            ln -s /etc/init.d/$nmagt_account /etc/rc3.d/S95$nmagt_account
            ln -s /etc/init.d/$nmagt_account /etc/rc4.d/K95$nmagt_account
            ln -s /etc/init.d/$nmagt_account /etc/rc5.d/S95$nmagt_account
        fi
    fi
fi
