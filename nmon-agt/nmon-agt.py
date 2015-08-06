import sys, time, requests

def readlog(f, interval):
    while True:
        try:
            line = f.readline()
            if not line:
                time.sleep(interval)
            else:
                yield line
        except KeyboardInterrupt:
            break;

def main():
    if len(sys.argv) != 4:
        print ""
        print "Usage: " + sys.argv[0] + " logfile interval url"
        print "example> python " + sys.argv[0] + " xxx_150731_1117.nmon 30 http://localhost:6900/nmonlog"
        print ""
    else:
        f = open(sys.argv[1])
        try:
            requests.post(sys.argv[3], data=readlog(f, float(sys.argv[2])))
        except requests.exceptions.RequestException as e:
            print "network error!"
        f.close()

if __name__ == "__main__":
    main()
