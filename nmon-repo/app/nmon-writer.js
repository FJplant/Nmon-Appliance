/*
 * nmon-writer.js is
 *    an nmon writer class written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 *
 *      since Aug 12, 2015
 * (c)2015,2016 All rights reserved to Junkoo Hea, Youngmo Kwon.
 */

module.exports = NmonWriter;

var MongoClient = require('mongodb').MongoClient,
    mongojs = require('mongojs'),
    util = require('util');

// TODO: remove nmdb environment. This is not realted to generic nmon-parser.js
// var nmdb = require('../config/nmdb-config.js');

/*
 * Initialize mongodb connection
 *
 * TODO: get mongodb URL from constructor;
 */
var  mongodb = mongojs(nmdb.env.NMDB_NMONDB_URL);

mongodb.on('connect', function() {
    console.log('nmon-writer.js: database connected.');
});

var dbMongo = null;

var nmondbCategories = mongodb.collection('nmon-categories'),
    nmondbMETA = mongodb.collection('nmon-meta'),
    nmondbZZZZ = mongodb.collection('nmon-perf'),
    nmondbUARG = mongodb.collection('nmon-uarg'),
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
function NmonWriter(options) {
    // allow use without new
    if (!(this instanceof NmonWriter)) {
        return new NmonWriter(options);
    }

    // Nmon Writer instance variables
    this._bulk = [];
    this._bulk_unit = 1;

    if (typeof options['bulkUnit'] !== 'undefined') 
        this._bulk_unit = parseInt( options['bulkUnit'] );
}

// TODO: DB error handling
NmonWriter.prototype.writeMETA = function(meta) {
    // TODO: call callack when completed
    nmondbMETA.insert(meta);
    console.log("Meta data written: " + meta['host'] + ', ' + meta['snapdate'] + ' ' + meta['snaptime']);
}

// TODO: DB error handling
NmonWriter.prototype.writeUARG = function(uarg) {
    // TODO: call callack when completed
    nmondbUARG.insert(uarg);
    console.log("UARG written: " + uarg['host'] + ', ' + uarg['snapdate'] + ' ' + uarg['snaptime'] +  ', ' + uarg['FullCommand']);
}

// TODO: header should be moved to parser
NmonWriter.prototype.addCategory = function(category) {
    var bulkop = nmondbCategories.initializeOrderedBulkOp();
    bulkop.find(category).upsert().update({ $set: category});

    bulkop.execute(function(err, res) {
        if (err) console.error(err.toString());
        else console.log('Category data written...');
    });
}

// TODO: DB error handling
NmonWriter.prototype.writeZZZZ = function(zzzz, callback) {
    //console.log(JSON.stringify(zzzz));
    // push new zzzz
    this._bulk.push(zzzz);
    
    // flush writer if there is more data than bulk unit
    // for debug purpose
    if (this._bulk_unit == 1 || (this._bulk_unit > 1 && this._bulk.length >= this._bulk_unit)) {
        // save the accumulated _bulk
        this._flushSave(callback);

        // log some periodic message
        console.log('Pushed host: ' + zzzz['host']
                  + ', Snapframe: ' + zzzz['snapframe']
                  + ', Snaptime: ' + zzzz['snaptime']
                  + ', Keys: ' + Object.keys(zzzz).length
                  + ', Bulk Unit: ' + this._bulk_unit
                  + ', Document count: ' + this._bulk.length);

        // clear _bulk buffer
        this._bulk = [];
    } else
        callback(); // notify I/O operation has finished. because we don't have to make an real I/O
}

// Insert accumulated Nmon ZZZZ data
// TODO: bulkop operation have some bug when bulk unit is big
NmonWriter.prototype._flushSave = function(cb) {
    //process.stdout.write('F');
    // store remained nmon data to mongo db
    // 
    // 2016.9.5. by ymk
    // bulkop does not work with a unit of bulop.execute. So, operate separatedly when real bulk insert arrives
    //if( this._bulk.length > 0 ) {
    if (this._bulk_unit == 1 && this._bulk.length == 1){ 
        for(var i = 0; i < this._bulk.length; i++) {
            nmondbZZZZ.insert(this._bulk[i], function(err, res) {
                if (!err) {
                    console.log('nmon-writer.js: database single insert error.');
                    // this._bulk[0] is out OUT of scope, so find other way
                    //console.error('ZZZZ from: ' + this._bulk[0]['host'] + ', '  + this._bulk[0]['snapframe'])
                    //console.error('      ,to: ' + this._buik[this._bulk.length - 1]['host'] + ', ' 
                    //                            + this._bulk[this._bulk.length - 1]['snapframe']);
                    console.log('            ==> ' + err.toString());
                }
                else {
                    console.log('[nmon-writer.js] ' + res['nInserted'] + ' items are successfully inserted db.');
                    console.log('                 ' + JSON.stringify(res));
                }

            });
        }

        cb(); // notify db insert completion
    }
    else if( this._bulk_unit > 1 && this._bulk.length > 1 ) {
        /*
        var bulkop = nmondbZZZZ.initializeOrderedBulkOp();
        for(var i = 0; i < this._bulk.length; i++) {
            //console.log('Item #' + (i + 1) + ' inserted to bulkop in_fluashSave()');
            bulkop.insert(this._bulk[i]);
        }

        bulkop.execute(function(err, res) {
            if (!err) {
                console.log('nmon-writer.js: database single insert error.');
                // this._bulk[0] is out OUT of scope, so find other way
                console.log('ZZZZ from: ' + this._bulk[0]['host'] + ', '  + this._bulk[0]['snapframe'])
                console.log('      ,to: ' + this._buik[this._bulk.length - 1]['host'] + ', ' 
                                          + this._bulk[this._bulk.length - 1]['snapframe']);
                console.log('           ' + err.toString());
            }
            else {
                console.log('[nmon-writer.js] ' + res['nInserted'] + ' items are successfully inserted db.');
                console.log('             ==> ' + JSON.stringify(res));
            }

            cb();  // notify db insert completion
        }
        */
        nmondbMC.insertMany(this._bulk, function(err, r) {
            if (!err) {
                console.log('nmondbMC BulkOp excution result: ' + JSON.stringify(r.result));
            } else {
                console.log('nmondbMC insertMany error: code=' + err.code + ', index=' + err.index);
                console.log('    ' + err.errmsg);
            }

            console.log('Process memory usage: ' + JSON.stringify(process.memoryUsage()));
            cb();  // notify db insert completion
        });
    } 
}

NmonWriter.prototype._bulkOpCallback = function(err, res) {
    if (!err) {
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

    cb();  // notify db insert completion
}
