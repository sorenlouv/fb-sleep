var request = require('request-promise');
var cheerio = require('cheerio');
var _ = require('lodash');
var database = require('./database');
var db = database.get();
var RECENTLY_ACTIVE_DURATION = 1000 * 60 * 10; // 10 minutes

var service = {};
service.scrape = function(config) {
    getAndSaveUsers(config);
};

service.getUsers = function() {
    var db = database.get();
    return db('posts').cloneDeep();
};

function getAndSaveUsers(config) {
    getRecentlyActiveUsers(config)
        .then(function(users) {
            console.log(new Date().toLocaleString(), ' - ', users.length, 'active users');
            return saveUsers(users);
        })
        .then(function() {
            var delay = _.random(RECENTLY_ACTIVE_DURATION * 0.9, RECENTLY_ACTIVE_DURATION);
            setTimeout(getAndSaveUsers.bind(null, config), delay);
        })
        .done();
}

function saveUsers(users) {
    return db('posts').push({
        users: users,
        time: Date.now(),
    });
}

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

// curl 'https://www.facebook.com/?_rdr'
// -H 'cookie: c_user=641870264; xs=239%3APGhxJwBYzlr7GQ;'
// -s | w3m -dump -T text/html
var getFbDtsg = _.memoize(function(config) {
    var jar = getCookieJar(config, 'https://www.facebook.com');
    return request({
            url: 'https://www.facebook.com/?_rdr',
            jar: jar,
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

// curl 'https://www.messenger.com/ajax/chat/buddy_list.php'
// -H 'cookie: c_user=641870264; xs=52%3ANXM8o8J2m9bMbg%3A2%3A1451565532%3A13273;'
// --data ''
function getLastActiveTimes(config) {
    return getFbDtsg(config)
        .then(function(fbDtsg) {
            var jar = getCookieJar(config, 'https://www.messenger.com');
            return request({
                url: 'https://www.messenger.com/ajax/chat/buddy_list.php',
                jar: jar,
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
}

function getRecentlyActiveUsers(config) {
    return getLastActiveTimes(config)
        .then(function(lastActiveTimes) {
            return _(lastActiveTimes)
                .pairs()
                .filter(function(user) {
                    var lastActive = user[1];
                    var diff = Date.now() - lastActive * 1000;
                    return diff < RECENTLY_ACTIVE_DURATION;
                })
                .map(function(user) {
                    var userId = user[0];
                    return userId;
                })
                .value();
        });
}

// curl 'https://m.facebook.com/buddylist.php' -H 'cookie: c_user=<c_user>; xs=<xs>;'
//  -s | w3m -dump -T text/html
function fetchActiveUsers(config) {
    var jar = getCookieJar(config, 'https://m.facebook.com');

    return request({
            url: 'https://m.facebook.com/buddylist.php',
            jar: jar,
            gzip: true,
        })
        .then(function(body) {
            var AWAY_ICON = 'https://static.xx.fbcdn.net/rsrc.php/v2/yX/r/FSqa1Nyk3nd.png';
            var $ = cheerio.load(body);
            var elements = $('.l.bq.br');
            var activeUsers = elements
                .filter(function() {
                    return $(this).find('img').attr('src') !== AWAY_ICON;
                })
                .map(function() {
                    var href = $(this).find('a').attr('href');
                    return /fbid=(\d+)/g.exec(href)[1];
                })
                .toArray();

            return activeUsers;
        })
        .catch(function(error) {
            console.error(new Error(error));
            throw error;
        });
}

service.reducePosts = function() {
    service.getUsers().then(function(posts) {
        var reducedPosts = posts.reduce(function(memo, post) {
            var DURATION = 1000 * 60 * 10; // 10 minutes
            var current = _.last(memo);
            if (!current || (current.time + DURATION) < post.time) {
                memo.push(post);
            } else {
                current.users = _.union(current.users, post.users);
            }
            return memo;
        }, []);

        db.object.posts = reducedPosts;
        db.write();
    });
};

module.exports = service;
