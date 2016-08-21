/*
 * nmrep-api.js is
 *    an nmon repository api component written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 * 
 *      since Aug 12, 2015
 * (c)2015,2016 All rights reserved to Junkoo Hea, Youngmo Kwon.
 */

var winston = require('winston'),
    mongojs = require('mongojs'),
    Transform = require('stream').Transform,
    csv = require('csv-streamify');

/*
 * Initialize winston logger
 */
var log = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({ filename: 'logs/nmrep-api.log', level: 'debug' }),
    ]
});

/*
 * Initialize mongodb connection
 */
var  mongodb = mongojs('mongodb.fjint.com/nmon-db', ['performance']);
mongodb.on('error', function(err) {
    log.info('Nmon-db database error.', err);
});

mongodb.on('ready', function() {
    log.info('Nmon-db database connected.');
});

// expose this function to our app using module.exports
module.exports = function(app, passport) {

    // Add dynamic local handlers
    // Add PUT methods for nmon-agent
    app.post('/nmonlog', function(req, res) {
        log.info('[Process %d:/nmonlog] ' 
               + req.connection.remoteAddress 
               + ' ==> '
               + req.url, process.pid);
        put_nmonlog(req, res, 1);
    });

    app.post('/nmonlog_bulk', function(req, res) {
         log.info('[Process %d:/nmonlog_bulk] ' 
               + req.connection.remoteAddress 
               + ' ==> '
               + req.url, process.pid);
         put_nmonlog(req, res, 10);
    });
}

/*
 * Put nmonlog 
 *
 * 1. parse nmon log
 * 2. store parsed nmon data to mongodb
 */
function put_nmonlog(req, res, bulk_unit) {
    mongodb.collection('categories').ensureIndex({name: 1}, {unique: true, background: true});
    mongodb.collection('categories').save({name: 'DISK_ALL'});
    mongodb.collection('categories').save({name: 'NET_ALL'});
    mongodb.collection('performance').ensureIndex({host: 1, datetime: 1}, {unique: true, background: true});

    // create reserved index on (datetime) to assure performance and non-skewed index db.
    // 2016.5.18. ymk
    mongodb.collection('performance').ensureIndex({datetime: -1, host: 1}, {unique: true, background: true});
     
    var csvToJson = csv({objectMode: true});

    var parser = new Transform({objectMode: true});
    parser.header = null;
    parser._hostname = '* N/A *';
    parser._document = {};
    parser._rawHeader = {};
    parser._cnt = 0;
    parser._diskTotal = {};

    parser._transform = function(data, encoding, done) {
        if( data[0].substring(0, 3) === 'AAA' ) {
            // Process lines which starts with 'AAA'
            //   'AAA' section is system generic information
            process.stdout.write('\n\033[1;34m[' + (new Date()).toLocaleTimeString() + ']-');
            process.stdout.write('['+ parser._hostname + ':AAA]\033[m ' + data[1] + ',' + data[2] );
            if (data[1] === 'host')
                parser._hostname = data[2];
        }
        else if( data[0].substring(0, 3) === 'BBB' ) {
            // Process lines which starts with 'BBB'
            //   'BBBB' and 'BBBC' line has system component configurations
            //   'BBBV' line has volume configurations
            //   'BBBN' line has network configurations
            //   'BBBD' line has Disk Adapter Information
            //   'BBBP' line has result of system command like lsconf, lsps, lparstat, emstat, no,
            //          mpstat, vmo, ioo and so on.
            process.stdout.write('\n\033[1;34m[' + (new Date()).toLocaleTimeString() + ']-');
            process.stdout.write('['+ parser._hostname + ':' + data[0] + ':' + data[1] + ']\033[m ' + data[2] + ',' + data[3]);

            // TODO: write all BBBP contents 
        }
        else if (data[0].substring(0, 4) === 'ZZZZ' ) {
            // Process lines which starts with 'ZZZZ'
            //   'ZZZZ' section is a leading line for iterations of current resource utilization
            parser._flushSave(); // call flushSave when new 'ZZZZ' has arrived
                                 // this can be a blocker not sending current data until getting next ZZZZ

            // Initialize new document
            process.stdout.write('\n\033[1;34m[' + (new Date()).toLocaleTimeString() + ']-');
            process.stdout.write('['+ parser._hostname + ':ZZZZ:' + data[1] + ']\033[m ');

            parser._document = {};
            parser._document['host'] = parser._hostname;
            var ts = data[2] + ' ' + (typeof data[3] == "undefined" ? '1-JAN-1970' : data[3]);
            parser._document['datetime'] = (new Date(ts)).getTime();
            parser._document['DISK_ALL'] = {};
            parser._document['NET_ALL'] = {};
            parser._document['TOP'] = [];
        }
        else {
            // Processing lines wich not starts with 'AAA', 'BBBB', 'ZZZ'
            //   for AIX: 
            //     'CPU_ALL', 'CPUxx': 
            //     'MEM', 'MEMNEW', 'MEMUSE', 'PAGE', 'LARGEPAGE':
            //     'PROC','PROCAIO':
            //     'FILE':
            //     'NET', 'NETPACKET', 'NETSIZE', 'NETERROR':
            //     'DISKBUSY', 'DISKREAD', 'DISKWRITE', 'DISKXFER', 'DISKRXFER', 'DISKBSIZE':
            //     'IOADAPT':
            //     'JFSFILE': Journal file information
            //     'TOP':  process information
            //     'UARG': user process command parameter and informations
            if( data[0] in parser._rawHeader ) {
                var h = parser._rawHeader[data[0]];
                var val = 0.0, iops = 0.0, read = 0.0, write = 0.0;
                var query = {}; // data container
                for( var i = 2; i < h.length; i++ ) {
                    if(h[i] !== '') {
                        if (h[0] === 'CPU_ALL') {
                            process.stdout.write('C');

                            if (h[i] === 'User%')
                                query['User'] = parseFloat(data[i]);
                            else if (h[i] === 'Sys%')
                                query['Sys'] = parseFloat(data[i]);
                            else if (h[i] === 'Wait%')
                                query['Wait'] = parseFloat(data[i]);
                            else if (h[i] === 'CPUs' || h[i] === 'PhysicalCPUs')
                                query['CPUs'] = parseFloat(data[i])
                        }
                        else if (h[0] === 'MEM') {
                            process.stdout.write('M');

                            if (h[i] === 'memtotal' || h[i] === 'Real total(MB)')
                                query['Real total'] = parseFloat(data[i]);
                            else if (h[i] === 'memfree' || h[i] === 'Real free(MB)')
                                query['Real free'] = parseFloat(data[i]);
                            else if (h[i] === 'swaptotal' || h[i] === 'Virtual total(MB)')
                                query['Virtual total'] = parseFloat(data[i]);
                            else if (h[i] === 'swapfree' || h[i] === 'Virtual free(MB)')
                                query['Virtual free'] = parseFloat(data[i]);
                        }
                        else if (h[0] === 'NET') {
                            process.stdout.write('N');

                            if( h[i].indexOf('read') != -1 )
                                read += parseFloat(data[i]);
                            else if( h[i].indexOf('write') != -1)
                                write += parseFloat(data[i]);
                        }
                        else if ((h[0].indexOf("DISKREAD")== 0 || h[0].indexOf("DISKWRITE")== 0) && h[i].match(/.+\d+$/)) {
                            process.stdout.write('D');

                            val += parseFloat(data[i]);
                        }
                        else if (h[0].indexOf("DISKXFER")== 0 && h[i].match(/.+\d+$/)) {
                            process.stdout.write('X');

                            iops += parseFloat(data[i]);
                        }
                        else if (h[0] === 'TOP') {
                            //process.stdout.write('T');

                            if (data[2] !== 'T0001') {
                                if( h[0] === 'TOP' && h[i] === 'Command' ) {
                                    query[h[i]] = data[i];
                                }
                                else if( h[0] === 'TOP' && (h[i] === '%CPU' || h[i] === 'ResText' || h[i] === 'ResData') ) {
                                    query[h[i]] = parseFloat(data[i]);
                                }
                            }
                        }
                    }
                }

                if (Object.keys(query).length !== 0) {
                    if (h[0] === 'TOP')
                        parser._document[h[0]].push(query);
                    else
                        parser._document[h[0]] = query;
                }

                if( h[0] === 'DISKREAD' ) {
                    parser._document['DISK_ALL']['read'] = val;
                }
                else if (h[0] === 'DISKWRITE') {
                    parser._document['DISK_ALL']['write'] = val;
                }
                else if (h[0] === 'DISKXFER') {
                    parser._document['DISK_ALL']['iops'] = iops;
                }
                else if (h[0] === 'NET') {
                    parser._document['NET_ALL']['read'] = read;
                    parser._document['NET_ALL']['write'] = write;
                }
            }
            else {
                if (!(data[0] === 'TOP' && data.length <= 2)) {
                    this.push(['categories', {name :data[0]}]);
                    parser._rawHeader[data[0]] = data;
                }
            }
        }
        done();
    }

    parser._flush = function(done) {
        parser._flushSave();
        done();
    }

    parser._flushSave = function() {
        if (Object.keys(parser._document).length !== 0 ) {
            this.push(['performance', parser._document]);
            parser._cnt++;
            //process.stdout.write('f');
            if (parser._cnt % 80 == 0)
                process.stdout.write('\n');
        }
    }

    var writer = new Transform({objectMode: true});
    writer._bulk = [];
    writer._header = [];
    writer._headerWrited = false;
    writer._transform = function(data, encoding, done) {
        process.stdout.write('t');
        if( data[0] === 'categories' ) {
            writer._header.push(data[1]);
            done();
        }
        else {
            if (!writer._headerWrited) {
                writer._headerWrited = true;
                var bulkop = mongodb.collection('categories').initializeOrderedBulkOp();
                for(var i = 0; i < writer._header.length; i++)
                    bulkop.find(writer._header[i]).upsert().update({ $set: writer._header[i]});
                bulkop.execute(function(err, res) {
                    if (err)
                        log.error(err.toString());
                    writer._header = [];
                });
            }
            writer._bulk.push(data[1]);
            if ( writer._bulk.length >= bulk_unit ) {
                writer._flushSave(done);
            }
            else {
                done();
            }
        }
    };

    writer._flushSave = function(done) {
        //process.stdout.write('F');
        if( writer._bulk.length > 0 ) {
            var bulkop = mongodb.collection('performance').initializeOrderedBulkOp();
            for(var i = 0; i < writer._bulk.length; i++) {
                bulkop.insert(writer._bulk[i]);
            }
            bulkop.execute(function(err, res) {
                if (err)
                    log.error(err.toString());

                writer._bulk = [];

                if (done) {
                    done();    
                }
            });
        }
        else {
            if(done) {
                done();
            }
        }
    }

    writer.on('finish', function() {
        writer._flushSave();
        process.stdout.write('\n');
        res.writeHead(200);
        res.end();
    });
   
    res.connection.setTimeout(0);
    req.pipe(csvToJson).pipe(parser).pipe(writer);
}
