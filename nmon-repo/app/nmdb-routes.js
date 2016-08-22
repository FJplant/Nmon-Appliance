// app/routes.js
module.exports = function(app, passport) {

    // =====================================
    // HOME PAGE (with login links) ========
    // =====================================
    app.get('/', function(req, res) {
        res.redirect('/nmon-db/v1/');
    });

    app.get('/nmon-db/v1/', function(req, res) {
        res.render('index.ejs'); // load the index.ejs file
    });

    // =====================================
    // LOGIN ===============================
    // =====================================
    // show the login form
    app.get('/nmon-db/v1/login', function(req, res) {

        // render the page and pass in any flash data if it exists
        res.render('login.ejs', { message: req.flash('loginMessage') });
    });

    // process the login form
    app.post('/nmon-db/v1/login', passport.authenticate('local-login', {
        //successRedirect : '/profile', // redirect to the secure profile section
        successRedirect : '/nmon-db/v1/main', // redirect to the secure nmon-db section
        failureRedirect : '/nmon-db/v1/login', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));

    // =====================================
    // SIGNUP ==============================
    // =====================================
    // show the signup form
    app.get('/nmon-db/v1/signup', function(req, res) {

        // render the page and pass in any flash data if it exists
        res.render('signup.ejs', { message: req.flash('signupMessage') });
    });

    // process the signup form
    app.post('/nmon-db/v1/signup', passport.authenticate('local-signup', {
        successRedirect : '/nmon-db/v1/profile', // redirect to the secure profile section
        failureRedirect : '/nmon-db/v1/signup', // redirect back to the signup page if there is an error
        failureFlash : true // allow flash messages
    }));

    // =====================================
    // PROFILE SECTION =========================
    // =====================================
    // we will want this protected so you have to be logged in to visit
    // we will use route middleware to verify this (the isLoggedIn function)
    app.get('/nmon-db/v1/profile', isLoggedIn, function(req, res) {
        res.render('profile.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

        // =====================================
        // FACEBOOK ROUTES =====================
        // =====================================
        // route for facebook authentication and login
        app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));

        // handle the callback after facebook has authenticated the user
        app.get('/auth/facebook/callback',
            passport.authenticate('facebook', {
                successRedirect : '/nmon-db/v1/profile',
                failureRedirect : '/'
            }));

        // =====================================
        // LOGOUT ==============================
        // =====================================
    app.get('/nmon-db/v1/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

    // Add url -> file mappings
    // reserve old nmon-db.js as version0
    app.get('/nmon-db/v0', isLoggedIn, function(req, res) {
        res.render('nmon-db-v0.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/detail', isLoggedIn, function(req, res) {
        res.render('detail.html', {
            user : req.user // get the user out of session and pass to template
        });
    });

    // version 1 nmon-db ejs mappings
    app.get('/nmon-db/v1/main', isLoggedIn, function(req, res) {
        res.render('nmdb-main.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    // version 1 settings ejs mappings
    app.get('/nmon-db/v1/user-settings', isLoggedIn, function(req, res) {
        res.render('nmdb-user-settings.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/nmdb-settings', isLoggedIn, function(req, res) {
        res.render('nmdb-settings.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/nmon-charts', isLoggedIn, function(req, res) {
        res.render('nmdb-nmon-charts.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/nmon-reports', isLoggedIn, function(req, res) {
        res.render('nmdb-nmon-reports.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/nmdb-server-inventory', isLoggedIn, function(req, res) {
        res.render('nmdb-server-inventory.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/nmdb-agents', isLoggedIn, function(req, res) {
        res.render('nmdb-agents.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/morris', isLoggedIn, function(req, res) {
        res.render('morris.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/flot', isLoggedIn, function(req, res) {
        res.render('flot.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/tables', isLoggedIn, function(req, res) {
        res.render('tables.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/forms', isLoggedIn, function(req, res) {
        res.render('forms.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/panels-wells', isLoggedIn, function(req, res) {
        res.render('panels-wells.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/buttons', isLoggedIn, function(req, res) {
        res.render('buttons.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/notifications', isLoggedIn, function(req, res) {
        res.render('notifications.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/typography', isLoggedIn, function(req, res) {
        res.render('typography.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/icons', isLoggedIn, function(req, res) {
        res.render('icons.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/grid', isLoggedIn, function(req, res) {
        res.render('grid.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/blank', isLoggedIn, function(req, res) {
        res.render('blank.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });

    app.get('/nmon-db/v1/login-sample', isLoggedIn, function(req, res) {
        res.render('login-sample.ejs', {
            user : req.user // get the user out of session and pass to template
        });
    });
};

// route middleware to make sure
function isLoggedIn(req, res, next) {
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/nmon-db/v1/login');
};
