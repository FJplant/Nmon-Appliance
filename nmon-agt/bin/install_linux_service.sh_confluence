#!/bin/bash

. `dirname $0`/user.sh #readin the username

conf_account=

if [ -z "$CONF_USER" ]; then
        conf_account="confluence"
else
        conf_account=$CONF_USER
fi

if [[ $1 == "-u" ]]; then
    echo uninstalling Confluence as a service
    if [[ -x $(which update-rc.d) ]]; then
        update-rc.d -f $conf_account remove
        rm -f /etc/init.d/$conf_account
    else
        rm -f /etc/init.d/$conf_account /etc/rc1.d/{S,K}95$conf_account
        for (( i=1; i<=5; i++ )); do
            rm -f /etc/rc$i.d/{S,K}95$conf_account
        done
    fi
else

    if [[ -d /etc/init.d ]]; then
        echo installing Confluence as a service
        CONF_BIN=`dirname $0`
        cat >/etc/init.d/$conf_account <<EOF
#!/bin/bash

# Confluence Linux service controller script
cd "$CONF_BIN"

case "\$1" in
    start)
        ./start-confluence.sh
        ;;
    stop)
        ./stop-confluence.sh
        ;;
    restart)
        ./stop-confluence.sh
        ./start-confluence.sh
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart}"
        exit 1
        ;;
esac
EOF
        chmod +x /etc/init.d/$conf_account
        if [[ -x $(which update-rc.d) ]]; then
            update-rc.d -f $conf_account defaults
        else
            ln -s /etc/init.d/$conf_account /etc/rc1.d/K95$conf_account
            ln -s /etc/init.d/$conf_account /etc/rc2.d/K95$conf_account
            ln -s /etc/init.d/$conf_account /etc/rc3.d/S95$conf_account
            ln -s /etc/init.d/$conf_account /etc/rc4.d/K95$conf_account
            ln -s /etc/init.d/$conf_account /etc/rc5.d/S95$conf_account
        fi
    fi
fi
