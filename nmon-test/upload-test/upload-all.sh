#!/bin/bash
echo "Running worker 1... "
nohup ./upload-worker1.sh > ../logs/upload-worker1.log &
echo "To read logs: tail -f ../logs/upload-worker1.log"

echo "Running worker 2... "
nohup ./upload-worker2.sh > ../logs/upload-worker2.log &
echo "To read logs: tail -f ../logs/upload-worker2.log"
