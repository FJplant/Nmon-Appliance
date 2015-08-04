var http = require('http'),
    url = require('url'),
    winston = require('winston'),
    mongojs = require('mongojs'),
    Transform = require('stream').Transform,
    csv = require('csv-streamify'),
    swig = require('swig');
            

var db = mongojs('nmonw', ['record']);

var log = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({ filename: 'logs/nmonw.log', level: 'debug' }),
    ]
});

var graph_row_number = 300.0;

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
    parser._diskTotal = {}
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
                        else {
                            query[h[i]] = parseFloat(data[i]);
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
                this.push([h[0], query, null]);
                
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
                this.push(['categories', {name: data[0]}, {name: data[0]}]);
                parser._rawHeader[data[0]] = data;
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
                collection.ensureIndex({datetime: 1, host: 1}, {unique: true});
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
    var results = [];
    var m = url_info.pathname.match(/^\/([A-Za-z0-9_\-]+)\/([A-Za-z0-9_]+)$/);
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
