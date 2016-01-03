var service = require('./service');

var fbSleep = {};
fbSleep.getUsers = function() {
    return service.getUsers();
};

fbSleep.scrape = function(config) {
    if (!config) {
        throw new Error('Config is missing!');
    }

    if (!config.c_user || !config.xs) {
        throw new Error('Config is invalid: ' + 'c_user=' + config.c_user + ', xs=' + config.xs);
    }

    return service.scrape(config);
};

module.exports = fbSleep;
