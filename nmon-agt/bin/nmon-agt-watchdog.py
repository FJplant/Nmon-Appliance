#
# nmon-agt-watchdog.py is
#   an elastic nmon-agt component written in Python
#   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
#
#      since Aug 12, 2015
# (c) All rights reserved to Junkoo Hea.
#

import sys, subprocess, time, ConfigParser, logging
from optparse import OptionParser

def main():
    parser = OptionParser()
    parser.add_option("-c", "--configfile", dest="configfile", 
        help="The file specified contains the configuration details required by nmon-agt", 
        metavar="<configuration file>")

    (options, args) = parser.parse_args()
    if options.configfile == None:
        parser.print_help()
    else:
        try:
            conf = ConfigParser.ConfigParser()
            conf.read(options.configfile)
            interval = conf.getint("watchdog", "interval");
            retries = conf.getint("watchdog", "retries")
            logfile = conf.get('watchdog', 'log')
        except:
            interval = 5
            retries = 10
            logfile = 'nmon-agt.log'

        logging.basicConfig(filename=logfile,level=logging.INFO,format='[%(asctime)s|%(levelname)s|%(filename)s:%(lineno)s] %(message)s')
        logging.info('start watchdog')
        
        count = 0
        while True:
            try:
                ps = subprocess.Popen(['ps', 'aux'], stdout=subprocess.PIPE)
                grep = subprocess.Popen(['grep', '[n]mon-agt.py'], stdin=ps.stdout, stdout=subprocess.PIPE)
                head = subprocess.Popen(['head', '-n', '1'], stdin=grep.stdout, stdout=subprocess.PIPE)
                output = subprocess.Popen(['awk', '{print $2}'], stdin=head.stdout, stdout=subprocess.PIPE).communicate()[0]
                ps.wait()
                pid = int(output)
                count = 0
            except:
                logging.info('run nmon agent again!')
                subprocess.Popen(['python', 'nmon-agt.py', '-c', options.configfile])
                count = count + 1
                if count >= retries:
                    logging.error('exit watchdog because of continuous failures!')
                    sys.exit()
            time.sleep(interval)

if __name__ == "__main__":
    main()
