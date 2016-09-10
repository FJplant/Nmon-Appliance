/*
 * nmdb-api.js is
 *    an elastic nmon-db component written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 * 
 *      since Aug 12, 2015
 * (c)2015,2016 All rights reserved to Junkoo Hea, Youngmo Kwon.
 */
"use strict";
var url = require('url'),
    winston = require('winston'),
    mongojs = require('mongojs'),
    nmdb = require('../config/nmdb-config.js');

// expose this function to our app using module.exports
module.exports = function(app, passport) {
    // map GET methods to doGet for nmon-db
    app.get('/categories', doGet);
    app.get(nmdb.env.NMDB_API_PREFIX + '/server/list', doGet);
    app.get(nmdb.env.NMDB_API_PREFIX + '/server/stat/*', doGet);
    app.get(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/titles$/, doGet);
    app.get(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/, doGet);
}

/*
 * Initialize winston logger
 *
 */
var log = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({ 
            filename: nmdb.env.NMDB_LOG_FILE, 
            level: nmdb.env.NMDB_LOG_LEVEL }),
    ]
});

/*
 * Initialize mongodb connection
 *
 */
var  mongodb = mongojs(nmdb.env.NMDB_NMONDB_URL);

mongodb.on('error', function(err) {
    log.info('Nmon-db database error.', err);
});

mongodb.on('ready', function() {
    log.info('Nmon-db database connected.');
});

var nmondbZZZZ = mongodb.collection('nmon-perf'),
    nmondbUARG = mongodb.collection('nmon-uarg'),
    nmondbCategories = mongodb.collection('nmon-categories');

var graph_row_number = nmdb.env.NMDB_GRAPH_ROW_NUMBER;

/*
 * doGet funtion
 */
function doGet(req, res) {
    var url_info = url.parse(req.url, true);
    var pathname = url_info.pathname;
    var searchparam = url_info.search;
    var method = req.method;

    log.debug('Served by worker PID[%d]: %s', process.pid, (method + ' ' + pathname + searchparam) );

    try {
        if ( pathname == '/categories' ) {
            log.debug('Call get_categories with parameters: %s', searchparam);
            get_categories(req, res);

            return;
        }
        else if ( pathname.match(nmdb.env.NMDB_API_PREFIX + '/server/list') ) {
            log.debug('Call get_server_list with parameters: %s', searchparam);
            get_server_list(req, res);

            return;
        }
        else if ( pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/titles$/) ) {
            log.debug('Call get_titles with parameters: %s', searchparam);
            get_titles(req, res);

            return;
        }
        else if ( pathname.match(nmdb.env.NMDB_API_PREFIX + '/server/stat') ) {
            log.debug('Call get_host_fields with parameters: %s', searchparam);
            return get_host_fields(req, res);
        }
        else if ( pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/) ) {
            var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);

            if (m[2] === 'TOP' ) {
                    log.debug('Call get_top_fields with parameters: %s', searchparam);
                
                    return get_top_fields(req, res);
            } 
            else {
                log.debug('Call get_fields with parameters: %s', searchparam);

                return get_fields(req, res);
            }
        }
    }
    catch(e) {
        error_handler(res, e, 500);
    }
}

/*
 * Get categories
 *
 * TODO: change to restful API
 */
function get_categories(req, res) {
    var result = [];
    var categories = nmondbCategories;
    categories.find().sort({name:1}).forEach(function(err, doc) {
        if( err )
            return error_handler(res, err, 500);
        if( doc ) {
            result.push(doc['name']);
        }
        else {
            res.writeHead(200, {'Content-Type': 'text/json'});
            res.end(JSON.stringify(result));
        }
    });
}

/*
 * Get hosts
 *
 * TODO: change to restful API
 */
function get_server_list(req, res) {
    var url_info = url.parse(req.url, true);

    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/hosts$/);

    try {
        nmondbZZZZ.distinct('host', {}, function (err, doc) {
            if( err )
                return error_handler(res, err, 500);
            res.writeHead(200, {'Content-Type': 'text/json'});
            if( doc ) {
                res.end(JSON.stringify(doc));
            }
            else {
                res.end();
            }
        });
    }
    catch(e) {
        error_handler(res, e, 500);
    }
}

/*
 * Get titles
 *
 * TODO: change to restful API
 */
function get_titles(req, res) {
    var url_info = url.parse(req.url, true);

    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/titles$/);
    var query = { };
    if (m[1] !== 'All') {
        query['host'] = m[1];
    }
    var fields = { _id: 0 };
    fields[m[2]] = 1;

    nmondbZZZZ.findOne(query, fields, function (err, doc) {
        if( err )
            return error_handler(res, err, 500);
        var results = [];
        if( doc ) {
            for (key in doc[m[2]])
                if (key !== 'host' && key !== 'datetime' && key !== '_id')
                    results.push(key);
        }
        res.writeHead(200, {'Content-Type': 'text/json'});
        res.end(JSON.stringify(results))
    });
}

/*
 * Get fields
 * Nmon perf log fields
 *
 * TODO: change to restful API
 */
function get_fields(req, res) {
    var url_info = url.parse(req.url, true);
    // m holds parsed data from /<host-name>/<resource_type>/
    // ex) 
    //    ["/nmon-base/CPU_ALL","nmon-base","CPU_ALL"]
    //    ["/nmon-base/MEM","nmon-base","MEM"]
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);
    // At this time, results returns array of array staring with headers
    var results = [];
    var data = eval(url_info.query['data']);
    var date = eval(url_info.query['date']);
    
    date[0] = new Date( parseInt(date[0]));
    date[1] = new Date( parseInt(date[1]));
    var fields = {datetime:1, _id: 0};
    var average = ['Time'];
    for (var i = 0; i < data.length; i++) {
        fields[m[2] + '.' + data[i]] = 1;
        average.push(data[i]);
    }
    results.push(average);

    // build query...
    var query = {};
    if (m[1] !== 'All') {      // if host is not set to 'All', then limit to some host
        query['host'] = m[1];
    }
    if (typeof date !== 'undefined') {
        query['datetime'] = { $gt : date[0], $lt : date[1] };
    }

    nmondbZZZZ.count(query, function(err, doc) {
        if (err)
            return error_handler(res, err, 500);

        if (doc) {
            var granularity = Math.ceil(doc / graph_row_number);
            // to see granularity, uncomment 
            //console.log( 'doc: ' + doc + ', granul: ' + granularity);
            var cnt = 0;
            average = [0];
            for (var i = 0; i < data.length; i++) {
                average.push(0.0);
            }

            nmondbZZZZ.find(query, fields).sort({datetime:1}).forEach(function(err, doc) {
                if( err )
                    return error_handler(res, err, 500);

                if( doc ) {
                    cnt++;
                    // Bug fix after datetime type change from int to Date, d3 likes number time
                    average[0] = + doc['datetime'].getTime();

                    // calc average
                    for (var i = 0; i < data.length; i++) {
                        average[i+1] += doc[m[2]][data[i]];
                    }

                    // Strange calculation is here average just keep by granularity 
                    if (cnt % granularity == 0) {
                        // Bug fix: NMIO-227 date error => comment out following line
                        //average[0] = parseInt(average[0] /  granularity);
                        for (var i = 0; i < data.length; i++) {
                            // NMIO-227 round up.
                            average[i+1] = Math.round(average[i+1] / parseFloat(granularity) * 100) / 100;
                        }
                        results.push(average);
                        average = [0];
                        for (var i = 0; i < data.length; i++) {
                            average.push(0.0);
                        }
                    }
                }
                else {
                    res.writeHead(200, {'Content-Type': 'text/json'});
                    res.end(JSON.stringify(results));
                }
            });
        }
        else {
            res.writeHead(200, {'Content-Type': 'text/json'});
            res.end(JSON.stringify(results));
        }
    });
}

/*
 * Get top fields
 *
 * TODO: change to restful API
 */
function get_top_fields(req, res) {
    var url_info = url.parse(req.url, true);
    var results = [];

    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);

    var date = eval(url_info.query['date']);

    // db type changed from UTC time number to UTC string. 2016.9.5. by ymk
    date[0] = new Date( parseInt(date[0]));
    date[1] = new Date( parseInt(date[1]));

    var type = url_info.query['type'];

    var match = {};
    if (m[1] !== 'All')
        match['host'] = m[1];
    if (typeof date !== 'undefined')
        match['datetime'] = { $gt : date[0], $lt : date[1] };

    var group = { _id : { command: '$TOP.Command' } };
    if (type === 'cpu')
        group['val'] = { $avg : "$TOP.%CPU" }
    else if (type === 'mem')
        group['val'] = { $avg : { $add: ["$TOP.ResText", "$TOP.ResData"] } }

    results.push(['Command', type]);

    nmondbZZZZ.aggregate(
        {'$match' : match}, 
        {'$project': {TOP:1}}, 
        {'$unwind': '$TOP'}, 
        {'$group': group}, 
        function (err, doc) {
            if( err ) {
                return error_handler(res, err, 500);
            }
            if( doc ) {
                for( var i = 0; i < doc.length; i++ ) {
                    results.push([ doc[i]._id.command, doc[i].val ]);
                }
            }
            res.writeHead(200, {'Content-Type': 'text/json'});
            res.end(JSON.stringify(results));
        }
    );
}

/*
 * Get host utilization fields for server insight
 *
 * TODO: 1. change to restful API
 *       2. process one server name
 */
function get_host_fields(req, res) {
    var url_info = url.parse(req.url, true);
    var results = {};
    var date = eval(url_info.query['date']);

    var match = {};

    if (typeof date !== 'undefined') {
        // type change 
        // db type changed from UTC time number to UTC string. 2016.9.5. by ymk
        date[0] = new Date( parseInt(date[0]));
        date[1] = new Date( parseInt(date[1]));

    } else {
        var now = new Date();
        date = [];
        date[0] = new Date(now.getTime() - 1000*60*1); // recent 1 minutes average
        date[1] = now;
    }

    match['datetime'] = { $gt : date[0], $lt : date[1] };

    var group = { _id : { host: '$host' } };
    group['val'] = { $avg : { $add: ["$CPU_ALL.User", "$CPU_ALL.Sys"] } };
    group['no'] = { $avg : "$CPU_ALL.CPUs"};

    var sort = {'host' : 1}
    nmondbZZZZ.aggregate(
        {'$match' : match}, 
        {'$project': {host:1, CPU_ALL:1}}, 
        {'$group': group}, 
        function (err, doc) {
        if( err )
            return error_handler(res, err, 500);
        if( doc ) {
            for( var i = 0; i < doc.length; i++ ) {
                if ( doc[i]._id.host in results ) {
                    results[doc[i]._id.host]['cpu'] = doc[i].val;
                    results[doc[i]._id.host]['no'] = doc[i].no;
                }
                else {
                    results[doc[i]._id.host] = { cpu : doc[i].val, no : doc[i].no };
                }
            }
            var group2 = { _id: { host: '$host'} };
            group2['val'] = { $avg : { $add: ["$DISK_ALL.read", "$DISK_ALL.write"] } };
            nmondbZZZZ.aggregate(
                {'$match' : match}, 
                {'$project': {host:1, DISK_ALL:1}},
                {'$group': group2}, 
                function (err, doc) {
                if( err )
                    return error_handler(res, err, 500);
                if( doc ) {
                    for( var i = 0; i < doc.length; i++ ) {
                        if ( doc[i]._id.host in results )
                            results[doc[i]._id.host]['disk'] = doc[i].val;
                        else
                            results[doc[i]._id.host] = { disk : doc[i].val };
                    }
                    var group3 = { _id: { host: '$host'} };
                    group3['val'] = { $avg : { $add: ["$NET_ALL.recv", "$NET_ALL.send"] } };
                    nmondbZZZZ.aggregate(
                        {'$match' : match}, 
                        {'$project': {host:1, NET_ALL:1}},
                        {'$group': group3}, 
                        {'$sort' : sort},
                        function (err, doc) {
                        if( err )
                            return error_handler(res, err, 500);
                        if( doc ) {
                            for( var i = 0; i < doc.length; i++ ) {
                                if ( doc[i]._id.host in results )
                                    results[doc[i]._id.host]['net'] = doc[i].val;
                                else
                                    results[doc[i]._id.host] = { net : doc[i].val };
                            }

                            var data = [['Host', 'Disk (KB/s)', 'CPU (%)', 'Network (KB/s)', 'No of CPUs']];
                            var hosts = Object.keys(results).sort();
                            //console.log(JSON.stringify(hosts));
                            for(var i = 0; i < hosts.length; i++) {
                                data.push([hosts[i], results[hosts[i]]['disk'], results[hosts[i]]['cpu'], results[hosts[i]]['net'], results[hosts[i]]['no']]);
                            }

                            res.writeHead(200, {'Content-Type': 'text/json'});
                            res.end(JSON.stringify(data));
                        }
                    });
                }
            });
        }
    });
}

/*
 * Callback: error_handler 
 */
function error_handler(res, err, code) {
    //console.log(err);
    log.error(err.toString());
    res.writeHead(code);
    res.end();
}
