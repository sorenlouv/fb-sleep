var fbSleep = require('./index');

var config = {
    c_user: '1234',
    xs: '6789'
};

fbSleep.getUsers(config)
    .then(function(res) {
        console.log(res);
    })
    .catch(function(e) {
        console.error(e);
    });
