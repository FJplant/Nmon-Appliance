/*
 * nmon-server.js is
 *    an startup file kf nmon-repo component written in Node.js
 *   and written by amoriya ( Junkoo Hea, junkoo.hea@gmail.com )
 *                  ymk     ( Youngmo Kwon, youngmo.kwon777@gmail.com ) 
 *
 *      since Aug 12, 2015
 * (c) All rights reserved to Junkoo Hea, Youngmo Kwon
 */

// set up ======================================================================
// initialize cluster
var cluster = require('cluster'),       // to manage multi process
    os = require('os'),                 // to get CPU informations
    winston = require('winston');

/*
 * Initialize winston logger
 */
var log = new (winston.Logger)({
    transports: [
        new (winston.transports.File)({ filename: 'logs/nmon-db.log', level: 'debug' }),
    ]
});

/*
 * Calculate cluster parameter
 */
var cpus = os.cpus(); // Get CPU informations
var worker_cnt = Math.trunc( cpus.length * 1.5 ); // # of Worker process = 2 * CPU count
//var worker_cnt = 1; // test purpuse
//var worker_cnt = cpus.length;     // # of Worker process = CPU count, for development purpose

/*
 * Fork worker process and listen service
 */
if (cluster.isMaster) {
    log.info('CPU lists:');
    for (var i=0; i< cpus.length; i++)
        log.info('CPU #%d: %s', i, cpus[i].model);

    log.info('Spawning %d worker process', worker_cnt);

    for (var i=0; i < worker_cnt; i+=1) {
        cluster.fork();
    }
    log.info('Server running at http://localhost:6900');

    // Listen for dying workers
    cluster.on('exit', function(worker) {
        // Replace the dead worker
        log.info('Worker %d died... :( respawining... ', worker.id);
        cluster.fork();
    });
} else {
    // get all the tools we need
    var express  = require('express');
    var port     = process.env.PORT || 6900;
    var mongoose = require('mongoose');
    var passport = require('passport');
    var flash    = require('connect-flash');

    var session      = require('express-session');
    var MongoStore   = require('connect-mongo')(session);
    var morgan       = require('morgan');
    var cookieParser = require('cookie-parser');
    var bodyParser   = require('body-parser');

    // load database configuration
    var configDB = require('./config/database.js');

    // instanciate express 
    var app      = express();

    // configuration ===============================================================
    mongoose.connect(configDB.url); // connect to our database

    require('./config/passport')(passport); // pass passport for configuration

    // set up our express application
    app.use(morgan('dev')); // log every request to the console
    app.use(cookieParser('NMCRE7')); // read cookies (needed for auth)
    app.use(bodyParser.urlencoded({ extended: true })); // get information from html forms

    app.engine('html', require('ejs').renderFile);

    app.set('view engine', 'ejs'); // set up ejs for templating
    app.set('view engine', 'html'); // set up tiny html viewer
    // required for passport
    app.use(session({ 
       key: 'app-nmdb.sess', 
       secret: 'SekretCodeForNMdb',
       proxy: true,
       resave: true,
       saveUninitialized: true,
       store: new MongoStore({
           // TODO: move to configuration file 
           url: 'mongodb://mongodb.fjint.com:27017/nmon-user',
           collection: 'user-session'
       })
    })); // session secret
    app.use(passport.initialize());
    app.use(passport.session()); // persistent login sessions
    app.use(flash()); // use connect-flash for flash messages stored in session

    // Add static page directory
    app.use(express.static(__dirname + '/web-static'));

    // Add bower component directory
    app.use('/bower_components',  express.static(__dirname + '/bower_components'));
    
    // routes ======================================================================
    // load our routes and pass in our app and fully configured passport
    require('./app/nmon-routes.js')(app, passport); 
    // nmon-repo ===================================================================
    // load nmon-repo module
    require('./app/nmon-repo.js')(app, passport, log);

    //
    // launch ======================================================================
    app.listen(port);
    console.log('The magic happens on port ' + port);
}