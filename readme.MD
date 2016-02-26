# fb-sleep


## Installation
```
npm install fb-sleep --save
```

## Usage

```js
fbSleep.getUsers([config]);
```

 - `config` (_Object_)
   - `c_user`: [your Facebook user id](http://findmyfbid.com/)
   -  `xs`: [xs value from your Facebook cookie](https://gist.github.com/sqren/0e4563f258c9e85e4ae1)

**Simple Example**
```js
var fbSleep = require('fb-sleep');
var config = {
    c_user: '<user_id>',
    xs: '<xs_value>'
};

fbSleep.getUsers(config)
    .then(function(res) {
        console.log(res);
    });
```

