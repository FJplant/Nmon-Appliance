/*
 * nmdb-config.js is
 *    an config file for nmon dashboard written in Node.js
 *   and written by ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 *
 *      since Aug 22, 2016
 * (c) All rights reserved to Youngmo Kwon
 */

// path module ======================================================================
var p = require('path');



// const environments
var NMDB_HOME = '/home/nmio/nmon.io/nmon-repo';
var NMDB_LOG_PATH = p.join(NMDB_HOME, 'logs');

// config/nmdb-config.js
// TODO:
//
module.exports = {
    'env' : {
	// NMDB_* - nmon-db component
	// MongoDB URL looks like 
	//   mongodb://<user>:<pass>@mongo.onmodulus.net:27017/Mikha4ot
        NMDB_HOME : NMDB_HOME,
        NMDB_LOG_PATH : NMDB_LOG_PATH,

        NMDB_USERDB_URL: 'mongodb://mongodb.fjint.com:27017/nmon-user',
        NMDB_USERDB_COLLECTION_SESSION: 'user-session',
        NMDB_NMONDB_URL: 'mongodb://mongodb.fjint.com:27017/nmon-db',
        NMDB_NMONDB_COLLECTION_PERFORMANCE: 'performance',
        NMDB_LISTEN_PORT: 6900,
        NMDB_WEB_PUBLIC:  '/web-static',
        NMDB_LOG_FILE: p.join(NMDB_LOG_PATH, 'nmdb-api.log'),
        NMDB_LOG_LEVEL: 'debug', 
        NMDB_GRAPH_ROW_NUMBER: 150.0,
        //NMDB_GRAPH_ROW_NUMBER: 1200.0,

        // file upload
        NMDB_UPLOAD_CSV_MAX_COUNT : 100,
        NMDB_UPLOAD_NMONDATA_MAX_COUNT : 500,

        NMDB_MONGO_BULKOP_SIZE: 20,   // size for ZZZZ batch processing unit

        // NMREP_* - nmon-rep component section
        NMREP_LISTEN_PORT: 6900,
        NMREP_LOG_FILE: p.join(NMDB_LOG_PATH, 'nmrep-api.log'),
        NMREP_LOG_LEVEL: 'debug',
        NMREP_PARSER_LOG_FILE: p.join(NMDB_LOG_PATH, 'nmrep-parser.log'),
        NMREP_PARSER_LOG_LEVEL: 'info',
        NMREP_PARSER_ZZZZ_LOG_FILE: p.join(NMDB_LOG_PATH, 'nmrep-parser-zzzz.log'),
        NMREP_PARSER_ZZZZ_LOG_LEVEL: 'info'
    }
};
