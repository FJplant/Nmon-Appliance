/*
 * aggregation.js is
 *    an elastic nmon-repo component written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *
 *      since Aug 12, 2015
 * (c) All rights reserved to Junkoo Hea.
 */

var conn = new Mongo();
var db = conn.getDB("nmon-db");

var dayMapper = function() {
    var dt = new Date(this.datetime);
    var d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    emit({datetime: d.getTime(), host: this.host}, this);
}

var monthMapper = function() {
    var dt = new Date(this._id.datetime);
    var d = new Date(dt.getFullYear(), dt.getMonth());
    emit({datetime: d.getTime(), host: this._id.host}, this.value);
}
    
var reducer = function(d, docs) {
    var result = {
        "DISK_ALL":{  
            "read":0,
            "write":0,
            "iops":0
        },
        "NET_ALL":{  
            "read":0,
            "write":0
        },
        "TOP":[  

        ],
        "CPU_ALL":{  
            "User":0,
            "Sys":0,
            "Wait":0,
            "CPUs":0
        },
        "MEM":{  
            "Real total":0,
            "Virtual total":0,
            "Real free":0,
            "Virtual free":0
        }
    };

    var commands = {};

    docs.forEach(function(doc) {
        result['DISK_ALL']['read'] += doc['DISK_ALL']['read'];
        result['DISK_ALL']['write'] += doc['DISK_ALL']['write'];
        result['DISK_ALL']['iops'] += doc['DISK_ALL']['iops'];
        result['NET_ALL']['read'] += doc['DISK_ALL']['read'];
        result['NET_ALL']['write'] += doc['DISK_ALL']['write'];
        result['CPU_ALL']['User'] += doc['CPU_ALL']['User'];
        result['CPU_ALL']['Sys'] += doc['CPU_ALL']['Sys'];
        result['CPU_ALL']['Wait'] += doc['CPU_ALL']['Wait'];
        result['CPU_ALL']['CPUs'] += doc['CPU_ALL']['CPUs'];
        result['MEM']['Real total'] += doc['MEM']['Real total'];
        result['MEM']['Virtual total'] += doc['MEM']['Virtual total'];
        result['MEM']['Real free'] += doc['MEM']['Real free'];
        result['MEM']['Virtual free'] += doc['MEM']['Virtual free'];
        for(var i = 0; i < doc['TOP'].length; i++) {
            var c = doc['TOP'][i];
            if ( c['Command'] in commands ) {
                commands[c['Command']]['%CPU'] += c['%CPU'];
                commands[c['Command']]['ResText'] += c['ResText'];
                commands[c['Command']]['ResData'] += c['ResData'];
                commands[c['Command']]['Count'] += 1;
            }
            else {
                commands[c['Command']] = { 
                    '%CPU': c['%CPU'], 
                    'ResText': c['ResText'], 
                    'ResData': c['ResData'],
                    'Command': c['Command'],
                    'Count': 1
                };
            }
        }
    });
    result['DISK_ALL']['read'] /= docs.length;
    result['DISK_ALL']['write'] /= docs.length;
    result['DISK_ALL']['iops'] /= docs.length;
    result['NET_ALL']['read'] /= docs.length;
    result['NET_ALL']['write'] /= docs.length;
    result['CPU_ALL']['User'] /= docs.length;
    result['CPU_ALL']['Sys'] /= docs.length;
    result['CPU_ALL']['Wait'] /= docs.length;
    result['CPU_ALL']['CPUs'] /= docs.length;
    result['MEM']['Real total'] /= docs.length;
    result['MEM']['Virtual total'] /= docs.length;
    result['MEM']['Real free'] /= docs.length;
    result['MEM']['Virtual free'] /= docs.length;
    var keys = Object.keys(commands);
    for(var i = 0; i < keys.length; i++) {
        commands[keys[i]]['%CPU'] /= commands[keys[i]]['Count'];
        commands[keys[i]]['ResText'] /= commands[keys[i]]['Count'];
        commands[keys[i]]['ResData'] /= commands[keys[i]]['Count'];
        result['TOP'].push(commands[keys[i]]);
    }
    return result;
};

// day stat
db.getCollection('nmon-perf').mapReduce(dayMapper, reducer, {out: 'nmon-stat_day'});

// month stat
db.getCollection('nmon-stat_day').mapReduce(monthMapper, reducer, {out: 'nmon-stat_month'});

