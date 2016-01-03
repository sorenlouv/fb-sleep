# fb-sleep


## Installation
```
npm install fb-sleep --save
```

## Usage

```js
fbSleep.scrape([options]);
```

 - `options` (_Object_)
    - `c_user`
    - `xs`

**Simple Example**
```js
var fbSleep = require('fb-sleep');
fbSleep.scrape({
    c_user: '<user_id>',
    xs: '<xs_value>'
});
```

