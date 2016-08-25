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

var util = require('util'),
    mongojs = require('mongojs');

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

var nmondbZZZZ = mongodb.collection('nmon-perf'),
    nmondbCategories = mongodb.collection('nmon-categories');

const Transform = require('stream').Transform;

// Constructor
function NmonWriter(options) {
    // allow use without new
    if (!(this instanceof NmonWriter)) {
        return new NmonWriter(options);
    }

    // init Transform
    Transform.call(this, options);

    // Nmon Writer instance variables
    this._bulk = [];
    this._bulk_unit = 1;
    this._header = [];
    this._headerWrited = false;

    if (typeof options['bulkUnit'] != 'undefined') 
        this._bulk_unit = parseInt( options['bulkUnit'] );
}
util.inherits(NmonWriter, Transform);

NmonWriter.prototype._transform = function(chunk, encoding, callback) {
    //process.stdout.write('t');
    if( chunk[0] === 'nmon-categories' ) {
        this._header.push(chunk[1]);
        callback();
    }
    else {
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

        // TODO: if is just workaround for bug which write only datetime. have to fix it.
        //       there is some case with only datetime like {"datetime":1472140248000}
//        var test = JSON.stringify(chunk[1]);
 //       if (test.length <= 30)
//            console.log(test);
//        if (test.length >= 30 ) {
//          // store data. main feature.
          this._bulk.push(chunk[1]);
//        }
        // workaround until here

        // flush writer if there is more data than bulk unit
        if ( this._bulk.length >= this._bulk_unit ) {
            this._flush(callback);
        }
        else {
            callback();
        }
    }
};

NmonWriter.prototype._flush = function(callback) {
    //process.stdout.write('F');
    // store remained nmon data to mongo db
    if( this._bulk.length > 0 ) {
        var bulkop = nmondbZZZZ.initializeOrderedBulkOp();
        for(var i = 0; i < this._bulk.length; i++) {
            bulkop.insert(this._bulk[i]);
        }

        bulkop.execute(function(err, res) {
            if (err)
                console.err(err.toString());

            this._bulk = [];      // clear _bulk buffer

            if (callback) {
                callback();
            }
        });
    }
    else { // if there is no data remained
        if(callback) {
            callback();
        }
    }
}
