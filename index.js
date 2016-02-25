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
        headers: {
            'User-Agent': 'curl/7.43.0'
        }
    })
    .then(function(body) {
        var lastActiveTimes = JSON.parse(body.match(/lastActiveTimes\":({.+?})/)[1]);
        return lastActiveTimes;
    });
};

function getLoadBalancerInfo(config) {
    return request({
        url: 'https://5-edge-chat.facebook.com/pull',
        jar: getCookieJar(config, 'https://5-edge-chat.facebook.com'),
        qs: {
            channel: 'p_' + config.c_user,
            seq: 1,
            partition: -2,
            cb: 'jeih',
            idle: 1,
            qp: 'y',
            cap: 8,
            pws: 'fresh',
            isq: 57540,
            msgs_recv: 0,
            uid: config.c_user,
            viewer_uid: config.c_user,
            state: 'active'
        },
        gzip: true,
        headers: {
            'User-Agent': 'curl/7.43.0'
        }
    })
    .then(function(res) {
        return parseFbResponse(res).lb_info;
    });
}

function parseFbResponse(response) {
    return JSON.parse(response.replace('for (;;);', ''));
}

// curl 'https://5-edge-chat.facebook.com/pull?channel=p_<user_id>&seq=1&partition=-2&cb=jeih&idle=1&qp=y&cap=8&pws=fresh&isq=57540&msgs_recv=0&uid=<user_id>&viewer_uid=<user_id>&sticky_token=93&sticky_pool=frc3c09_chat-proxy&state=active' -H 'Cookie: c_user=<user_id>;xs=<xs>;'
fbSleep.getBuddyList = function(config) {
    return getLoadBalancerInfo(config)
        .then(function(lbInfo) {
            return request({
                url: 'https://5-edge-chat.facebook.com/pull',
                jar: getCookieJar(config, 'https://5-edge-chat.facebook.com'),
                qs: {
                    channel: 'p_' + config.c_user,
                    seq: 1,
                    partition: -2,
                    cb: 'jeih',
                    idle: 1,
                    qp: 'y',
                    cap: 8,
                    pws: 'fresh',
                    isq: 57540,
                    msgs_recv: 0,
                    uid: config.c_user,
                    viewer_uid: config.c_user,
                    state: 'active',
                    sticky_token: lbInfo.sticky,
                    sticky_pool: lbInfo.pool
                },
                gzip: true,
                headers: {
                    'User-Agent': 'curl/7.43.0'
                }
            });
        })
        .then(function(res) {
            var buddyList = parseFbResponse(res).ms[0].buddyList;
            return _.reduce(buddyList, function(memo, user, userId) {
                memo[userId] = user.lat;
                return memo;
            }, {});
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

fbSleep.getUsers = function(config) {
    validateConfig(config);

    return fbSleep.getBuddyList(config)
        .then(function(users) {
            if (_.size(users) === 0) {
                throw new Error('No users found');
            }

            return users;
        })

        // Fallback to other ways of retriving users
        .catch(function(e) {
            console.log('An error occured in buddyList', e);
            var activeUsersRequest = fbSleep.fetchActiveUsers(config);
            var lastActiveTimesRequest = fbSleep.getLastActiveTimes(config);

            return Bluebird.all([activeUsersRequest, lastActiveTimesRequest])
               .spread(function(activeUsers, lastActiveTimes) {
                   return _.merge(activeUsers, lastActiveTimes);
               });
        });
};

module.exports = fbSleep;
