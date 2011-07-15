// npm install vows
process.env.NODE_ENV = "test";
var vows = require('vows'),
    assert = require('assert'),
    deploy = require(__dirname + '/../deploy').Deploy;


vows.describe('Division by Zero').addBatch({
  'executes start command': {
    'calls commands': function() {
      console.log(deploy);
    }
  }
}).run();
