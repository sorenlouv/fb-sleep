var Bluebird = require('bluebird');
var request = require('request-promise');
var _ = require('lodash');
var cheerio = require('cheerio');
var fbSleep = {};

function getCookieJar(config, domain) {
    var jar = request.jar();
    jar.setCookie(
        request.cookie('c_user=' + _.trim(config.c_user)),
        domain
    );

    jar.setCookie(
        request.cookie('xs=' + _.trim(config.xs)),
        domain
    );

    return jar;
}

function validateConfig(config) {
    if (!_.has(config, 'c_user') || !_.has(config, 'xs')) {
        throw new Error('Config is invalid: ' + 'c_user=' + config.c_user + ', xs=' + config.xs);
    }
}

// curl 'https://www.messenger.com/' -H 'cookie: c_user=1234; xs=6789;'
fbSleep.getLastActiveTimes = function(config) {
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

// curl 'https://m.facebook.com/buddylist.php' -H 'cookie: c_user=<c_user>; xs=<xs>;'
fbSleep.fetchActiveUsers = function(config) {
    return request({
            url: 'https://m.facebook.com/buddylist.php',
            jar: getCookieJar(config, 'https://m.facebook.com'),
            gzip: true,
            headers: {
                'User-Agent': 'curl/7.43.0'
            }
        })
        .then(function(body) {
            var AWAY_ICON = 'https://static.xx.fbcdn.net/rsrc.php/v2/yX/r/FSqa1Nyk3nd.png';
            var $ = cheerio.load(body);
            var elements = $('.l.br.bs');
            var activeUsers = elements
                .filter(function() {
                    return $(this).find('img').attr('src') !== AWAY_ICON;
                })
                .map(function() {
                    var href = $(this).find('a').attr('href');
                    return /fbid=(\d+)/g.exec(href)[1];
                })
                .toArray();

            return _(activeUsers)
                .map(function(userId) {
                    return [userId, Date.now()/1000];
                })
                .fromPairs()
                .value();
        });
};

fbSleep.getRecentlyActiveUsers = function(config, since) {
    validateConfig(config);

    var activeUsersRequest = fbSleep.fetchActiveUsers(config);
    var lastActiveTimesRequest = fbSleep.getLastActiveTimes(config);

    return Bluebird.all([activeUsersRequest, lastActiveTimesRequest])
        .spread(function(activeUsers, lastActiveTimes) {
            var users = _.merge(activeUsers, lastActiveTimes);

            return _(users)
                .toPairs()
                .map(function(user) {
                    return {
                        userId: user[0],
                        timestamp: user[1] * 1000
                    };
                })
                .filter(function(user) {
                    return user.timestamp >= since;
                })
                .value();
        });
};

module.exports = fbSleep;
