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
    bodyParser = require('body-parser'),
    csv = require('csv-streamify'),
    Readable = require('stream').Readable,
    Transform = require('stream').Transform;

var nmdb = require('../config/nmdb-config.js');
var NmonParser = require('./nmon-parser.js');

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
 * Initialize mongodb connection
 */
var  mongodb = mongojs(nmdb.env.NMDB_NMONDB_URL);
mongodb.on('error', function(err) {
    log.info('Nmon-db database error.', err);
});

mongodb.on('ready', function() {
    log.info('Nmon-db database connected.');
});

var nmondbMETA = mongodb.collection('nmon-meta'),
    nmondbZZZZ = mongodb.collection('nmon-perf'),
    nmondbUARG = mongodb.collection('nmon-uarg'),
    nmondbCategories = mongodb.collection('nmon-categories');

// expose this function to our app using module.exports
module.exports = function(app, passport) {
    // TODO: move following index section to other place where has configure function
    nmondbCategories.ensureIndex({name: 1}, {unique: true, background: true});
    nmondbCategories.save({name: 'DISK_ALL'});
    nmondbCategories.save({name: 'NET_ALL'});

    nmondbMETA.ensureIndex({'host': 1, 'date': 1});
    nmondbUARG.ensureIndex({'nmon-data-id': 1, Command: 1, PID: 1});
    nmondbZZZZ.ensureIndex({host: 1, datetime: 1}, {unique: true, background: true});

    // create reserved index on (datetime) to assure performance and non-skewed index db.
    // 2016.5.18. ymk
    nmondbZZZZ.ensureIndex({datetime: -1, host: 1}, {unique: true, background: true});

    // Add dynamic local handlers
    app.use(bodyParser.urlencoded({
        extended: true,
        limit: '200m'
    }));

    app.use(bodyParser.raw({
        extended: true,
        limit: '200m',
        type: 'application/octet-stream'
    }));

    app.use(bodyParser.json({
    }));

    // Add PUT methods for nmon-agent
    app.post('/nmonlog', function(req, res) {
        //console.log('Host name: ' + req.hostname);
        //console.log('Remote IP: ' + req.ip);
        //console.log('Request method: ' + req.method);
        //console.log('Request path: ' + req.path);
        //console.log('Requested base URL: ' + req.baseUrl);
        //console.log('Requested body: ' + JSON.stringify(req.body));

        log.info('[Process %d:/nmonlog] ' 
               + req.connection.remoteAddress 
               + ' ==> '
               + req.url, process.pid);
        put_nmonlog(req, res, 1);
    });

    app.post('/nmonlog_bulk', function(req, res) {
        //console.log('Host name: ' + req.hostname);
        //console.log('Remote IP: ' + req.ip);
        //console.log('Request method: ' + req.method);
        //console.log('Request path: ' + req.path);
        //console.log('Requested base URL: ' + req.baseUrl);
        //console.log('Requested body: ' + JSON.stringify(req.body));

        if(!req.body || req.body.length === 0) {
            console.log('request body not found');
            return res.sendStatus(400);
        }

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
 *   - processing by http request chaining
 *       order: request -> parser -> writer
 *   - parse nmon log
 *   - store parsed nmon data to mongodb
 *
 */
function put_nmonlog(req, res, bulk_unit) {
    var csvToJson = csv({objectMode: true});

    // Intanciate nmon parser
    var nmonParser = new NmonParser({
        objectMode: true,
        bulkUnit: bulk_unit,
        logfile: nmdb.env.NMREP_PARSER_LOG_FILE,
        loglevel: nmdb.env.NMREP_PARSER_LOG_LEVEL,
        logfileZZZZ: nmdb.env.NMREP_PARSER_ZZZZ_LOG_FILE,
        loglevelZZZZ: nmdb.env.NMREP_PARSER_ZZZZ_LOG_FILE
    });

    //  set response timeout to 0 
    res.connection.setTimeout(0);

    // processing nmon log upload by http request chaining 
    // in order of request -> parser -> writer
    nmonParser.on('finish', function() {
        nmonParser._flushSave();
        log.info('Parsing and storing of nmon data file finished.');
        // send HTTP 200 OK
        res.writeHead(200);
        res.end();
    });

    var debug = new Transform( {
        objectMode: true
    });

    debug._transform = function(chunk, encoding, callback) {
        // Transform the chunk into something else.
        const data = JSON.stringify(chunk);
        
        console.log(data);
        callback()
    }

    // TODO: merge two processing method
    //       Now, due to bug NMIO-183
    if ( bulk_unit > 1 ) {
        var nmonStream = new Readable();
        nmonStream.push(req.body['nmonlog']);
        nmonStream.push(null);

        nmonStream.pipe(csvToJson).pipe(nmonParser);
        // Following is debug purpose. 
        // nmonStream.pipe(csvToJson).pipe(debug).pipe(nmonParser);
    } else {
        req.pipe(csvToJson).pipe(nmonParser);
    }
}
