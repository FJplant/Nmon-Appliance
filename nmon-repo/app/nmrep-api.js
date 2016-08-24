/*
 * nmrep-api.js is
 *    an nmon repository api component written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 * 
 *      since Aug 12, 2015
 * (c)2015,2016 All rights reserved to Junkoo Hea, Youngmo Kwon.
 */

var fs = require('fs'),
    util = require('util'),
    winston = require('winston'),
    mongojs = require('mongojs'),
    Transform = require('stream').Transform,
    csv = require('csv-streamify');

var nmdb = require('../config/nmdb-config.js');

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
 * Initialize winston logger
 */
var log = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({
            filename: nmdb.env.NMREP_LOG_FILE,
            level: nmdb.env.NMREP_LOG_LEVEL
        }),
    ]
});

/*
 * Initilize parser log
 *    flags: 'a' - append mode
 */
var loggerParser =  fs.createWriteStream( nmdb.env.NMREP_PARSER_LOG_FILE, { flags: 'a' } );
var loggerParserZZZZ =  fs.createWriteStream( nmdb.env.NMREP_PARSER_ZZZZ_LOG_FILE, { flags: 'a' } );

/*
 * Initialize mongodb connection
 */
var  mongodb = mongojs(nmdb.env.NMDB_NMONDB_URL);
mongodb.on('error', function(err) {
    log.info('Nmon-db database error.', err);
});

mongodb.on('ready', function() {
    log.info('Nmon-db database connected.');
});

var nmondbZZZZ = mongodb.collection('nmon-zzzz'),
    nmondbUARG = mongodb.collection('nmon-uarg'),
    nmondbCategories = mongodb.collection('nmon-categories');

/*
 * Put nmonlog 
 *
 *   - processing by http request chaining
 *       order: request -> parser -> writer
 *   - parse nmon log
 *   - store parsed nmon data to mongodb
 *
 */
function put_nmonlog(req, res, bulk_unit) {
    nmondbCategories.ensureIndex({name: 1}, {unique: true, background: true});
    nmondbCategories.save({name: 'DISK_ALL'});
    nmondbCategories.save({name: 'NET_ALL'});

    nmondbUARG.ensureIndex({'nmon-data-id': 1, Command: 1, PID: 1});
    nmondbZZZZ.ensureIndex({host: 1, datetime: 1}, {unique: true, background: true});

    // create reserved index on (datetime) to assure performance and non-skewed index db.
    // 2016.5.18. ymk
    nmondbZZZZ.ensureIndex({datetime: -1, host: 1}, {unique: true, background: true});
     
    var csvToJson = csv({objectMode: true});

    var parser = new Transform({objectMode: true});
    parser.header = null;
    parser._hostname = '* N/A *';
    parser._nmondataid = null;
    parser._document = {};
    parser._rawHeader = {};
    parser._cnt = 0;
    parser._diskTotal = {};
    parser._cntTU = 0;

    parser._transform = function(data, encoding, done) {
        var now = new Date();

        if( data[0].substring(0, 3) === 'AAA' ) {
            // Process lines which starts with 'AAA'
            //   'AAA' section is system generic information
            loggerParser.write('\n\033[1;34m[' + now.toLocaleTimeString() + ']-');
            loggerParser.write('['+ parser._hostname + ':AAA]\033[m ' + data[1] + ',' + data[2] );
            
            // TODO: change nmondataid generation policy
            if (data[1] === 'command')
                parser._nmondataid = data[2]

            if (data[1] === 'host') {
                parser._hostname = data[2];
                // add host prefix to _nmondataid
                parser._nmondataid = data[2] + ':' + parser._nmondataid;
            }

        }
        else if( data[0].substring(0, 3) === 'BBB' ) {
            // Process lines which starts with 'BBB'
            //   'BBBB' and 'BBBC' line has system component configurations
            //   'BBBV' line has volume configurations
            //   'BBBN' line has network configurations
            //   'BBBD' line has Disk Adapter Information
            //   'BBBP' line has result of system command like lsconf, lsps, lparstat, emstat, no,
            //          mpstat, vmo, ioo and so on.
            loggerParser.write('\n\033[1;34m[' + now.toLocaleTimeString() + ']-');
            loggerParser.write('['+ parser._hostname + ':' + data[0] + ':' + data[1] + ']\033[m ' + data[2] + ',' + data[3]);

            // TODO: write all BBBP contents 
        }
        else if (data[0].substring(0, 4) === 'ZZZZ' ) {
            // Process lines which starts with 'ZZZZ'
            //   'ZZZZ' section is a leading line for iterations of current resource utilization
            parser._flushSave(); // call flushSave when new 'ZZZZ' has arrived
                                 // this can be a blocker not sending current data until getting next ZZZZ

            loggerParser.write('\n\033[1;34m[' + now.toLocaleTimeString() + ']-');
            loggerParser.write('['+ parser._hostname + ':ZZZZ:' + data[1] + ']\033[m ');

            if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' ) {
                loggerParserZZZZ.write('\n\n==========================================================\n');
                loggerParserZZZZ.write('---- Processing new ZZZZ section\n');
                loggerParserZZZZ.write('---- ' + data[0] + ',' + data[1] + ',' + data[2] + ',' + data[3] + '\n');
                loggerParserZZZZ.write('==========================================================');
            }

            // Initialize new document for mongodb
            parser._document = {};
            parser._document['nmon-data-id'] = parser._nmondataid;
            parser._document['host'] = parser._hostname;
            parser._document['snapframe'] = data[1]; // store T0001 ~ Txxxx
            parser._document['snapdate'] = data[3];  // store 24-AUG-2016 ( consider locale )
            parser._document['snaptime'] = data[2];  // store 15:49:13

            //    data[2] - Time, 15:44:04
            //    data[3] - Date, 24-AUG-2046
            var snapDateTime = data[2] + ' ' + (typeof data[3] == "undefined" ? '1-JAN-1970' : data[3]);
            // TODO: 1. support time zone manipulation
            parser._document['datetime'] = (new Date(snapDateTime)).getTime();
            parser._document['DISK_ALL'] = {};
            parser._document['NET_ALL'] = {};
            parser._document['TOP'] = []; // store in array
            
            parser._cntTU = 0;
        }
        else if (data[0] === 'UARG' && data[1] != '+Time') {
            // UARG only apear once when TOP meets a new process or already running process.
            // So, just write UARG to db whenever meet.

            // TODO: add UARG 
            var docUARG = {};

            docUARG['nmon-data-id'] = parser._nmondataid;	// nmondataid to compare and search
            docUARG['host'] = parser._hostname; // redundant but will be convenient 
            docUARG['snapframe'] = data[1];     // store T0001 ~ Txxxx
            docUARG['snapdate'] = parser._document['snapdate'];  // add redundant snapdate
            docUARG['snaptime'] = parser._document['snaptime'];  // add redundant snaptime
            docUARG['datetime'] = parser._document['datetime'];  // add redundant datetime

            docUARG['PID'] = parseInt(data[2]); // store process ID
            docUARG['Comand'] = data[3];        // store Command
            docUARG['FullCommand'] = data[4];   // store FullCommand 

            // just write to mongodb without bulk operation
            nmondbUARG.insert(docUARG);

            // write parser log
            loggerParser.write('U');
            if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' ) {
                loggerParserZZZZ.write('\n' + data[0] + ',' + data[1] + ',' + data[2] + ',' + data[3] + ',' + data[4]);
            }
            parser._cntTU++;
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
                var fields = {}; // fields container
                var logtype = '';

                // Log type
                switch (data[0]) {
                    case 'CPU_ALL': logtype = 'C'; break;
                    case 'MEM': logtype = 'M'; break;
                    case 'NET': logtype = 'N'; break;
                    case 'DISKREAD': logtype = 'R'; break;
                    case 'DISKWRITE': logtype = 'W'; break;
                    case 'DISKXFER': logtype = 'w'; break;
                    case 'TOP': 
                        logtype = 'T';
                        parser._cntTU++;
                        break;
                    default: logtype = '?'; break;
                };

                loggerParser.write(logtype);
                if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' )
                    loggerParserZZZZ.write('\n' + data[0] + ',' + data[1] + ',');

                // line break for parser log 
                if ((h[0] === 'TOP' || h[0] === 'UARG') && parser._cntTU % 80 == 0) {
                    loggerParser.write('\n\033[1;34m[' + now.toLocaleTimeString() + ']-');
                    loggerParser.write('['+ parser._hostname + ':ZZZZ:' + 
                                       ((h[0] === 'TOP')? data[2] : data[1]) + ']\033[m ');
                }

                // In case of Top, Add process ID
                if (h[0] === 'TOP')
                    fields['PID'] = parseInt(data[1]);

                // Iterate all columns
                for( var i = 2; i < h.length; i++ ) {
                    if(h[i] !== '') {
                        if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' ) {
                            loggerParserZZZZ.write(data[i]);

                            if (i < h.length-1) loggerParserZZZZ.write(',');
                        }

                        if (h[0] === 'CPU_ALL') {
                            if (h[i] === 'User%')
                                fields['User'] = parseFloat(data[i]);
                            else if (h[i] === 'Sys%')
                                fields['Sys'] = parseFloat(data[i]);
                            else if (h[i] === 'Wait%')
                                fields['Wait'] = parseFloat(data[i]);
                            else if (h[i] === 'CPUs' || h[i] === 'PhysicalCPUs')
                                fields['CPUs'] = parseFloat(data[i]);
                        }
                        else if (h[0] === 'MEM') {
                            if (h[i] === 'memtotal' || h[i] === 'Real total(MB)')
                                fields['Real total'] = parseFloat(data[i]);
                            else if (h[i] === 'memfree' || h[i] === 'Real free(MB)')
                                fields['Real free'] = parseFloat(data[i]);
                            else if (h[i] === 'swaptotal' || h[i] === 'Virtual total(MB)')
                                fields['Virtual total'] = parseFloat(data[i]);
                            else if (h[i] === 'swapfree' || h[i] === 'Virtual free(MB)')
                                fields['Virtual free'] = parseFloat(data[i]);
                        }
                        else if (h[0] === 'NET') {
                            if( h[i].indexOf('read') != -1 )
                                read += parseFloat(data[i]);
                            else if( h[i].indexOf('write') != -1)
                                write += parseFloat(data[i]);

                        }
                        else if ((h[0].indexOf("DISKREAD")== 0 || h[0].indexOf("DISKWRITE")== 0) && h[i].match(/.+\d+$/)) {
                            val += parseFloat(data[i]);
                        }
                        else if (h[0].indexOf("DISKXFER")== 0 && h[i].match(/.+\d+$/)) {
                            iops += parseFloat(data[i]);
                        }
                        else if (h[0] === 'TOP') {
                            // skip T0001 - T0001 has total time after boot
                            // TODO: process T0001 snap frame
                            if (data[2] !== 'T0001') {
                                if (h[0] === 'TOP') {
                                    switch ( h[i] ) {
                                        case 'Command': 
                                            fields[h[i]] = data[i]; 
                                            break;
                                        case '%CPU':
                                        case '%Usr':
                                        case '%Sys':
                                            fields[h[i]] = parseFloat(data[i]);
                                            break;
                                        case 'Size':
                                        case 'ResSet':
                                        case 'ResText':
                                        case 'ResData':
                                        case 'ShdLib':
                                        case 'MinorFault':
                                        case 'MajorFault':
                                            fields[h[i]] = parseInt(data[i]);
                                            break;
                                    }
                                }
                            }
                        }
                    } // end of if
                } // end of for

                if (Object.keys(fields).length !== 0) {
                    if (h[0] === 'TOP')
                        parser._document[h[0]].push(fields);
                    else
                        parser._document[h[0]] = fields;
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
            this.push(['nmon-zzzz', parser._document]);
            parser._cnt++;
            //loggerParser.stdout.write('f');
            if (parser._cnt % 80 == 0)
                loggerParser.write('\n');
        }
    }

    // Write html response
    // 
    var writer = new Transform({objectMode: true});
    writer._bulk = [];
    writer._header = [];
    writer._headerWrited = false;
    writer._transform = function(data, encoding, done) {
        //process.stdout.write('t');
        if( data[0] === 'categories' ) {
            writer._header.push(data[1]);
            done();
        }
        else {
            // Check whether header was written, 
            // otherwise write header and set _headerWrite to true
            if (!writer._headerWrited) {
                writer._headerWrited = true;
                var bulkop = nmondbCategories.initializeOrderedBulkOp();
                for(var i = 0; i < writer._header.length; i++)
                    bulkop.find(writer._header[i]).upsert().update({ $set: writer._header[i]});

                bulkop.execute(function(err, res) {
                    if (err)
                        log.error(err.toString());
                    writer._header = [];
                });
            }
            writer._bulk.push(data[1]);

            // flush writer if there is more data than bulk unit
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
        // store remained nmon data to mongo db
        if( writer._bulk.length > 0 ) {
            var bulkop = nmondbZZZZ.initializeOrderedBulkOp();
            for(var i = 0; i < writer._bulk.length; i++) {
                bulkop.insert(writer._bulk[i]);
            }

            bulkop.execute(function(err, res) {
                if (err)
                    log.error(err.toString());

                writer._bulk = [];	// clear _bulk buffer

                if (done) {
                    done();    
                }
            });
        }
        else { // if there is no data remained
            if(done) {
                done();
            }
        }
    }

    writer.on('finish', function() {
        writer._flushSave();
        //process.stdout.write('\n');
        // send HTTP 200 OK
        res.writeHead(200);
        res.end();
    });
   
    res.connection.setTimeout(0);

    // processing nmon log upload by http request chaining 
    // in order of request -> parser -> writer
    req.pipe(csvToJson).pipe(parser).pipe(writer);
}
