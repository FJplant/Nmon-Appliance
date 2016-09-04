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
    console.log('nmon-writer.js: database error.', err);
});

mongodb.on('connect', function() {
    console.log('nmon-writer.js: database connected.');
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
                console.error(err.toString());
            this._header = [];
        });
    }

    this._bulk.push(zzzz);
    
    // for debug purpose
    if (this._bulk_unit == 1 || (this._bulk_unit > 1 && this._bulk.length >= this._bulk_unit)) {
        console.log('Pushed host: ' + zzzz['host']
                  + ', Snapframe: ' + zzzz['snapframe']
                  + ', Snaptime: ' + zzzz['snaptime']
                  + ', Keys: ' + Object.keys(zzzz).length
                  + ', Bulk Unit: ' + this._bulk_unit
                  + ', Document count: ' + this._bulk.length);
        //console.log('     , Keys: ' + Object.keys(zzzz));
    }
    // debug until here

    // flush writer if there is more data than bulk unit
    if (this._bulk.length >= this._bulk_unit) {
        // save the accumulated _bulk
        this._flushSave();

        // clear _bulk buffer
        this._bulk = [];
        //console.log('this._bulk was cleared...');
    }
}

// Insert accumulated Nmon ZZZZ data
// TODO: bulkop operation have some bug when bulk unit is big
NmonWriter.prototype._flushSave = function() {
    //process.stdout.write('F');
    // store remained nmon data to mongo db
    if( this._bulk.length > 0 ) {
        var bulkop = nmondbZZZZ.initializeOrderedBulkOp();
        for(var i = 0; i < this._bulk.length; i++) {
            //console.log('Item #' + (i + 1) + ' inserted to bulkop in_fluashSave()');
            bulkop.insert(this._bulk[i]);
        }

        console.log('Execute bulk operation to database: ' + this._bulk.length + ' items');

        // execute bulk operation to database
        bulkop.execute(function(err, res) {
            if (err) {
                console.error('MongoDB erorr while operating with error: ');
                // this._bulk[0] is out OUT of scope, so find other way
                //console.error('ZZZZ from: ' + this._bulk[0]['host'] + ', '  + this._bulk[0]['snapframe'])
                //console.error('      ,to: ' + this._buik[this._bulk.length - 1]['host'] + ', ' 
                //                            + this._bulk[this._bulk.length - 1]['snapframe']);
                console.error(err.toString());
            }
            else {
                //console.log('Successful inserted item counts to db: ' + res['nInserted']);
            }
        });
    }
}
