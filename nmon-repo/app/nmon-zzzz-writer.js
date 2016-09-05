/*
 * nmon-zzzz-writer.js is
 *    an nmon zzzz section stream writer class written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 *
 *      since Aug 12, 2015
 * (c)2015,2016 All rights reserved to Junkoo Hea, Youngmo Kwon.
 */

module.exports = NmonZZZZWriter;

var MongoClient = require('mongodb').MongoClient,
    mongojs = require('mongojs'),
    util = require('util');

const Transform = require('stream').Transform;

// TODO: remove nmdb environment. This is not realted to generic nmon-parser.js
// var nmdb = require('../config/nmdb-config.js');

/*
 * Initialize mongodb connection
 *
 * TODO: get mongodb URL from constructor;
 */
var  mongodb = mongojs(nmdb.env.NMDB_NMONDB_URL);

mongodb.on('connect', function() {
    console.log('nmon-zzzz-writer.js: database connected.');
});

var dbMongo = null;

var nmondbZZZZ = mongodb.collection('nmon-perf'),
    nmondbMC = null;


MongoClient.connect(nmdb.env.NMDB_NMONDB_URL, function(err, db) {
    if (!err) {
         // Get the collection
        console.log('MongoClient connectted: ' + db.databaseName + JSON.stringify(db.options));
        db.collection('nmon-perf', {w:1, j:true, strict:true}, function(err, col) {
            if (!err) {
                console.log('MongoClient collection acquired: ' + col.collectionName + ", " + col.namespace);
                nmondbMC = col;
            }
            else {
                console.log('MongoClient get collection error: ' + err);
            }
        });

        dbMongo = db;
    } else {
        console.log('MongoClient connect error: ' + err);
    }
});

// Constructor
function NmonZZZZWriter(options) {
    // allow use without new
    if (!(this instanceof NmonZZZZWriter)) {
        return new NmonZZZZWriter(options);
    }

    // init Transform
    Transform.call(this, options);

    // Nmon Writer instance variables
    this._bulk = [];
    this._bulk_unit = 1;

    if (typeof options['bulkUnit'] != 'undefined') 
        this._bulk_unit = parseInt( options['bulkUnit'] );
}
util.inherits(NmonZZZZWriter, Transform);

// TODO: DB error handling
NmonZZZZWriter.prototype._transform = function(chunk, encoding, callback) {
    // push new zzzz
    if (chunk[0] === 'performance') {
        var zzzz = chunk[1];
        this._bulk.push(zzzz);
        //console.log(JSON.stringify(zzzz));
    
        // flush writer if there is more data than bulk unit
        // for debug purpose
        if (this._bulk_unit == 1 || (this._bulk_unit > 1 && this._bulk.length >= this._bulk_unit)) {
            // save the accumulated _bulk
            this._flushSave();

            // log some periodic message
            console.log('Pushed host: ' + zzzz['host']
                      + ', Snapframe: ' + zzzz['snapframe']
                      + ', Snaptime: ' + zzzz['snaptime']
                      + ', Keys: ' + Object.keys(zzzz).length
                      + ', Bulk Unit: ' + this._bulk_unit
                      + ', Document count: ' + this._bulk.length);

            // clear _bulk buffer
            this._bulk = [];
        }
    } else {
        console.log(JSON.stringify(chunk[0]) + ' is not supported');
    }
    callback();
}

// Insert accumulated Nmon ZZZZ data
// TODO: bulkop operation have some bug when bulk unit is big
NmonZZZZWriter.prototype._flushSave = function() {
    //process.stdout.write('F');
    // store remained nmon data to mongo db
    // 
    // 2016.9.5. by ymk
    // bulkop does not work with a unit of bulop.execute. So, operate separatedly when real bulk insert arrives
    //if( this._bulk.length > 0 ) {
    if (this._bulk_unit == 1 && this._bulk.length == 1){ 
        for(var i = 0; i < this._bulk.length; i++) {
            nmondbZZZZ.insert(this._bulk[i], this._insertCallback);
        }
    }
    else if( this._bulk_unit > 1 && this._bulk.length > 1 ) {
        /*
        var bulkop = nmondbZZZZ.initializeOrderedBulkOp();
        for(var i = 0; i < this._bulk.length; i++) {
            //console.log('Item #' + (i + 1) + ' inserted to bulkop in_fluashSave()');
            bulkop.insert(this._bulk[i]);
        }

        bulkop.execute(this._bulkOpCallBack);
        */
        nmondbMC.insertMany(this._bulk, function(err, r) {
            if (!err) {
//                console.log('Bulk operation to database excuted with: ' + JSON.stringify(r.result));
            } else {
                console.log('nmondbMC insertMany error: code=' + err.code + ', index=' + err.index);
                console.log('    ' + err.errmsg);
            }
        });
    } 
}

NmonZZZZWriter.prototype._bulkOpCallback = function(err, res) {
    if (err) {
        console.log('nmon-writer.js: database single insert error.');
        // this._bulk[0] is out OUT of scope, so find other way
        //console.error('ZZZZ from: ' + this._bulk[0]['host'] + ', '  + this._bulk[0]['snapframe'])
        //console.error('      ,to: ' + this._buik[this._bulk.length - 1]['host'] + ', ' 
        //                            + this._bulk[this._bulk.length - 1]['snapframe']);
        console.log('                ' + err.toString());
    }
    else {
        console.log('[nmon-writer.js] ' + res['nInserted'] + ' items are successfully inserted db.');
        console.log('             ==> ' + JSON.stringify(res));
    }
}

NmonZZZZWriter.prototype._insertCallback = function(err, res) {
    if (err) {
        console.log('nmon-writer.js: database single insert error.');
        // this._bulk[0] is out OUT of scope, so find other way
        //console.error('ZZZZ from: ' + this._bulk[0]['host'] + ', '  + this._bulk[0]['snapframe'])
        //console.error('      ,to: ' + this._buik[this._bulk.length - 1]['host'] + ', ' 
        //                            + this._bulk[this._bulk.length - 1]['snapframe']);
        console.log('            ==> ' + err.toString());
    }
    else {
        //console.log('[nmon-writer.js] ' + res['nInserted'] + ' items are successfully inserted db.');
        //console.log('                 ' + JSON.stringify(res));
    }
}
