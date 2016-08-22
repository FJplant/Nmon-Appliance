/*
 * nmdb-config.js is
 *    an config file for nmon dashboard written in Node.js
 *   and written by ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 *
 *      since Aug 22, 2016
 * (c) All rights reserved to Youngmo Kwon
 */

// set up ======================================================================
// initialize cluster
var p = require('path');

// config/nmdb-config.js
module.exports = {
    'env' : {
	// NMDB_* - nmon-db component
	// MongoDB URL looks like 
	//   mongodb://<user>:<pass>@mongo.onmodulus.net:27017/Mikha4ot
        NMDB_USERDB_URL: 'mongodb://mongodb.fjint.com:27017/nmon-user',
        NMDB_USERDB_COLLECTION_SESSION: 'user-session',
        NMDB_LISTEN_PORT: 6900,
        NMDB_WEB_PUBLIC:  '/web-static',

        // NMREP_* - nmon-rep component section
        NMREP_LISTEN_PORT: 6900
    }
};
