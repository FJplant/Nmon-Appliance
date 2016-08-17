/*
 * nmon-repo.js is
 *    an elastic nmon-repo component written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 * 
 *      since Aug 12, 2015
 * (c)2015,2016 All rights reserved to Junkoo Hea, Youngmo Kwon.
 */

// expose this function to our app using module.exports

var url = require('url'),
    mongojs = require('mongojs'),
    Transform = require('stream').Transform,
    csv = require('csv-streamify'),
    swig = require('swig'),
    //db = mongojs('nmon-db', ['performance']),
    db = mongojs('mongodb.fjint.com/nmon-db', ['performance']),
    log = null;
// refer to https://github.com/mafintosh/mongojs

/*
 * logging on db error status 
 *
 */
db.on('error', function(err) {
    log.info('database error.', err);
});

db.on('ready', function() {
    log.info('database connected.');
});

/*
 * Graph row number
 */
var graph_row_number = 1200.0;


module.exports = function(app, passport, logger) {
    // assign logger
    log = logger;

    // Add url -> file mappings 
    app.get('/v1/nmon-db', isLoggedIn, function(req, res) {
        res.render('nmon-db-v1.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/v0/nmon-db', isLoggedIn, function(req, res) {
        res.render('nmon-db-v0.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/detail', function(req, res) {
        res.render('detail.html');
    });

    app.get('/test', function(req, res) {
        res.render('test.html');
    });

    // Add dynamic handlers
    app.post('/nmonlog', function(req, res) {
        service(req, res);
    });

    app.post('/nmonlog_bulk', function(req, res) {
        service(req, res);
    });

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
    var method = req.method;
    log.info('Served by worker PID[%d]: %s', process.pid, (method + ' ' + pathname) );

    try {
        if ( pathname == '/nmonlog' ) {
            if( method == 'POST' ) {
                put_nmonlog(url_info, req, res, 1);
                return;
            }
        }
        else if ( pathname == '/nmonlog_bulk' ) {
            if( method == 'POST' ) {
                put_nmonlog(url_info, req, res, 10);
                return;
            }
        }
        else if ( pathname == '/categories' ) {
            if( method == 'GET' ) {
                get_categories(url_info, req, res);
                return;
            }
        }
        else if ( pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/hosts$/) ) {
            if( method == 'GET' ) {
                get_hosts(url_info, req, res);
                return;
            }
        }
        else if ( pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/titles$/) ) {
            if( method == 'GET' ) {
                get_titles(url_info, req, res);
                return;
            }
        }
        else if ( pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/) ) {
            if( method == 'GET' ) {
                get_fields(url_info, req, res);
                return;
            }
        }

        not_found(url_info, req, res);
    }
    catch(e) {
        error_handler(res, e, 500);
    }
}

/*
 * Put nmonlog 
 *
 * 1. parse nmon log
 * 2. store parsed nmon data to mongodb
 */
function put_nmonlog(url_info, req, res, bulk_unit) {
    db.collection('categories').ensureIndex({name: 1}, {unique: true, background: true});
    db.collection('categories').save({name: 'DISK_ALL'});
    db.collection('categories').save({name: 'NET_ALL'});
    db.collection('performance').ensureIndex({host: 1, datetime: 1}, {unique: true, background: true});

    // create reserved index on (datetime) to assure performance and non-skewed index db.
    // 2016.5.18. ymk
    db.collection('performance').ensureIndex({datetime: -1, host: 1}, {unique: true, background: true});
     
    var csvToJson = csv({objectMode: true});

    var parser = new Transform({objectMode: true});
    parser.header = null;
    parser._hostname = '';
    parser._document = {};
    parser._rawHeader = {};
    parser._cnt = 0;
    parser._diskTotal = {};
    parser._hostname = null;

    parser._flushSave = function() {
        if (Object.keys(parser._document).length !== 0 ) {
            this.push(['performance', parser._document]);
            parser._cnt++;
            process.stdout.write('.');
            if (parser._cnt % 80 == 0)
                process.stdout.write('\n');
        }
    }

    parser._transform = function(data, encoding, done) {
        if( data[0].substring(0, 3) === 'AAA' || data[0].substring(0, 3) === 'BBB' ) {
            if (data[1] === 'host')
                parser._hostname = data[2];
        }
        else if (data[0].substring(0, 3) === 'ZZZ' ) {
            parser._flushSave();
            parser._document = {};
            parser._document['host'] = parser._hostname;
            var ts = data[2] + ' ' + (typeof data[3] == "undefined" ? '1-JAN-1970' : data[3]);
            parser._document['datetime'] = (new Date(ts)).getTime();
            parser._document['DISK_ALL'] = {};
            parser._document['NET_ALL'] = {};
            parser._document['TOP'] = [];
        }
        else {
            if( data[0] in parser._rawHeader ) {
                var h = parser._rawHeader[data[0]];
                var val = 0.0, iops = 0.0, read = 0.0, write = 0.0;
                var query = {};
                for( var i = 2; i < h.length; i++ ) {
                    if(h[i] !== '') {
                        if (h[0] === 'CPU_ALL') {
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

    var writer = new Transform({objectMode: true});
    writer._bulk = [];
    writer._header = [];
    writer._headerWrited = false;
    writer._flushSave = function(done) {
        //process.stdout.write('s');
        if( writer._bulk.length > 0 ) {
            var bulkop = db.collection('performance').initializeOrderedBulkOp();
            for(var i = 0; i < writer._bulk.length; i++) {
                bulkop.insert(writer._bulk[i]);
            }
            bulkop.execute(function(err, res) {
                if (err)
                    log.error(err.toString());
                //console.log('d');
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

    writer._transform = function(data, encoding, done) {
        //process.stdout.write('o');
        if( data[0] === 'categories' ) {
            writer._header.push(data[1]);
            done();
        }
        else {
            if (!writer._headerWrited) {
                writer._headerWrited = true;
                var bulkop = db.collection('categories').initializeOrderedBulkOp();
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
                //process.stdout.write('x');
                writer._flushSave(done);
            }
            else {
                done();
            }
        }
    };

    writer.on('finish', function() {
        writer._flushSave();
        process.stdout.write('\n');
        res.writeHead(200);
        res.end();
    });
   
    res.connection.setTimeout(0);
    req.pipe(csvToJson).pipe(parser).pipe(writer);
}

/*
 * Get categories
 *
 * TODO: change to restful API
 */
function get_categories(url_info, req, res) {
    var result = [];
    var categories = db.collection('categories');
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
function get_hosts(url_info, req, res) {
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/hosts$/);
    var collection = db.collection('performance');
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
function get_titles(url_info, req, res) {
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/titles$/);
    var collection = db.collection('performance');
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
function get_fields(url_info, req, res) {
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);
    if (m[2] === 'TOP' )
        return get_top_fields(url_info, req, res);
    else if (m[2] === 'HOST')
        return get_host_fields(url_info, req, res);

    var results = [];
    var data = eval(url_info.query['data']);
    var date = eval(url_info.query['date']);
    var collection = db.collection('performance');
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
function get_top_fields(url_info, req, res) {
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
    var collection = db.collection('performance');
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
function get_host_fields(url_info, req, res) {
    var results = {};
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);

    var date = eval(url_info.query['date']);

    var match = {};
    if (typeof date !== 'undefined')
        match['datetime'] = { $gt : date[0], $lt : date[1] };

    var group = { _id : { host: '$host' } };
    group['val'] = { $avg : { $add: ["$CPU_ALL.User", "$CPU_ALL.Sys"] } };
    group['no'] = { $avg : "$CPU_ALL.CPUs"};
    db.collection('performance').aggregate(
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
            db.collection('performance').aggregate(
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
                    db.collection('performance').aggregate(
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
 * Not found helper funtion
 */
function not_found(url_info, req, res) {
    log.warn('bad request');
    res.writeHead(404);
    res.end();
}

/*
 * Callback: error_handler 
 */
function error_handler(res, err, code) {
    log.error(err.toString());
    res.writeHead(code);
    res.end();
}

/*
 * Authentication checker
 * route middleware to make sure
 */
function isLoggedIn(req, res, next) {
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();


    // if they aren't redirect them to the home page
    res.redirect('/login');
};
