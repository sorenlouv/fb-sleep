var fbSleep = require('./index');
var activeSince = 1000 * 60 * 10;

var config = {
    c_user: '1234',
    xs: '6789'
};

fbSleep.getRecentlyActiveUsers(config, activeSince)
    .then(function(res) {
        console.log(res);
    })
    .catch(function(e) {
        console.error(e);
    })
    .done();
