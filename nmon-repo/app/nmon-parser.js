/*
 * nmon-parser.js is
 *    an nmon parser class written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com )
 *
 *      since Aug 12, 2015
 * (c)2015,2016 All rights reserved to Junkoo Hea, Youngmo Kwon.
 */

module.exports = NmonParser;

var fs = require('fs'),
    util = require('util'),
    mongojs = require('mongojs');

// TODO: remove nmdb environment. This is not realted to generic nmon-parser.js
var nmdb = require('../config/nmdb-config.js');

/*
 * Initialize mongodb connection
 *
 * TODO: get mongodb URL from constructor;
 */
var  mongodb = mongojs(nmdb.env.NMDB_NMONDB_URL);
mongodb.on('error', function(err) {
    log.info('Nmon-db database error.', err);
});

mongodb.on('ready', function() {
    log.info('Nmon-db database connected.');
});

var nmondbMETA = mongodb.collection('nmon-meta'),
    nmondbZZZZ = mongodb.collection('nmon-perf'), // used after refactoring
    nmondbUARG = mongodb.collection('nmon-uarg');

const Transform = require('stream').Transform;
 
function NmonParser(options) {
    // allow use without new
    if (!(this instanceof NmonParser)) {
        return new NmonParser(options);
    }

    // init Transform
    Transform.call(this, options);

    // NmonParser Instance variables
    this._hostname = '* N/A *';

    this._nmondataid = null;
    this._docAAA = {'nmon-data-id':'', 'date':'', 'time':'', 'datetime':0, 'timezone':'', 
                    'interval':9999, 'snapshots':9999, 'x86': {} };
    // TODO: change to state machine notation
    this._isDocAAAInserted = false;
    this._docBBBP = [];
    this._docZZZZ = {};
    this._rawHeader = {};
    this._cnt = 0;
    this._diskTotal = {};
    this._cntTU = 0;

    // Logging 
    this._loggerParser = null;
    this._loglevelParser = 'info'; 
    this._loggerParserZZZZ = null;
    this._loglevelParserZZZZ = 'info';

    // Set log stream
    // Initilize parser log
    //     flags: 'a' - append mode
    if ( typeof options['logfile'] != 'undefined' ) {
        this._loggerParser =  fs.createWriteStream( options['logfile'], { flags: 'a' } );
    }
    if ( typeof options['logfileZZZZ'] != 'undefined' )
        this._loggerParserZZZZ =  fs.createWriteStream( options['logfileZZZZ'], { flags: 'a' } );

    // Set log level
    if ( typeof options['loglevel'] != 'undefined' )
        this._loglevelParser = options['loglevel'] 
    if ( typeof options['loglevelZZZZ'] != 'undefined' )
        this._loglevelParserZZZZ = options['loglevelZZZZ'] 
}
util.inherits(NmonParser, Transform);

// NmonParser _transform function
//
NmonParser.prototype._transform = function(chunk, encoding, callback) {
    var now = new Date();

    if( chunk[0].substring(0, 3) === 'AAA' ) {
        // Process lines which starts with 'AAA'
        //   'AAA' section is system generic information
        this.log('\n\033[1;34m[' + now.toLocaleTimeString() + ']-');
        this.log('['+ this._hostname + ':AAA]\033[m ' + chunk[1] + ',' + chunk[2] );
            
        // TODO: change nmondataid generation policy
        if (chunk[1] === 'date') {
            this._docAAA['date'] = chunk[2]
            this._nmondataid = this._docAAA['host'] + '$' + 
                               this._docAAA['date'] + '$' + 
                               this._docAAA['time'] + '$' + 
                               this._docAAA['timezone'] + '$' + 
                               this._docAAA['command']; 
            this._docAAA['nmon-data-id'] = this._nmondataid;
        }

        if (chunk[1] === 'host') {
            this._hostname = chunk[2];
            // add host prefix to _nmondataid
                
            // TODO: 1. support time zone manipulation
            if ( this._hostname === 'nmon-tokyo' )
                this._docAAA['timezone'] = 'UTC'; // TODO: this is temporary
            else 
                this._docAAA['timezone'] = 'KST'; // TODO: this is temporary
        }

        if ( chunk[1] === 'max_disks' || chunk[1] === 'disks' ) 
            this._docAAA[chunk[1]] = parseInt(chunk[2]) +',' + chunk[3];
        else if ( chunk[1] === 'OS' )
            this._docAAA[chunk[1]] = chunk[2] +',' + chunk[3] + chunk[4];
        else if ( chunk[1] === 'x86' ) {
            if ( chunk[2] === 'MHz' || chunk[2] === 'bogomips' )
                this._docAAA['x86'][chunk[2]] = parseFloat(chunk[3]);
            else if ( chunk[2] === 'ProcessorChips' || chunk[2] === 'Cores' 
                   || chunk[2] === 'hyperthreads' || chunk[2] === 'VirtualCPUs')
                this._docAAA['x86'][chunk[2]] = parseInt(chunk[3]);
            else  
                this._docAAA['x86'][chunk[2]] = chunk[3];
        }
        else if ( chunk[1] === 'interval' || chunk[1] === 'snapshots' || chunk[1] === 'disks_per_line' 
               || chunk[1] === 'cpus' || chunk[1] === 'proc_stat_variables' )
            this._docAAA[chunk[1]] = parseInt(chunk[2]);
        else 
            this._docAAA[chunk[1]] = chunk[2];
    }
    else if( chunk[0].substring(0, 4) === 'BBBP' ) {
        // TODO: AIX BBB section
        // Process lines which starts with 'BBB'
        //   for AIX
        //   'BBBB' and 'BBBC' line has system component configurations
        //   'BBBV' line has volume configurations
        //   'BBBN' line has network configurations
        //   'BBBD' line has Disk Adapter Information
        //   'BBBP' line has result of system command like lsconf, lsps, lparstat, emstat, no,
        //          mpstat, vmo, ioo and so on.

            
        // BBBP section 
        //    linux only supports BBBP section
        if ( this._docAAA['datetime'] == 0 ) { 
            var beginDateTime = this._docAAA['date'] + ' ' + this._docAAA['time'];
            this._docAAA['datetime'] = (new Date(beginDateTime)).getTime();
        }

        var bbbp = {};
        bbbp['seq'] = parseInt(chunk[1]);
        bbbp['item'] = chunk[2];
        bbbp['content'] = ( typeof chunk[3] === 'undefined' ) ? '' : chunk[3];
        this._docBBBP.push(bbbp);
            
        this.log('\n\033[1;34m[' + now.toLocaleTimeString() + ']-');
        this.log('['+ this._hostname + ':' + chunk[0] + ':' + chunk[1] + ']\033[m ' + chunk[2] + ',' + chunk[3]);
    }
    else if (chunk[0].substring(0, 4) === 'ZZZZ' ) {
        // if parser meets ZZZZ section 
        // insert AAA and BBB document once
        if ( !this._isDocAAAInserted ) {
            //    chunk[2] - Time, 15:44:04
            //    chunk[3] - Date, 24-AUG-2046
            var beginDateTime = chunk[2] + ' ' + (typeof chunk[3] == "undefined" ? '1-JAN-1970' : chunk[3]);
            this._docZZZZ['datetime'] = (new Date(beginDateTime)).getTime();
            this._docAAA['BBBP'] = this._docBBBP;

            nmondbMETA.insert(this._docAAA);
            this._isDocAAAInserted = true;
        }

        // Process lines which starts with 'ZZZZ'
        //   'ZZZZ' section is a leading line for iterations of current resource utilization
        this._flushSave(); // call flushSave when new 'ZZZZ' has arrived
                           // this can be a blocker not sending current data until getting next ZZZZ

        this.log('\n\033[1;34m[' + now.toLocaleTimeString() + ']-');
        this.log('['+ this._hostname + ':ZZZZ:' + chunk[1] + ']\033[m ');

        if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' ) {
            this.logZZZZ('\n\n==========================================================\n');
            this.logZZZZ('---- Processing new ZZZZ section\n');
            this.logZZZZ('hostname: ' + this._hostname);
            this.logZZZZ('---- ' + chunk[0] + ',' + chunk[1] + ',' + chunk[2] + ',' + chunk[3] + '\n');
            this.logZZZZ('==========================================================');
        }

        // Initialize new document for mongodb
        this._docZZZZ = {};
        this._docZZZZ['nmon-data-id'] = this._nmondataid;
        this._docZZZZ['host'] = this._hostname;
        this._docZZZZ['snapframe'] = chunk[1]; // store T0001 ~ Txxxx
        this._docZZZZ['snapdate'] = chunk[3];  // store 24-AUG-2016 ( consider locale )
        this._docZZZZ['snaptime'] = chunk[2];  // store 15:49:13

        //    chunk[2] - Time, 15:44:04
        //    chunk[3] - Date, 24-AUG-2046
        var snapDateTime = chunk[2] + ' ' + (typeof chunk[3] == "undefined" ? '1-JAN-1970' : chunk[3]);
        // TODO: 1. support time zone manipulation. temporary convert nmon-tokyo to KST ( UTC + 9 hours )
        this._docZZZZ['datetime'] = (this._docZZZZ['host'] === 'nmon-tokyo') ? 
                                        (new Date(snapDateTime)).getTime() + 9*60*60*1000 : 
                                        (new Date(snapDateTime)).getTime();
        this._docZZZZ['DISK_ALL'] = {};
        this._docZZZZ['NET_ALL'] = {};
        this._docZZZZ['TOP'] = []; // store in array
            
        this._cntTU = 0;
    }
    else if (chunk[0] === 'UARG' && chunk[1] != '+Time') {
        // UARG only apear once when TOP meets a new process or already running process.
        // So, just write UARG to db whenever meet.

        var docUARG = {};

        docUARG['nmon-data-id'] = this._nmondataid;	// nmondataid to compare and search
        docUARG['host'] = this._hostname; // redundant but will be convenient 
        docUARG['snapframe'] = chunk[1];     // store T0001 ~ Txxxx
        docUARG['snapdate'] = this._docZZZZ['snapdate'];  // add redundant snapdate
        docUARG['snaptime'] = this._docZZZZ['snaptime'];  // add redundant snaptime
        docUARG['datetime'] = this._docZZZZ['datetime'];  // add redundant datetime

        docUARG['PID'] = parseInt(chunk[2]); // store process ID
        docUARG['Comand'] = chunk[3];        // store Command
        docUARG['FullCommand'] = chunk[4];   // store FullCommand 

        // just write to mongodb without bulk operation
        nmondbUARG.insert(docUARG);

        // write parser log
        this.log('U');
        if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' ) {
            this.logZZZZ('\n' + chunk[0] + ',' + chunk[1] + ',' + chunk[2] + ',' + chunk[3] + ',' + chunk[4]);
        }
        this._cntTU++;
    }
    else {
        // Processing lines wich not starts with 'AAA', 'BBB', 'ZZZ'
        //   for AIX: 
        //     'CPU_ALL', 'CPUxx': 
        //     'MEM', 'MEMNEW', 'MEMUSE', 'PAGE', 'LARGEPAGE':
        //     'PROC','PROCAIO':
        //     'FILE':
        //     'NET', 'NETPACKET', 'NETSIZE', 'NETERROR':
        //     'DISKBUSY', 'DISKREAD', 'DISKWRITE', 'DISKXFER', 'DISKRXFER', 'DISKBSIZE':
        //     'IOADAPT':
        //     'JFSFILE': Journal file information
        //     'TOP':  process information
        //     'UARG': user process command parameter and informations
        if( chunk[0] in this._rawHeader ) {
            var h = this._rawHeader[chunk[0]];
            var val = 0.0, iops = 0.0, read = 0.0, write = 0.0;
            var fields = {}; // fields container
            var logtype = '';

            // Log type
            switch (chunk[0]) {
                case 'CPU_ALL': logtype = 'C'; break;
                case 'MEM': logtype = 'M'; break;
                case 'NET': logtype = 'N'; break;
                case 'DISKREAD': logtype = 'R'; break;
                case 'DISKWRITE': logtype = 'W'; break;
                case 'DISKXFER': logtype = 'w'; break;
                case 'TOP': 
                    logtype = 'T';
                    this._cntTU++;
                    break;
                default: logtype = '?'; break;
            };

            this.log(logtype);
            if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' )
                this.logZZZZ('\n' + chunk[0] + ',' + chunk[1] + ',');

            // line break for parser log 
            if ((h[0] === 'TOP' || h[0] === 'UARG') && this._cntTU % 80 == 0) {
                this.log('\n\033[1;34m[' + now.toLocaleTimeString() + ']-');
                this.log('['+ this._hostname + ':ZZZZ:' + 
                                   ((h[0] === 'TOP')? chunk[2] : chunk[1]) + ']\033[m ');
            }

            // In case of Top, Add process ID
            if (h[0] === 'TOP')
                fields['PID'] = parseInt(chunk[1]);

            // Iterate all columns
            for( var i = 2; i < h.length; i++ ) {
                if(h[i] !== '') {
                    if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' ) {
                        this.logZZZZ(chunk[i]);

                        if (i < h.length-1) this.logZZZZ(',');
                    }

                    if (h[0] === 'CPU_ALL') {
                        if (h[i] === 'User%')
                            fields['User'] = parseFloat(chunk[i]);
                        else if (h[i] === 'Sys%')
                            fields['Sys'] = parseFloat(chunk[i]);
                        else if (h[i] === 'Wait%')
                            fields['Wait'] = parseFloat(chunk[i]);
                        else if (h[i] === 'CPUs' || h[i] === 'PhysicalCPUs')
                            fields['CPUs'] = parseFloat(chunk[i]);
                    }
                    else if (h[0] === 'MEM') {
                        if (h[i] === 'memtotal' || h[i] === 'Real total(MB)')
                            fields['Real total'] = parseFloat(chunk[i]);
                        else if (h[i] === 'memfree' || h[i] === 'Real free(MB)')
                            fields['Real free'] = parseFloat(chunk[i]);
                        else if (h[i] === 'swaptotal' || h[i] === 'Virtual total(MB)')
                            fields['Virtual total'] = parseFloat(chunk[i]);
                        else if (h[i] === 'swapfree' || h[i] === 'Virtual free(MB)')
                            fields['Virtual free'] = parseFloat(chunk[i]);
                    }
                    else if (h[0] === 'NET') {
                        if( h[i].indexOf('read') != -1 )
                            read += parseFloat(chunk[i]);
                        else if( h[i].indexOf('write') != -1)
                            write += parseFloat(chunk[i]);

                    }
                    else if ((h[0].indexOf("DISKREAD")== 0 || h[0].indexOf("DISKWRITE")== 0) && h[i].match(/.+\d+$/)) {
                        val += parseFloat(chunk[i]);
                    }
                    else if (h[0].indexOf("DISKXFER")== 0 && h[i].match(/.+\d+$/)) {
                        iops += parseFloat(chunk[i]);
                    }
                    else if (h[0] === 'TOP') {
                        // skip T0001 - T0001 has total time after boot
                        // TODO: process T0001 snap frame
                        if (chunk[2] !== 'T0001') {
                            if (h[0] === 'TOP') {
                                switch ( h[i] ) {
                                    case 'Command': 
                                        fields[h[i]] = chunk[i]; 
                                        break;
                                    case '%CPU':
                                    case '%Usr':
                                    case '%Sys':
                                        fields[h[i]] = parseFloat(chunk[i]);
                                        break;
                                    case 'Size':
                                    case 'ResSet':
                                    case 'ResText':
                                    case 'ResData':
                                    case 'ShdLib':
                                    case 'MinorFault':
                                    case 'MajorFault':
                                        fields[h[i]] = parseInt(chunk[i]);
                                        break;
                                }
                            }
                        }
                    }
                } // end of if
            } // end of for

            if (Object.keys(fields).length !== 0) {
                if (h[0] === 'TOP')
                    this._docZZZZ[h[0]].push(fields);
                else
                    this._docZZZZ[h[0]] = fields;
            }

            if( h[0] === 'DISKREAD' ) {
                this._docZZZZ['DISK_ALL']['read'] = val;
            }
            else if (h[0] === 'DISKWRITE') {
                this._docZZZZ['DISK_ALL']['write'] = val;
            }
            else if (h[0] === 'DISKXFER') {
                this._docZZZZ['DISK_ALL']['iops'] = iops;
            }
            else if (h[0] === 'NET') {
                this._docZZZZ['NET_ALL']['read'] = read;
                this._docZZZZ['NET_ALL']['write'] = write;
            }
        }
        else {
            if (!(chunk[0] === 'TOP' && chunk.length <= 2)) {
                this.push(['nmon-categories', {name :chunk[0]}]);
                this._rawHeader[chunk[0]] = chunk;
            }
        }
    }
    callback();
} // enf of NmonParser.prototype._transform 

NmonParser.prototype._flush = function(callback) {
    this._flushSave();
    callback();
}

NmonParser.prototype._flushSave = function() {
    // temporal workaround 
    if (Object.keys(this._docZZZZ).length > 2 ) {
    //if (Object.keys(this._docZZZZ).length !== 0 ) {
        this.push(['nmon-perf', this._docZZZZ]);
        this._cnt++;
        //loggerParser.stdout.write('f');
        if (this._cnt % 80 == 0)
            this.log('\n');
    } else {
        console.error('Strange _docZZZZ occurred: '  + JSON.stringify(this._docZZZZ));
    }
}

// Log helper function
NmonParser.prototype.log = function(msg) {
    if ( this._loggerParser != null )
        this._loggerParser.write(msg);
}

// Log helper function for ZZZZ section
NmonParser.prototype.logZZZZ = function(msg) {
    if ( this._loggerParserZZZZ != null )
        this._loggerParserZZZZ.write(msg);
}
