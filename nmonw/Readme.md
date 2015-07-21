NMONW
=========

NMON Web


Install
------------

[ubuntu]

1. node.js

	sudo apt-get install nodejs

2. npm 

	sudo apt-get install npm

3. mongodb

	sudo apt-get install mongodb

[redhat/oracle]

1. node.js

	curl -sL https://rpm.nodesource.com/setup | bash -
	yum install -y gcc-c++ make
	yum install -y nodejs
	
2. npm

3. mongodb

    cat > /etc/yum.repos.d/mongodb-org-3.0.repo << EOF
    [mongodb-org-2.6]
	name=MongoDB 2.6 Repository
	baseurl=http://downloads-distro.mongodb.org/repo/redhat/os/x86_64/
	gpgcheck=0
	enabled=1
	EOF
	yum install -y mongodb-org

4. node modules

	4.1 mondodb

		npm install mongodb --mongodb:native

	4.2 mongojs

		npm install mongojs

	4.3 winston

		npm install winston

	4.4 csv-streamify

		npm install csv-streamify

	4.5 JSONStream

		npm install JSONStream

	4.6 swig

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