nmon-agt
=========

Nmon.io Agent Component

Config
------------

* Edit nmon-agt.conf

        [agent]
        interval: 5
        repeatCycle: 86400
        nmonLogDir: logs
        serverUrl: http://localhost:6900/nmonlog
        log: logs/nmon-agt.log

        [watchdog]
        interval: 5
        retries: 10
        log: logs/nmon-agt.log



Run
------------

1. Start

        cd ./bin/
        ./start-nmon-agt.sh

2. Stop

        cd ./bin/
        ./stop-nmon-agt.sh

