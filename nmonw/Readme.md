NMONW
=========

NMON Web


Install
------------

1. node.js

	sudo apt-get install nodejs

2. npm 

	sudo apt-get install npm

3. mongodb

	sudo apt-get install mongodb

3. node modules

	3.1 mondodb

		npm install mongodb --mongodb:native

	3.2 mongojs

		npm install mongojs

	3.3 winston

		npm install winston

	3.4 csv-streamify

		npm install csv-streamify

	3.5 JSONStream

		npm install JSONStream

	3.6 swig

		npm install swig

5. create folders
	
	mkdir logs 

Run
---

1. Run

	node nmonw.js

2. Upload data

	./client.sh nmonlog upload data/data.txt

3. Browsing

	http://localhost:8080