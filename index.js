var request = require('request-promise');
var _ = require('lodash');
var fbSleep = {};

function getCookieJar(config, domain) {
    var jar = request.jar();
    jar.setCookie(
        request.cookie('c_user=' + config.c_user),
        domain
    );

    jar.setCookie(
        request.cookie('xs=' + config.xs),
        domain
    );

    return jar;
}

function validateConfig(config) {
    if (!_.has(config, 'c_user') || !_.has(config, 'xs')) {
        throw new Error('Config is invalid: ' + 'c_user=' + config.c_user + ', xs=' + config.xs);
    }
}

// debugging
// curl 'https://www.messenger.com/' -H 'cookie: c_user=1234; xs=6789;'
fbSleep.getLastActiveTimes = function(config) {
    validateConfig(config);

    return request({
        url: 'https://www.messenger.com',
        jar: getCookieJar(config, 'https://www.messenger.com'),
        gzip: true,
        method: 'GET',
        headers: {
            'User-Agent': 'curl/7.43.0'
        }
    })
    .then(function(body) {
        var lastActiveTimes = JSON.parse(body.match(/lastActiveTimes\":({.+?})/)[1]);
        return lastActiveTimes;
    });
};

fbSleep.getRecentlyActiveUsers = function(config, since) {
    validateConfig(config);

    return fbSleep.getLastActiveTimes(config)
        .then(function(lastActiveTimes) {
            return _(lastActiveTimes)
                .pairs()
                .filter(function(user) {
                    var lastActive = user[1] * 1000;
                    return lastActive >= since;
                })
                .map(function(user) {
                    return {
                        userId: user[0],
                        timestamp: user[1] * 1000
                    };
                })
                .value();
        });
};

module.exports = fbSleep;
