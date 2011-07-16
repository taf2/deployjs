// npm install vows
process.env.NODE_ENV = "test";
var vows = require('vows'),
    assert = require('assert'),
    sinon  = require('sinon'),
    deploy = require(__dirname + '/../lib/deployjs').Deploy;
    stub = require(__dirname + '/../lib/deployjs').stub;

vows.describe('Division by Zero').addBatch({
  'executes start command': {
    'calls commands': function() {
      stub('send', function() { console.log('called send'); });
      deploy.setup.cmd();
    }
  }
}).run();
