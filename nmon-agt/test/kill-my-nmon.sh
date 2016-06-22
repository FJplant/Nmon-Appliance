#/bin/sh
echo "[`date`] Killing all of my nmon processes..."
echo "[`date`] nmon process lists..."
ps -f | grep nmon | grep -v "grep"

NMON_PID=

find_nmon_pid() {
  NMON_PID=`ps -f | grep nmon | grep -v 'grep' | tail -n 1 | awk '{print $2}'`
}

find_nmon_pid

while [ ! -z $NMON_PID ]; do
  echo "Killing nmon pid: $NMON_PID"
  kill -9 $NMON_PID
  find_nmon_pid
done
echo "[`date`] All of my nmon processes have been killed..."
