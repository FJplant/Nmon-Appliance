var http = require('http'),
    url = require('url'),
    winston = require('winston'),
    mongojs = require('mongojs'),
    Transform = require('stream').Transform,
    csv = require('csv-streamify'),
    swig = require('swig');

db = mongojs('nmon-db', ['record']);
//db = mongojs('nmon-tokyo.fjint.com/nmon-db', ['record']);
//db = mongojs('bumil.fjint.com/nmon-db', ['record']);
// refer to https://github.com/mafintosh/mongojs

/*
 * TODO: logging on db error status 
 *
 */
/*
db.on('error', function (err) {
    console.log('database error', err);
});

db.on('ready', function () {
    console.log('database connected');
});
*/

var log = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({ filename: 'logs/nmon-db.log', level: 'debug' }),
    ]
});

var graph_row_number = 1200.0;

http.Server(function(req, res) {
    var url_info = url.parse(req.url, true);
    var pathname = url_info.pathname;
    var method = req.method;
    log.info(method + ' ' + pathname);
    try {
        if( pathname == '/' ) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            var html = swig.renderFile('template/index.html', {
            });
            res.end(html);
            return;
        }
        else if( pathname == '/detail' ) {
            res.writeHead(200, {'Content-Type': 'text/html'});
            var html = swig.renderFile('template/detail.html', {
            });
            res.end(html);
            return;
        }
        else if( pathname == '/nmon-db-client.js' ) {
            res.writeHead(200, {'Content-Type': 'text/javascript'});
            var html = swig.renderFile('template/nmon-db-client.js', {
            });
            res.end(html);
            return;
        }
        else if( pathname == '/process.json' ) {
            res.writeHead(200, {'Content-Type': 'application/json'});
            var html = swig.renderFile('template/process.json', {
            });
            res.end(html);
            return;
        }
        else if ( pathname == '/nmonlog' ) {
            if( method == 'POST' ) {
                put_nmonlog(url_info, req, res, 1);
                return;
            }
        }
        else if ( pathname == '/nmonlog_bulk' ) {
            if( method == 'POST' ) {
                put_nmonlog(url_info, req, res, 1000);
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
}).listen(6900);

log.info('Server running at http://localhost:6900');

function put_nmonlog(url_info, req, res, bulk_unit) {
    db.collection('categories').ensureIndex({name: 1}, {unique: true});
    db.collection('categories').save({name: 'DISK_TOTAL'});
    db.collection('categories').save({name: 'NET_TOTAL'});

    var csvToJson = csv({objectMode: true});

    var parser = new Transform({objectMode: true});
    parser.header = null;
    parser._rawHeader = {};
    parser._datetime = {};
    parser._cnt = 0;
    parser._diskTotal = {};
    parser._hostname = null;
    parser._transform = function(data, encoding, done) {
        parser._cnt++;
        if (parser._cnt % 100 == 0) {
            process.stdout.write('.');
            if (parser._cnt % 8000 == 0)
                process.stdout.write('\n');
        }
        if( data[0].substring(0, 3) === 'AAA' || data[0].substring(0, 3) === 'BBB' )
            ;
        else if (data[0].substring(0, 3) === 'ZZZ' ) {
            var ts = data[2] + ' ' + (typeof data[3] == "undefined" ? '1-JAN-1970' : data[3]);
            parser._datetime[data[1]] = (new Date(ts)).getTime();
        }
        else {
            if( data[0] in parser._rawHeader ) {
                var h = parser._rawHeader[data[0]];
                var query = { host: h[1].split(' ').pop(), datetime: parser._datetime[data[1]]};
                if(h[0] === 'TOP') {
                    query['host'] = parser._hostname;
                    query['datetime'] = parser._datetime[data[2]];
                }
                else {
                    parser._hostname = query['host'];
                }

                var val = 0.0, read = 0.0, write = 0.0;
                for( var i = 2; i < h.length; i++ ) {
                    if(h[i] !== '') {
                        if (h[0] === 'MEM') {
                            if (h[i] === 'memtotal')
                                query['Real total(MB)'] = parseFloat(data[i]);
                            else if (h[i] === 'memfree')
                                query['Real free(MB)'] = parseFloat(data[i]);
                            else if (h[i] === 'swaptotal')
                                query['Virtual total(MB)'] = parseFloat(data[i]);
                            else if (h[i] === 'swapfree')
                                query['Virtual free(MB)'] = parseFloat(data[i]);
                            else
                                query[h[i]] = parseFloat(data[i]);
                        }
                        else if (h[0] === 'CPU_ALL') {
                            if (h[i] === 'PhysicalCPUs')
                                query['CPUs'] = parseFloat(data[i]);
                            else
                                query[h[i]] = parseFloat(data[i]);
                        }
                        else {
                            if( h[0] === 'TOP' && h[i] === 'Time' ) {
                                // skip time
                            }
                            else if( h[0] === 'TOP' && h[i] === 'Command' ) {
                                query[h[i]] = data[i];
                            }
                            else {
                                query[h[i]] = parseFloat(data[i]);
                            }
                        }
                    }
                    if( (h[0].indexOf("DISKREAD")== 0 || h[0].indexOf("DISKWRITE")== 0) && h[i].match(/.+\d+$/) ) {
                        val += parseFloat(data[i]);
                    }
                    else if (h[0] === 'NET') {
                        if( h[i].indexOf('read') != -1 )
                            read += parseFloat(data[i]);
                        else if( h[i].indexOf('write') != -1)
                            write += parseFloat(data[i]);
                    }
                }
                if (!(h[0] === 'TOP' && data[2] === 'T0001')) {
                    this.push([h[0], query, null]);
                }

                if( h[0] === 'DISKREAD' ) {
                    parser._diskTotal['host'] = query['host'];
                    parser._diskTotal['datetime'] = query['datetime'];
                    parser._diskTotal['read'] = val;
                    if ('write' in parser._diskTotal) {
                        this.push(['DISK_TOTAL', parser._diskTotal, null]);
                        parser._diskTotal = {};
                    }
                }
                else if (h[0] === 'DISKWRITE') {
                    parser._diskTotal['host'] = query['host'];
                    parser._diskTotal['datetime'] = query['datetime'];
                    parser._diskTotal['write'] = val;
                    if ('read' in parser._diskTotal) {
                        this.push(['DISK_TOTAL', parser._diskTotal, null]);
                        parser._diskTotal = {};
                    }
                }
                else if (h[0] === 'NET') {
                    var query2 = { host : query['host'], datetime: query['datetime'], read: read, write: write };
                    this.push(['NET_TOTAL', query2, null]);
                }
            }
            else {
                if (!(data[0] === 'TOP' && data.length <= 2)) {
                    this.push(['categories', {name: data[0]}, {name: data[0]}]);
                    parser._rawHeader[data[0]] = data;
                }
            }
        }
        done();
    }

    var writer = new Transform({objectMode: true});
    writer._bulkcnt = 0;
    writer._bulk = [];
    writer._flushSave = function(done) {
        var bulks = {};
        for(var i = 0; i < writer._bulkcnt; i++) {
            if( !(writer._bulk[i][0] in bulks) ) {
                bulks[writer._bulk[i][0]] = db.collection(writer._bulk[i][0]).initializeOrderedBulkOp();
            }
            if (writer._bulk[i][0] === 'categories') {
                bulks[writer._bulk[i][0]].find(writer._bulk[i][1]).upsert().update({ $set: writer._bulk[i][2]});
                var collection = db.collection(writer._bulk[i][1]['name']);
                if ( writer._bulk[i][1]['name'] === 'TOP')
<<<<<<< HEAD
                    collection.ensureIndex({datetime: 1, host: 1}, {unique: false, background: true});
                else
                    collection.ensureIndex({datetime: 1, host: 1}, {unique: true, background: true});
=======
                    collection.ensureIndex({host: 1, datetime: 1}, {unique: false, background: true});
                else
                    collection.ensureIndex({host: 1, datetime: 1}, {unique: true, background: true});
>>>>>>> 1b7657a579bebd8e3f805e8900e4fb1093b18d12

            }
            else {
                bulks[writer._bulk[i][0]].insert(writer._bulk[i][1]);
            }
        }
        var cnt = 0;
        for (var c in bulks) {
            bulks[c].execute(function(err, res) {
                if (err)
                    log.error(err.toString());
                cnt++;
                if (cnt >= Object.keys(bulks).length) {
                    writer._bulkcnt = 0;
                    writer._bulk = [];
                    if (done) {
                        done();    
                    }
                }
            });
        }
    }
    writer._transform = function(data, encoding, done) {
        writer._bulkcnt ++;
        writer._bulk.push(data);
        if ( writer._bulkcnt >= bulk_unit ) {
            writer._flushSave(done);
        }
        else {
            done();
        }
    };

    res.connection.setTimeout(0);
    req.pipe(csvToJson).pipe(parser).pipe(writer);
    req.on('end', function() {
        writer._flushSave();
        process.stdout.write('\n');
        res.writeHead(200);
        res.end();
    });
}

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

function get_hosts(url_info, req, res) {
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/hosts$/);
    var collection = db.collection(m[2]);
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

function get_titles(url_info, req, res) {
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)\/titles$/);
    var collection = db.collection(m[2]);
    var query = {};
    if (m[1] !== 'All') {
        query['host'] = m[1];
    }
    collection.findOne(query, function (err, doc) {
        if( err )
            return error_handler(res, err, 500);
        var results = [];
        if( doc ) {
            for (key in doc)
                if (key !== 'host' && key !== 'datetime' && key !== '_id')
                    results.push(key);
        }
        res.writeHead(200, {'Content-Type': 'text/json'});
        res.end(JSON.stringify(results))
    });
}

function get_fields(url_info, req, res) {
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);
    if (m[2] === 'TOP' )
        return get_top_fields(url_info, req, res);
    else if (m[2] === 'HOST')
        return get_host_fields(url_info, req, res);

    var results = [];
    var data = eval(url_info.query['data']);
    var date = eval(url_info.query['date']);
    var collection = db.collection(m[2]);
    var fields = {datetime:1, _id: 0};
    for (var i = 0; i < data.length; i++) {
        fields[data[i]] = 1;
    }
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
            var average = [0];
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
                        average[i+1] += doc[data[i]];
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

    var group = { _id : { command: '$Command' } };
    if (type === 'cpu')
        group['val'] = { $avg : "$%CPU" }
    else if (type === 'mem')
        group['val'] = { $avg : { $add: ["$ResText", "$ResData"] } }

    results.push(['command', type]);
    var collection = db.collection(m[2]);
    collection.aggregate({'$match' : match}, {'$group': group}, function (err, doc) {
        if( err )
            return error_handler(res, err, 500);
        if( doc ) {
            for( var i = 0; i < doc.length; i++ ) {
                results.push([ doc[i]._id.command, doc[i].val ]);
            }
        }
        res.writeHead(200, {'Content-Type': 'text/json'});
        res.end(JSON.stringify(results));
    });
}

function get_host_fields(url_info, req, res) {
    var results = {};
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);

    var date = eval(url_info.query['date']);

    var match = {};
    if (typeof date !== 'undefined')
        match['datetime'] = { $gt : date[0], $lt : date[1] };

    var group = { _id : { host: '$host' } };
    group['val'] = { $avg : { $add: ["$User%", "$Sys%"] } };
    group['no'] = { $avg : "$CPUs"};
    db.collection('CPU_ALL').aggregate({'$match' : match}, {'$group': group}, function (err, doc) {
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
            group2['val'] = { $avg : { $add: ["$read", "$write"] } };
            db.collection('DISK_TOTAL').aggregate({'$match' : match}, {'$group': group2}, function (err, doc) {
                if( err )
                    return error_handler(res, err, 500);
                if( doc ) {
                    for( var i = 0; i < doc.length; i++ ) {
                        if ( doc[i]._id.host in results )
                            results[doc[i]._id.host]['disk'] = doc[i].val;
                        else
                            results[doc[i]._id.host] = { disk : doc[i].val };
                    }
                    db.collection('NET_TOTAL').aggregate({'$match' : match}, {'$group': group2}, function (err, doc) {
                        if( err )
                            return error_handler(res, err, 500);
                        if( doc ) {
                            for( var i = 0; i < doc.length; i++ ) {
                                if ( doc[i]._id.host in results )
                                    results[doc[i]._id.host]['net'] = doc[i].val;
                                else
                                    results[doc[i]._id.host] = { net : doc[i].val };
                            }

                            var data = [['HOST', 'CPU (%)', 'Disk (KB/s)', 'Network (KB/s)', 'No of CPUs']];
                            var hosts = Object.keys(results);
                            for(var i = 0; i < hosts.length; i++) {
                                data.push([hosts[i], results[hosts[i]]['cpu'], results[hosts[i]]['disk'], results[hosts[i]]['net'], results[hosts[i]]['no']]);
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

function not_found(url_info, req, res) {
    log.warn('bad request');
    res.writeHead(404);
    res.end();
}

function error_handler(res, err, code) {
    log.error(err.toString());
    res.writeHead(code);
    res.end();
}
