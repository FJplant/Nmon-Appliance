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
        else if ( pathname == '/nmonlog' ) {
            if( method == 'POST' ) {
                put_nmonlog(url_info, req, res);
                return;
            }
        }
        else if ( pathname == '/categories' ) {
            if( method == 'GET' ) {
                get_categories(url_info, req, res);
                return;
            }
        }
        else if ( pathname.match(/^\/categories\/([A-Za-z0-9_]+)\/hosts$/) ) {
            if( method == 'GET' ) {
                get_hosts(url_info, req, res);
                return;
            }
        }
        else if ( pathname.match(/^\/categories\/([A-Za-z0-9_]+)\/titles$/) ) {
            if( method == 'GET' ) {
                get_titles(url_info, req, res);
                return;
            }
        }
        else if ( pathname.match(/^\/categories\/([A-Za-z0-9_]+)\/([A-Za-z0-9_%]+)$/) ) {
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
}).listen(8080);

log.info('Server running at http://localhost:8080');

function put_nmonlog(url_info, req, res) {
    var csvToJson = csv({objectMode: true});
    var parser = new Transform({objectMode: true});
    parser.header = null;
    parser._rawHeader = {};
    parser._datetime = {};
    parser._transform = function(data, encoding, done) {
        if( data[0].substring(0, 3) === 'AAA' || data[0].substring(0, 3) === 'BBB' )
            ;
        else if (data[0].substring(0, 3) === 'ZZZ' ) {
            var ts = data[2] + ' ' + (typeof data[3] == "undefined" ? '1-JAN-1970' : data[3]);
            parser._datetime[data[1]] = (new Date(ts)).getTime();
        }
        else {
            if( data[0] in parser._rawHeader ) {
                var h = parser._rawHeader[data[0]];
                var kv = {};
                kv['host'] = h[1].split(' ').pop();  
                kv['datetime'] = parser._datetime[data[1]];
                var collection = db.collection(h[0]);
                collection.findOne({datetime: kv['datetime'], host: kv['host']}, function(err, doc) {
                    if (!doc) {
                        for( var i = 2; i < h.length; i++ ) {
                            kv[h[i]] = parseFloat(data[i]);
                        }
                        collection.save(kv, function(err) {
                            if( err )
                            log.error(err.toString());
                        });
                    }
                });
            }
            else {
                var collection = db.collection('categories');
                collection.findOne({name: data[0]}, function(err, doc) {
                    if (!doc) {
                        collection.save({name: data[0]}, function(err) {
                            if( err )
                                log.error(err.toString());
                        });
                    }
                });
                parser._rawHeader[data[0]] = data;
            }
        }
        this.push(data);
        done();
    }
    req.pipe(csvToJson).pipe(parser);
    req.on('end', function() {
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
    var m = url_info.pathname.match(/^\/categories\/([A-Za-z0-9_]+)\/hosts$/);
    var collection = db.collection(m[1]);
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
    var m = url_info.pathname.match(/^\/categories\/([A-Za-z0-9_]+)\/titles$/);
    var collection = db.collection(m[1]);
    collection.findOne({}, function (err, doc) {
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
    var m = url_info.pathname.match(/^\/categories\/([A-Za-z0-9_]+)\/([A-Za-z0-9_%]+)$/);
    var collection = db.collection(m[1]);
    collection.find().sort({datetime:1}).forEach(function(err, doc) {
        if( err )
            return error_handler(res, err, 500);
        if( doc ) {
            results.push([doc['datetime'], doc[m[2]]]);
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



