import time
import random
import json
import datetime
from tornado import websocket, web, ioloop
from datetime import timedelta
from random import randint

processTypes = ["user", "kernel"]
processesArray = ['oracle', 'node', 'java', 'python']
serversArray = ['nmon-tokyo', 'nmon-base', 'nmrep-dev', 'bexsvr']

class WebSocketHandler(websocket.WebSocketHandler):
  #on open of this socket
  def open(self):
    print 'Connection established.'
    #ioloop to wait for 3 seconds before starting to send data
    ioloop.IOLoop.instance().add_timeout(datetime.       
    timedelta(seconds=3), self.send_data)
 
  #close connection
  def on_close(self):
    print 'Connection closed.'

  # Check origin server's validity
  def check_origin(self, origin):
    return True

  # Our function to send new (random) data for charts
  def send_data(self):
    # comment out - too noisy
    # print "Sending Data"
    #create a bunch of random data for various dimensions we want
    qty = random.randrange(1,4)
    total = random.randrange(30,1000)
    tip = random.randrange(10, 100)
    processType = processTypes[random.randrange(0,2)]
    process = processesArray[random.randrange(0,4)]
    cpu_usage = random.randrange(0,100);
    server = serversArray[random.randrange(0,4)]
    #create a new data point
    point_data = {
    	'quantity': qty,
    	'total' : total,
    	'tip': tip,
    	'processType': processType,
    	'process': process,
    	'cpu_usage': cpu_usage,
    	'server' : server,
    	'x': time.time()
    }

    print point_data
  
    #write the json object to the socket
    self.write_message(json.dumps(point_data))
    
    #create new ioloop instance to intermittently publish data
    ioloop.IOLoop.instance().add_timeout(datetime.timedelta(seconds=1), self.send_data)

if __name__ == "__main__":
  #create new web app w/ websocket endpoint available at /websocket
  print "Starting websocket server program. Awaiting client requests to open websocket ..."
  application = web.Application([(r'/websocket', WebSocketHandler)])
  application.listen(8001)
  ioloop.IOLoop.instance().start()
