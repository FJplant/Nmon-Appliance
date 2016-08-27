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
    Transform = require('stream').Transform;

var rawParser = bodyParser.raw({
        limit: '200m'
});

var nmdb = require('../config/nmdb-config.js');
var NmonParser = require('./nmon-parser.js');
var NmonWriter = require('./nmon-writer.js');

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

    app.post('/nmonlog_bulk', rawParser, function(req, res) {
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

    // Intanciate nmon parser
    var nmonParser = new NmonParser({
        objectMode: true,
        logfile: nmdb.env.NMREP_PARSER_LOG_FILE,
        loglevel: nmdb.env.NMREP_PARSER_LOG_LEVEL,
        logfileZZZZ: nmdb.env.NMREP_PARSER_ZZZZ_LOG_FILE,
        loglevelZZZZ: nmdb.env.NMREP_PARSER_ZZZZ_LOG_FILE
    });

    // Write html response
    // 
    var nmonWriter = new NmonWriter({
        objectMode: true,
        bulkUnit: bulk_unit 
    });

    res.connection.setTimeout(0);

    // processing nmon log upload by http request chaining 
    // in order of request -> parser -> writer
    nmonParser.on('finish', function() {
          log.info('Parsing nmon data file finished.');
    });

    nmonWriter.on('finish', function() {
        nmonWriter._flushSave();
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

    req.pipe(csvToJson).pipe(nmonParser).pipe(nmonWriter);
    // Following is debug purpose. it write captures the pipe between nmonParser and nmonWriter, and write all to console.
    //req.pipe(csvToJson).pipe(nmonParser).pipe(debug).pipe(nmonWriter);
}
