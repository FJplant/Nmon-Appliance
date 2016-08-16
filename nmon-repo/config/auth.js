// config/auth.js

// expose our config directly to our application using module.exports
module.exports = {

    'facebookAuth' : {
        'clientID'      : '296152677408511', // your App ID
        'clientSecret'  : 'bc628cbefdc75c9ff2e5bf5a102d26da', // your App Secret
        'callbackURL'   : 'http://nmrep-dev.fjint.com:6900/auth/facebook/callback'
        //'callbackURL'   : 'http://nmdb.nmon.io/auth/facebook/callback'
     },

    'twitterAuth' : {
        'consumerKey'       : 'your-consumer-key-here',
        'consumerSecret'    : 'your-client-secret-here',
        'callbackURL'       : 'http://localhost:8080/auth/twitter/callback'
    },

    'googleAuth' : {
        'clientID'      : 'your-secret-clientID-here',
        'clientSecret'  : 'your-client-secret-here',
        'callbackURL'   : 'http://localhost:8080/auth/google/callback'
    }

};
