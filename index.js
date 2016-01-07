var request = require('request-promise');
var Q = require('q');
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

var getFbDtsg = _.memoize(function(config) {
    return request({
        url: 'https://www.facebook.com/?_rdr',
        jar: getCookieJar(config, 'https://www.facebook.com'),
        gzip: true,
        headers: {
            'User-Agent': 'curl/7.43.0'
        }
    })
    .then(function(body) {
        var matches = body.match(/name="fb_dtsg" value="([-_A-Za-z0-9]+)"/);
        if (!matches) {
            throw new Error('fb_dtsg could not be found. Make sure config is correct');
        }
        return matches[1];
    });
});

function validateConfig(config) {
    if (!_.has(config, 'c_user') || !_.has(config, 'xs')) {
        throw new Error('Config is invalid: ' + 'c_user=' + config.c_user + ', xs=' + config.xs);
    }
}

fbSleep.getLastActiveTimes = function(config) {
    validateConfig(config);

    return getFbDtsg(config)
        .then(function(fbDtsg) {
            return request({
                url: 'https://www.messenger.com/ajax/chat/buddy_list.php',
                jar: getCookieJar(config, 'https://www.messenger.com'),
                gzip: true,
                method: 'POST',
                form: {
                    user: config.c_user,
                    fetch_mobile: true,
                    get_now_available_list: true,
                    __a: 1,
                    fb_dtsg: fbDtsg,
                },
            });
        })
        .then(function(body) {
            var parsedResponse = JSON.parse(body.replace('for (;;);', ''));
            var lastActiveTimes = parsedResponse.payload.buddy_list.last_active_times;
            return lastActiveTimes;
        });
};

fbSleep.getRecentlyActiveUsers = function(config, timeSinceLastCheck) {
    validateConfig(config);

    return fbSleep.getLastActiveTimes(config)
        .then(function(lastActiveTimes) {
            return _(lastActiveTimes)
                .pairs()
                .filter(function(user) {
                    var lastActive = user[1];
                    var timeSinceActive = Date.now() - lastActive * 1000;
                    return timeSinceActive <= timeSinceLastCheck;
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
