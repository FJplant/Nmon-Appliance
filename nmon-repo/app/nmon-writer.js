/*
 * nmon-this.js is
 *    an nmon writer class written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 *
 *      since Aug 12, 2015
 * (c)2015,2016 All rights reserved to Junkoo Hea, Youngmo Kwon.
 */

module.exports = NmonWriter;

var mongojs = require('mongojs');

// TODO: remove nmdb environment. This is not realted to generic nmon-parser.js
// var nmdb = require('../config/nmdb-config.js');

/*
 * Initialize mongodb connection
 *
 * TODO: get mongodb URL from constructor;
 */
var  mongodb = mongojs(nmdb.env.NMDB_NMONDB_URL);

mongodb.on('error', function(err) {
    console.log('Nmon-db database error.', err);
});

mongodb.on('ready', function() {
    console.log('Nmon-db database connected.');
});

var nmondbCategories = mongodb.collection('nmon-categories'),
    nmondbMETA = mongodb.collection('nmon-meta'),
    nmondbZZZZ = mongodb.collection('nmon-perf'),
    nmondbUARG = mongodb.collection('nmon-uarg');

// Constructor
function NmonWriter(options) {
    // allow use without new
    if (!(this instanceof NmonWriter)) {
        return new NmonWriter(options);
    }

    // Nmon Writer instance variables
    this._bulk = [];
    this._bulk_unit = 1;
    this._header = [];
    this._headerWrited = false;

    if (typeof options['bulkUnit'] != 'undefined') 
        this._bulk_unit = parseInt( options['bulkUnit'] );
}

// TODO: DB error handling
NmonWriter.prototype.writeMETA = function(meta) {
    nmondbMETA.insert(meta);
}

// TODO: DB error handling
NmonWriter.prototype.writeUARG = function(uarg) {
    nmondbUARG.insert(uarg);
}

// TODO: DB error handling
//       header should be moved to parser
NmonWriter.prototype.addCategory = function(category) {
    this._header.push(category);
}

// TODO: DB error handling
NmonWriter.prototype.writeZZZZ = function(zzzz) {
    // Check whether header was written,
    // otherwise write header and set _headerWrite to true
    if (!this._headerWrited) {
        this._headerWrited = true;
        var bulkop = nmondbCategories.initializeOrderedBulkOp();
        for(var i = 0; i < this._header.length; i++)
            bulkop.find(this._header[i]).upsert().update({ $set: this._header[i]});

        bulkop.execute(function(err, res) {
            if (err)
                console.err(err.toString());
            this._header = [];
        });
    }

    this._bulk.push(zzzz);
    
    // for debug purpose
    console.log('Pushed host: ' + zzzz['host']
              + ', Snapframe: ' + zzzz['snapframe']
              + ', Keys: ' + Object.keys(zzzz).length
              + ', Bulk count: ' + this._bulk.length
              + ', Bulk Unit: ' + this._bulk_unit);
    console.log('     , Keys: ' + Object.keys(zzzz));
    // debug until here

    // flush writer if there is more data than bulk unit
    if ( this._bulk.length >= this._bulk_unit ) {
        this._flushSave();

        // clear _bulk buffer
        this._bulk = [];
        //console.log('this._bulk was cleared...');
    }
}

// Insert accumulated Nmon ZZZZ data
NmonWriter.prototype._flushSave = function() {
    //process.stdout.write('F');
    // store remained nmon data to mongo db
    if( this._bulk.length > 0 ) {
        var bulkop = nmondbZZZZ.initializeOrderedBulkOp();
        for(var i = 0; i < this._bulk.length; i++) {
            console.log('Insert #' + (i + 1) + ' item in _fluashSave()');
            bulkop.insert(this._bulk[i]);
        }

        // execute bulk operation to database
        bulkop.execute(function(err, res) {
            if (err)
                console.error(err.toString());
            else {
                console.log('Successful inserted item counts to db: ' + res['nInserted']);
            }
        });
    }
}
