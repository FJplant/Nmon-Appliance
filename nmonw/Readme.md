NMONW
=========

NMON Web


Install
------------

[git]

1. refer to

        https://oracle-base.com/articles/linux/git-2-installation-on-linux
        
2. Clone master branch

        git clone user@git-server:project_name.git -b branch_name /some/folder

3. git simple guide. no deep shit!

        http://rogerdudler.github.io/git-guide/
        
[ubuntu]

1. node.js

        sudo apt-get install nodejs

2. npm 

        sudo apt-get install npm

3. mongodb

        sudo apt-get install mongodb


[redhat/centos/oracle]

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

    4.1 mongojs (MongoDB API)

        npm install mongojs
        추가로 최신버전으로 업데이트 필요 (2015.07.28)

    4.2 winston (Log System)

        npm install winston

    4.3 csv-streamify (CSV Parser)

        npm install csv-streamify

    4.4 JSONStream (JSON Parser)

        npm install JSONStream

    4.5 swig (HTML Template)

        npm install swig

    4.6 forever (Daemon Tool)

        npm install forever


5. create folders
    
        mkdir logs 

Run
---

1. Run

        node nmonw.js

2. Bulk data upload

        ./client.sh nmonlog upload data/data.txt

3. Agent (reporting nmon log)

        ./agent.sh 30

3. Browsing

        http://localhost:8080



MongoDB HowTo
=============


Dump & Restore Database
-----------------------

* dump

        mongodump -d [db] -o [dir]


* restore

        mongorestore [dir]


Export & Import Data
--------------------

* export

        mongoexport -d [db] -c [collection] -o [file]

* import

        mongoimport -d [db] -c [collection [file]]

Indexing
--------

        db.XXX.ensureIndex({datetime: 1, host: 1}, {unique: true});


