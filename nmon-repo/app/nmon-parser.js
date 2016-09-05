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
    util = require('util');

// TODO: change nmdb environment. This is not realted to generic nmon-parser.js
var nmdb = require('../config/nmdb-config');

const Transform = require('stream').Transform;
const NmonWriter = require('./nmon-writer');
 
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
    // to preserve data storing order, list all AAA items in advance
    this._docAAA = {
        'nmon-data-id':'', 
        'database-version': '1.0',
        'insertdt': new Date(),
        'datetime':0, 
        'timezone':'UTC', // default to UTC
        'progname': '',
        'command': '',
        'version': '',
        'disks_per_line': 0,
        'max_disks': 0,
        'disks': 0,
        'host': '',
        'user': '',
        'OS': '',
        'runname': '',
        'time': '',
        'date': '',
        'interval': 0, 
        'snapshots': 0, 
        'cpus': 0,
        'x86': {},
        'proc_stat_variables': 0, 
        'note0': '',
        'note1': '',
        'note2': ''
    };

    // TODO: change to state machine notation
    this._isDocAAAInserted = false;
    this._docBBBP = [];
    this._docZZZZ = {};
    this._diskstats = [];
    this._netstats = [];
    this._rawHeader = {};
    this._cntTU = 0; // counter for parser log formatting

    // Options
    // NmonWriter
    this._writer = new NmonWriter({
        bulkUnit: options['bulkUnit']
    });

    // Logging 
    this._loggerParser = null;
    this._loglevelParser = 'info'; 
    this._loggerParserZZZZ = null;
    this._loglevelParserZZZZ = 'info';

    // Output
    this._output = 'db';
    this._outputfile = null;

    // Set log stream
    // Initilize parser log
    //     flags: 'a' - append mode
    if ( typeof options['logfile'] != 'undefined' )
        this._loggerParser =  fs.createWriteStream( options['logfile'], { flags: 'a' } );

    if ( typeof options['loglevel'] != 'undefined' )
        this._loglevelParser = options['loglevel'] 

    // Set zzzz log stream
    if ( typeof options['logfileZZZZ'] != 'undefined' )
        this._loggerParserZZZZ =  fs.createWriteStream( options['logfileZZZZ'], { flags: 'a' } );

    if ( typeof options['loglevelZZZZ'] != 'undefined' )
        this._loglevelParserZZZZ = options['loglevelZZZZ'] 

    // Set write mode
    if ( typeof options['output'] != 'undefined' ) {
        this._output = options['output'];
        console.log('output mode: ' + this._output);
        if (this._output === 'file') 
            this._outputfile = fs.createWriteStream( '_nmonparserfile.tmp', { flags: 'a' } );
    }
}
util.inherits(NmonParser, Transform);

// NmonParser.prototype._transform function
//   is callback funtion of Transform stream handler
NmonParser.prototype._transform = function(chunk, encoding, callback) {
    // Bug fix for: NMIO-208  CRLF problem for nmon file from windows
    // remove the '\r' from last last chunk data of nmon file from windows platform
    chunk[chunk.length - 1] = chunk[chunk.length - 1].replace('\r', '');

    if( chunk[0].substring(0, 3) === 'AAA' )                // Process AAA line
        this.parseNmonAAA(chunk);
    else if( chunk[0].substring(0, 4) === 'BBBP' )          // Process BBBP line
        this.parseNmonBBBP(chunk);
    else if (chunk[0].substring(0, 4) === 'ZZZZ' ) {        // Process ZZZZ line
        // if parser meets ZZZZ section 
        // insert AAA and BBB document once
        if ( !this._isDocAAAInserted ) {                    // if _docAAA was not assigned, assign _docAAA
            this._isDocAAAInserted = true;
            this._docAAA['BBBP'] = this._docBBBP;           // assign _docBBBP to _docAAA

            this._writer.writeMETA(this._docAAA);           // insert _docAAA to database
        }

        this.parseNmonZZZZ(chunk);
    }
    else if (chunk[0] === 'UARG' && chunk[1] != '+Time')    // Process UARG line
        this.parseNmonUARG(chunk);
    else                                                    // Process other perf log line CPUxxx, MEM, and so on
        this.parseNmonPerf(chunk);
    
    callback();  // last call for callback()

    // AIX SECTIONS ( Total 33 sections )
    // AAA
    // BBBB
    // BBBC
    // BBBD
    // BBBN
    // BBBP
    // BBBV
    // CPU_ALL
    // CPUxx
    // DISKBSIZEx
    // DISKBUSYx
    // DISKREADx
    // DISKRXFERx
    // DISKWRITEx
    // DISKXFERx
    // FILE
    // IOADAPT
    // JFSFILE
    // JFSINODE
    // LARGEPAGE
    // MEM
    // MEMNEW
    // MEMUSE
    // NET
    // NETERROR
    // NETPACKET
    // NETSIZE
    // PAGE
    // PROC
    // PROCAIO
    // TOP
    // UARG
    // ZZZZ
} // enf of NmonParser.prototype._transform 

NmonParser.prototype._flush = function(callback) {
    // Fix the bug: NMIO-158-nmon-data-parsing-nmon-perf
    // TODO: may be related to strange ZZZZ output log
    if (typeof this._docZZZZ['snapframe'] !== 'undefined') 
      this._flushSave(); 

    callback();
}

NmonParser.prototype._flushSave = function() {
    if (Object.keys(this._docZZZZ).length !== 0 ) {
        if (this._output === 'db') {
            this._writer.writeZZZZ(this._docZZZZ);
        }
        else if (this._output === 'file') {
            // log some periodic message
            console.log('ZZZZ section written: ' + this._docZZZZ['host']
                      + ', Snapframe: ' + this._docZZZZ['snapframe']
                      + ', Snaptime: ' + this._docZZZZ['snaptime']
                      + ', Keys: ' + Object.keys(this._docZZZZ).length);

            this._outputfile.write(JSON.stringify(this._docZZZZ));
        }
        else if (this._otuput === 'pipe')
            this.push(['performance', this._docZZZZ]);
    }
    else {
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

NmonParser.prototype.parseNmonAAA = function(chunk) {
    // Process lines which starts with 'AAA'
    //   'AAA' section is system generic information
    this.log('\n\033[1;34m[' + (new Date()).toLocaleTimeString() + ']-');
    this.log('['+ this._hostname + ':AAA]\033[m ' + chunk[1] + ',' + chunk[2] );
        
    if (chunk[1] === 'time') {
        var time = chunk[2];
        this._docAAA['time'] = time.replace(/\./gi,':');  // fix leading "." before seconds in linux nmon file             
    } 
    else if (chunk[1] === 'date') {
        this._docAAA['date'] = chunk[2];

        //console.log('date: ' + this._docAAA['date'] + ', time: ' + this._docAAA['time'] );

        // if parser meet AAA,date then, time field is already filled
        var beginDateTime = this._docAAA['date'] + ' ' + this._docAAA['time'];
        this._docAAA['datetime'] = new Date(beginDateTime);

        //console.log('beginDateTime: ' + beginDateTime + ', datetime: ' + (new Date(beginDateTime)).getTime());

        // TODO: change nmondataid generation policy
        this._nmondataid = this._docAAA['host'] + '$' + 
                           this._docAAA['date'] + '$' + 
                           this._docAAA['time'] + '$' + 
                           this._docAAA['timezone'] + '$' + 
                           this._docAAA['command']; 
        this._docAAA['nmon-data-id'] = this._nmondataid;
    }
    else if (chunk[1] === 'host') {
        this._hostname = chunk[2];
        // add host prefix to _nmondataid
            
        this._docAAA['host'] = chunk[2]; 
        // TODO: 1. support time zone manipulation
        if ( this._hostname === 'nmon-tokyo' )
            this._docAAA['timezone'] = 'UTC'; // TODO: this is temporary
        else 
            this._docAAA['timezone'] = 'KST'; // TODO: this is temporary
    }
    else if ( chunk[1] === 'max_disks' || chunk[1] === 'disks' ) 
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

NmonParser.prototype.parseNmonBBBP = function(chunk) {
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
    //    to write BBBP one line per one time then set isAggregatedBBBP = true;
    var isAggregatedBBBP = false;

    var bbbp = {};
    bbbp['seq'] = parseInt(chunk[1]);
    bbbp['item'] = chunk[2];
    bbbp['content'] = ( typeof chunk[3] === 'undefined' ) ? '' : chunk[3];

    if ( isAggregatedBBBP ) {
        if ((this._docBBBP.length > 0 ) &&
            //(typeof this._docBBBP[this._docBBBP.length - 1]['item'] !== 'undefined') &&
            (this._docBBBP[this._docBBBP.length - 1]['item'] === bbbp['item'])) {
            if (this._docBBBP[this._docBBBP.length - 1].content != '' ) 
                this._docBBBP[this._docBBBP.length - 1].content += '\n';

            // if meet same item, then just append it
            this._docBBBP[this._docBBBP.length - 1].content += bbbp['content'];
        }
        else {
            bbbp['content'] = '';
            this._docBBBP.push(bbbp);
        }
    } else    
      this._docBBBP.push(bbbp);

    this.log('\n\033[1;34m[' + (new Date()).toLocaleTimeString() + ']-');
    this.log('['+ this._hostname + ':' + chunk[0] + ':' + chunk[1] + ']\033[m ' + chunk[2] + ',' + chunk[3]);
}

NmonParser.prototype.parseNmonZZZZ = function(chunk) {
    // Process lines which starts with 'ZZZZ'
    //   'ZZZZ' section is a leading line for iterations of current resource utilization

    // flush previous ZZZZ section when we meet new ZZZZ
    // call flushSave when new 'ZZZZ' has arrived
    // this can be a blocker not sending current data until getting next ZZZZ
    // Fix the bug: NMIO-158-nmon-data-parsing-nmon-perf
    // TODO: may be related to strange ZZZZ output log
    if (typeof this._docZZZZ['snapframe'] !== 'undefined') 
      this._flushSave(); 

    if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' ) {
        this.logZZZZ('\n\n==========================================================');
        this.logZZZZ('\n---- Processing new ZZZZ section');
        this.logZZZZ('\n---- hostname: ' + this._hostname);
        this.logZZZZ('\n---- ' + chunk[0] + ',' + chunk[1] + ',' + chunk[2] + ',' + chunk[3]);
        this.logZZZZ('\n==========================================================');
    }

    // Initialize new document for mongodb
    this._docZZZZ = {};

    // Strange writing of only datetime is related to 
    // ordering of _flushSave() and following line
    this.log('\n\033[1;34m[' + (new Date()).toLocaleTimeString() + ']-');
    this.log('['+ this._hostname + ':ZZZZ:' + chunk[1] + ']\033[m ');
    this._docZZZZ['nmon-data-id'] = this._nmondataid;
    this._docZZZZ['insertdt'] = new Date();
    this._docZZZZ['host'] = this._hostname;

    //    chunk[2] - Time, 15:44:04
    //    chunk[3] - Date, 24-AUG-2046
    this._docZZZZ['snapframe'] = chunk[1]; // store T0001 ~ Txxxx
    this._docZZZZ['snapdate'] = chunk[3];  // store 24-AUG-2016 ( consider locale )
    this._docZZZZ['snaptime'] = chunk[2];  // store 15:49:13

    var snapDateTime = chunk[2] + ' ' + (typeof chunk[3] == "undefined" ? '1-JAN-1970' : chunk[3]);
    // TODO: 1. support time zone manipulation. temporary convert nmon-tokyo to KST ( UTC + 9 hours )
    this._docZZZZ['datetime'] = (this._docZZZZ['host'] === 'nmon-tokyo') ? 
                                    new Date((new Date(snapDateTime)).getTime() + 9*60*60*1000): 
                                    new Date(snapDateTime);

    // Initialize for db insert ordering 
    this._docZZZZ['CPU'] = [];
    this._docZZZZ['CPU_ALL'] = {};
    this._docZZZZ['MEM'] = {};
    this._docZZZZ['VM'] = {};
    this._docZZZZ['PROC'] = {};
    this._docZZZZ['NET'] = [];
    this._docZZZZ['NETPACKET'] = [];
    this._docZZZZ['DISKSTATS'] = [];
    this._docZZZZ['JFSFILE'] = {};
    this._docZZZZ['TOP'] = []; // store in array

    // initialize MEM_ALL, DISK_ALL, NET_ALL
    this._docZZZZ['MEM_ALL'] = {};
    this._docZZZZ['DISK_ALL'] = {};
    this._docZZZZ['NET_ALL'] = {};
        
    // reset _cntTU
    this._cntTU = 0;
}

NmonParser.prototype.parseNmonUARG = function(chunk) {
    // UARG only apear once when TOP meets a new process or already running process.
    // So, just write UARG to db whenever meet.

    var docUARG = {};

    docUARG['nmon-data-id'] = this._nmondataid;	// nmondataid to compare and search
    docUARG['insertdt'] = new Date();
    docUARG['host'] = this._hostname; // redundant but will be convenient 
    docUARG['snapframe'] = chunk[1];     // store T0001 ~ Txxxx
    docUARG['snapdate'] = this._docZZZZ['snapdate'];  // add redundant snapdate
    docUARG['snaptime'] = this._docZZZZ['snaptime'];  // add redundant snaptime
    docUARG['datetime'] = this._docZZZZ['datetime'];  // add redundant datetime

    docUARG['PID'] = parseInt(chunk[2]); // store process ID
    docUARG['Comand'] = chunk[3];        // store Command
    docUARG['FullCommand'] = chunk[4];   // store FullCommand 

    // just write to mongodb without bulk operation
    this._writer.writeUARG(docUARG);

    // write parser log
    this.log('U');
    if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' ) {
        this.logZZZZ('\n' + chunk[0] + ',' + chunk[1] + ',' + chunk[2] + ',' + chunk[3] + ',' + chunk[4]);
    }
    this._cntTU++;
}

// NmonParser.prototype.parseNmonPerf
//   - Entry point for Nmon perf section
//   - Calls parseNmonPerfHeader or parseNmonPefLog
NmonParser.prototype.parseNmonPerf = function(chunk) {
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
    if( chunk[0] in this._rawHeader )    // process Nmon Perf log
        this.parseNmonPerfLog(chunk);
    else 
        this.parseNmonPerfHeader(chunk); // process Nmon Perf header
}

// NmonParser.prototype.parseNmonPerfHeader
//   - parse nmon performance section's header
//   - process parsed data to maintain header
NmonParser.prototype.parseNmonPerfHeader = function(chunk) {
    // if found new row header, add it to categories
    if (!(chunk[0] === 'TOP' && chunk.length <= 2)) {   // if not a top first section which has only flag fields
        this._writer.addCategory({name: chunk[0]});
        this._rawHeader[chunk[0]] = chunk;
        
        // Initialize disk list. 
        // This is necessary because DISKSTSTS spans to multi rows. 
        if ( chunk[0] === 'DISKBUSY' ) { 
            for ( var i = 2; i < chunk.length; i++ ) {
                this._diskstats.push( {
                    'diskid' : chunk[i],
                    '%Busy' : 0.,
                    'ReadKB' : 0.,
                    'WriteKB' : 0.,
                    'tps' : 0.,
                    'BlockSize' : 0.
                } );
            }
        }
        else
        if ( chunk[0] === 'NET' ) { 
            var netadapter_cnt = (chunk.length - 3)/2;   // due to trailing , chunk.length -3 not -2
            this._netstats = [];   // initialize _netstats buffer
            for ( var i = 2; i < netadapter_cnt + 2; i++ ) {
                this._netstats.push( {
                    'adapter_id' : chunk[i].split('-')[0],
                    'read-KB/s' : 0.,
                    'write-KB/s' : 0.
                } );
            }
        }
        else
        if ( chunk[0] === 'NETPACKET' ) { 
            var netadapter_cnt = (chunk.length - 3)/2;   // due to trailing , chunk.length -3 not -2
            this._netstats = [];   // initialize _netstats buffer
            for ( var i = 2; i < netadapter_cnt + 2; i++ ) {
                this._netstats.push( {
                    'adapter_id' : chunk[i].split('-')[0],
                    'read/s' : 0.,
                    'write/s' : 0.
                } );
            }
        }
    }
}

// NmonParser.prototype.parseNmonPerfLog
//   - parse nmon performance section
//   - insert parsed data to database
NmonParser.prototype.parseNmonPerfLog = function(chunk) {
    var h = this._rawHeader[chunk[0]];
    var val = 0.0, iops = 0.0, 
        read = 0.0, write = 0.0, 
        readps = 0.0, writeps = 0.0;
    var fields = {};     // fields container
    var old_fields = {}; // old style fields container
    var logtype = '';

    // Assign log type to write log file
    if (chunk[0].substring(0,3) === 'CPU')
        logtype = 'C'; 
    else {
        switch (chunk[0]) {
            case 'CPU_ALL': logtype = 'A'; break;
            case 'MEM': logtype = 'M'; break;
            case 'VM': logtype = 'V'; break;
            case 'PROC': logtype = 'P'; break;
            case 'NET': logtype = 'N'; break;
            case 'NETPACKET': logtype = 'P'; break;
            case 'DISKBUSY': logtype = 'B'; break;
            case 'DISKREAD': logtype = 'R'; break;
            case 'DISKWRITE': logtype = 'W'; break;
            case 'DISKXFER': logtype = 'X'; break;
            case 'DISKBSIZE': logtype = 'B'; break;
            case 'JFSFILE': logtype = 'J'; break;
            case 'TOP': 
                logtype = 'T';
                this._cntTU++;
                break;
            default: logtype = '?'; break;
        }
    }

    this.log(logtype);
    if (nmdb.env.NMREP_PARSER_ZZZZ_LOG_LEVEL == 'verbose' )
        this.logZZZZ('\n' + chunk[0] + ',' + chunk[1] + ',');

    // line break for parser log 
    if ((h[0] === 'TOP' || h[0] === 'UARG') && this._cntTU % 80 == 0) {
        this.log('\n\033[1;34m[' + (new Date()).toLocaleTimeString() + ']-');
        this.log('['+ this._hostname + ':ZZZZ:' + 
                           ((h[0] === 'TOP')? chunk[2] : chunk[1]) + ']\033[m ');
    }

    // In case of Top, Add process ID
    if (h[0] === 'TOP')
        fields['PID'] = parseInt(chunk[1]);

    // In case of CPUXXXX, initilize CPU
    if (h[0].substring(0, 3) === 'CPU' && h[0] != 'CPU_ALL')
        fields['CPU#'] = chunk[0];

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
                else if (h[i] === 'Idle%')
                    fields['Idle%'] = parseFloat(chunk[i]);
                else if (h[i] === 'Busy') // Busy column has empty data for both of aix and linux
                    fields['Busy'] = -1;
                else if (h[i] === 'CPUs' || h[i] === 'PhysicalCPUs')
                    fields['CPUs'] = parseFloat(chunk[i]);
            }
            else if (h[0].substring(0, 3) === 'CPU') {
                if (h[i] === 'User%')
                    fields['User%'] = parseFloat(chunk[i]);
                else if (h[i] === 'Sys%')
                    fields['Sys%'] = parseFloat(chunk[i]);
                else if (h[i] === 'Wait%')
                    fields['Wait%'] = parseFloat(chunk[i]);
                else if (h[i] === 'Idle%')
                    fields['Idle%'] = parseFloat(chunk[i]);
            }
            else if (h[0] === 'MEM') {
                // Store all original fields first
                fields[h[i]] = parseFloat(chunk[i]) + .0;

                // Remove following lines after fixing nmdb-api
                // second condition is for AIX nmon data file 
                if (h[i] === 'memtotal' || h[i] === 'Real total(MB)')
                    old_fields['Real total'] = parseFloat(chunk[i]);
                else if (h[i] === 'memfree' || h[i] === 'Real free(MB)')
                    old_fields['Real free'] = parseFloat(chunk[i]);
                else if (h[i] === 'swaptotal' || h[i] === 'Virtual total(MB)')
                    old_fields['Virtual total'] = parseFloat(chunk[i]);
                else if (h[i] === 'swapfree' || h[i] === 'Virtual free(MB)')
                    old_fields['Virtual free'] = parseFloat(chunk[i]);
            }
            else if (h[0] === 'VM' || h[0] === 'PROC') {
                fields[h[i]] = parseInt(chunk[i]);
            }
            else if (h[0] === 'NET') {
                if( h[i].indexOf('read') != -1 ) {
                    var adapter_idx = i - 2;
                    this._netstats[adapter_idx]['read/s'] = parseFloat(chunk[i]);

                    read += parseFloat(chunk[i]);
                }
                else if( h[i].indexOf('write') != -1) {
                    var adapter_idx = (i - 2) - this._netstats.length;
                    this._netstats[adapter_idx]['write/s'] = parseFloat(chunk[i]);
                    
                    write += parseFloat(chunk[i]);
                }
            }
            else if (h[0] === 'NETPACKET') {
                if( h[i].indexOf('read/s') != -1 ) {
                    var adapter_idx = i - 2;
                    this._netstats[adapter_idx]['read/s'] = parseFloat(chunk[i]);
                }
                else if( h[i].indexOf('write/s') != -1) {
                    var adapter_idx = (i - 2) - this._netstats.length;
                    this._netstats[adapter_idx]['write/s'] = parseFloat(chunk[i]);
                }
            }
            //       have to index (i-2) to _diskstats because here is more column before real data
            else if (h[0].indexOf("DISKBUSY")== 0 && h[i].match(/.+\d*$/)) {
                this._diskstats[i-2]['%Busy'] = parseFloat(chunk[i]);
            }
            else if (h[0].indexOf("DISKREAD")== 0 && h[i].match(/.+\d*$/)) {
                this._diskstats[i-2]['ReadKB'] = parseFloat(chunk[i]);

                val += parseFloat(chunk[i]);
            }
            else if (h[0].indexOf("DISKWRITE")== 0 && h[i].match(/.+\d*$/)) {
                this._diskstats[i-2]['WriteKB'] = parseFloat(chunk[i]);

                val += parseFloat(chunk[i]);
            }
            else if (h[0].indexOf("DISKXFER")== 0 && h[i].match(/.+\d*$/)) {
                this._diskstats[i-2]['tps'] = parseFloat(chunk[i]);
            }
            else if (h[0].indexOf("DISKBSIZE")== 0 && h[i].match(/.+\d*$/)) {
                this._diskstats[i-2]['BlockSize'] = parseFloat(chunk[i]);
            }
            else if (h[0].indexOf("JFSFILE")== 0) {
                fields[h[i]] = parseFloat(chunk[i]);
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

    // write to _docZZZZ
    if (Object.keys(fields).length !== 0) {
        if (h[0].substring(0, 3) === 'CPU' && h[0] !== 'CPU_ALL')
            this._docZZZZ['CPU'].push(fields);
        else if (h[0] === 'TOP')
            this._docZZZZ['TOP'].push(fields);
        else if (h[0] === 'MEM') {
            this._docZZZZ['MEM'] = fields;
            this._docZZZZ['MEM_ALL'] = old_fields;
        }
        else
            this._docZZZZ[h[0]] = fields;
    }

    if (h[0] === 'DISKBSIZE')         // set disk stats
        this._docZZZZ['DISKSTATS'] = this._diskstats;

    // Set summary data
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
        this._docZZZZ['NET'] = this._netstats;

        // TODO: remove folllowing lines after chaning logic
        this._docZZZZ['NET_ALL']['recv'] = read;
        this._docZZZZ['NET_ALL']['send'] = write;
    }
    else if (h[0] === 'NETPACKET') {
        this._docZZZZ['NETPACKET'] = this._netstats;
    }
    // end of set summary data
}
