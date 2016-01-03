var path = require('path');
var lowdb = require('lowdb');
var storage = require('lowdb/file-async');
var database = {};

database.get = function() {
    return lowdb(path.resolve(__dirname, 'db.json'), {
        storage: storage,
    });
};

module.exports = database;
