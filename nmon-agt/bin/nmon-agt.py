#
# nmon-agt.py is
#   an elastic nmon-agt component written in Python
#   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
#
#      since Aug 12, 2015
# (c) All rights reserved to Junkoo Hea.
#

import sys, os, subprocess, signal, errno, time, requests, ConfigParser, logging
from datetime import datetime
from optparse import OptionParser

pid = None

def sig_handler(signum = None, frame = None):
    if pid != None:
        logging.info('kill nmon (' + str(pid) + ')')
        try:
            os.killpg(pid, signal.SIGTERM)
        except:
            pass
    sys.exit()

def pid_exists(pid):
    if pid < 0:
        return False
    try:
        os.kill(pid, 0)
    except OSError as e:
        return e.errno == errno.EPERM
    else:
        return True

def readlog(f, interval, pid):
    while True:
        line = f.readline()
        if not line:
            if pid_exists(pid):
                time.sleep(interval)
            else:
                break;
        else:
            yield line

def run(configfile):
    logging.info('run again')
    # get conifg
    try:
        conf = ConfigParser.ConfigParser()
        conf.read(configfile)
        logfile = conf.get("agent", "nmonLogDir") + "/" + os.uname()[1] + datetime.now().strftime("_%Y%m%d_%H%M%S_%f.nmon");
        interval = conf.getint("agent", "interval");
        repeatCycle = conf.getint("agent", "repeatCycle")
        count = repeatCycle / interval
        url = conf.get("agent", "serverUrl")
        # -t only top process, -T include user args -N include NFS
        nmon_cmd = ["nmon", "-F", logfile, "-s", str(interval), "-c", str(count), "-N", "-T"]; 
    except ConfigParser.Error:
        logging.error('Check your config file!')
        print "Check your config file!"
        sys.exit()

    # run nmon
    try:
        process = subprocess.Popen(nmon_cmd)
    except (OSError, ValueError):
        logging.error('Install nmon!');
        print "Install nmon!"
        sys.exit()
    process.wait()

    # get the pid of nmon
    global pid
    try:
        ps = subprocess.Popen(['ps'], stdout=subprocess.PIPE)
        grep = subprocess.Popen(['grep', '[n]mon'], stdin=ps.stdout, stdout=subprocess.PIPE)
        head = subprocess.Popen(['tail', '-n', '1'], stdin=grep.stdout, stdout=subprocess.PIPE)
        output = subprocess.Popen(['awk', '{print $1}'], stdin=head.stdout, stdout=subprocess.PIPE).communicate()[0]
        ps.wait()
        pid = int(output)
    except:
        logging.error("can't get the pid of nmon")
        print "Can't get the pid of nmon"
        sys.exit()
        pid = None
    logging.info('nmon pid = ' + str(pid))

    # post log
    f = open(logfile)
    try:
        requests.post(url, data=readlog(f, interval, pid))
    except requests.exceptions.RequestException as e:
        logging.error("Network error!")
        print "Network error!"
        os.killpg(pid, signal.SIGTERM)
        sys.exit()
    f.close()   

def main():
    parser = OptionParser()
    parser.add_option("-c", "--configfile", dest="configfile", 
        help="The file specified contains the configuration details required by nmon-agt", 
        metavar="<configuration file>")
    parser.add_option("-w", "--watchdog",
                  action="store_true", dest="watchdog", default=False,
                  help="run with watchdog")

    (options, args) = parser.parse_args()
    if options.configfile == None:
        parser.print_help()
    else:
        try:
            conf = ConfigParser.ConfigParser()
            conf.read(options.configfile)
            logfile = conf.get('agent', 'log')
        except:
            logfile = 'nmon-agt.log'

        logging.basicConfig(filename=logfile,level=logging.INFO,format='[%(asctime)s|%(levelname)s|%(filename)s:%(lineno)s] %(message)s')

        for sig in [signal.SIGTERM, signal.SIGINT, signal.SIGHUP, signal.SIGQUIT]:
            signal.signal(sig, sig_handler)

        if options.watchdog:
            try:
                subprocess.Popen(['python', 'nmon-agt-watchdog.py', '-c', options.configfile])
            except (OSError, ValueError):
                pass
            logging.info('run watchdog')

        while True:
            run(options.configfile)

if __name__ == "__main__":
    main()
