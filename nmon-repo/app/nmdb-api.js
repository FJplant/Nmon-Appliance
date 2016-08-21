/*
 * nmdb-api.js is
 *    an elastic nmon-db component written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 * 
 *      since Aug 12, 2015
 * (c)2015,2016 All rights reserved to Junkoo Hea, Youngmo Kwon.
 */

var url = require('url'),
    winston = require('winston'),
    mongojs = require('mongojs');

/*
 * Initialize winston logger
 *
 * TODO: make log file configurable
 */
var log = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({ filename: 'logs/nmdb-api.log', level: 'debug' }),
    ]
});

/*
 * Initialize mongodb connection
 *
 * TODO: make db connection configurable 
 */
var  mongodb = mongojs('mongodb.fjint.com/nmon-db', ['performance']);
mongodb.on('error', function(err) {
    log.info('Nmon-db database error.', err);
});

mongodb.on('ready', function() {
    log.info('Nmon-db database connected.');
});

/*
 * Graph row number
 */
var graph_row_number = 1200.0;

// expose this function to our app using module.exports
module.exports = function(app, passport) {
    // Add GET methods for nmon-db
    app.get('/categories', function(req, res) {
        service(req, res);
    });

    app.get(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/hosts$/, function(req, res) {
        service(req, res);
    });

    app.get(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/titles$/, function(req, res) {
        service(req, res);
    });

    app.get(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/, function(req, res) {
        service(req, res);
    });
}

/*
 * service funtion
 */
function service(req, res) {
    var url_info = url.parse(req.url, true);
    var pathname = url_info.pathname;
    var searchparam = url_info.search;
    var method = req.method;

    log.debug('Served by worker PID[%d]: %s', process.pid, (method + ' ' + pathname + searchparam) );

    try {
        if ( pathname == '/categories' ) {
            if( method == 'GET' ) {
                log.debug('Call get_categories with parameters: %s', searchparam);
                get_categories(req, res);

                return;
            }
        }
        else if ( pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/hosts$/) ) {
            if( method == 'GET' ) {
                log.debug('Call get_hosts with parameters: %s', searchparam);
                get_hosts(req, res);

                return;
            }
        }
        else if ( pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/titles$/) ) {
            if( method == 'GET' ) {
                log.debug('Call get_titles with parameters: %s', searchparam);
                get_titles(req, res);

                return;
            }
        }
        else if ( pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/) ) {
            if( method == 'GET' ) {
                var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);

                if (m[2] === 'TOP' ) {
                    log.debug('Call get_top_fields with parameters: %s', searchparam);
                
                    return get_top_fields(req, res);
                } 
                else if (m[2] === 'HOST') {
                    log.debug('Call get_host_fields with parameters: %s', searchparam);

                    return get_host_fields(req, res);
                }
                else {
                    log.debug('Call get_fields with parameters: %s', searchparam);

                    return get_fields(req, res);
                }
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
    var categories = mongodb.collection('categories');
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
function get_hosts(req, res) {
    var url_info = url.parse(req.url, true);

    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/hosts$/);
    var collection = mongodb.collection('performance');
    collection.distinct('host', {}, function (err, doc) {
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

/*
 * Get titles
 *
 * TODO: change to restful API
 */
function get_titles(req, res) {
    var url_info = url.parse(req.url, true);

    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/titles$/);
    var collection = mongodb.collection('performance');
    var query = { };
    if (m[1] !== 'All') {
        query['host'] = m[1];
    }
    var fields = { _id: 0 };
    fields[m[2]] = 1;
    collection.findOne(query, fields, function (err, doc) {
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
 *
 * TODO: change to restful API
 */
function get_fields(req, res) {
    var url_info = url.parse(req.url, true);
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);

    var results = [];
    var data = eval(url_info.query['data']);
    var date = eval(url_info.query['date']);
    var collection = mongodb.collection('performance');
    var fields = {datetime:1, _id: 0};
    var average = ['Time'];
    for (var i = 0; i < data.length; i++) {
        fields[m[2] + '.' + data[i]] = 1;
        average.push(data[i]);
    }
    results.push(average);
    var query = {};
    if (m[1] !== 'All') {
        query['host'] = m[1];
    }
    if (typeof date !== 'undefined') {
        query['datetime'] = { $gt : date[0], $lt : date[1] };
    }
    collection.count(query, function(err, doc) {
        if (err)
            return error_handler(res, err, 500);
        if (doc) {
            var granularity = Math.ceil(doc / graph_row_number);
            var cnt = 0;
            average = [0];
            for (var i = 0; i < data.length; i++) {
                average.push(0.0);
            }
            collection.find(query, fields).sort({datetime:1}).forEach(function(err, doc) {
                if( err )
                    return error_handler(res, err, 500);
                if( doc ) {
                    cnt++;
                    average[0] += doc['datetime'];
                    for (var i = 0; i < data.length; i++) {
                        average[i+1] += doc[m[2]][data[i]];
                    }
                    if (cnt % granularity == 0) {
                        average[0] = parseInt(average[0] /  granularity);
                        for (var i = 0; i < data.length; i++) {
                            average[i+1] = average[i+1] / parseFloat(granularity);
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
    var collection = mongodb.collection('performance');
    collection.aggregate(
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
 * Get host fields
 *
 * TODO: change to restful API
 */
function get_host_fields(req, res) {
    var url_info = url.parse(req.url, true);
    var results = {};
    var date = eval(url_info.query['date']);

    var match = {};
    if (typeof date !== 'undefined')
        match['datetime'] = { $gt : date[0], $lt : date[1] };

    var group = { _id : { host: '$host' } };
    group['val'] = { $avg : { $add: ["$CPU_ALL.User", "$CPU_ALL.Sys"] } };
    group['no'] = { $avg : "$CPU_ALL.CPUs"};
    mongodb.collection('performance').aggregate(
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
            mongodb.collection('performance').aggregate(
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
                    group3['val'] = { $avg : { $add: ["$NET_ALL.read", "$NET_ALL.write"] } };
                    mongodb.collection('performance').aggregate(
                        {'$match' : match}, 
                        {'$project': {host:1, NET_ALL:1}},
                        {'$group': group3}, 
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
                            var hosts = Object.keys(results);
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
    log.error(err.toString());
    res.writeHead(code);
    res.end();
}
