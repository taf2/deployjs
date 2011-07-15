var spawn = require('child_process').spawn;
var exec  = require('child_process').exec;
var fs    = require('fs');

// check for .deployspec in ./.deployspec
var appspec_path = process.env.DEPLOYSPEC || process.cwd() + "/.deployspec";
var appspec = JSON.parse(fs.readFileSync(appspec_path));

(function() {
  var time = new Date();
  appspec.app      = appspec.dir + "/" + appspec.name;
  appspec.releases = appspec.app + "/releases";
  appspec.current  = appspec.app + "/current";
  appspec.shared   = appspec.app + "/shared";
  appspec.pids     = appspec.shared + "/pids";
  appspec.tmp      = appspec.shared + "/tmp";
  appspec.log      = appspec.shared + "/log";
  appspec.pid      = appspec.pids + "/master.pid";
  //console.log("%d%d%d.%d%d%d", d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
  var seconds = time.getSeconds();
  appspec.release  = appspec.releases + "/" + time.getFullYear() + '' + time.getMonth() + '' + time.getDate() + '.' +
                     time.getHours() + '' + time.getMinutes() + '' + (seconds < 10 ? ('0' + seconds) : seconds);
})();

var Commands = (function() {

  //console.log(interpolate("cd #{dir} && ls -lh #{name} && ping #{host}"));
  function interpolate(str) {
    Object.keys(appspec).forEach(function(key) {
      var regex = new RegExp("#{" + key + "}", 'g');
      if (str.match(regex)) { str = str.replace(regex, appspec[key]); }
    });
    console.log("\t\texec: %s", str);
    return str;
  }

  function capture(err, stdout, stderr, next) {
    if (stdout) { appspec.stdout = stdout.trim(); }
    if (stderr) { appspec.stderr = stderr.trim(); }
    if (err)    { appspec.exitcode = err.code; } else { appspec.exitcode = 0; }
    next();
  }

  // prepare a call sequence
  function prepare(args, call) {
    var args = Array.prototype.slice.call(args);
    var next = args.pop();
    var cap = args.pop();
    if (typeof(cap) == 'function') {
      var realNext = next;
      next = function(err, stdout, stderr) {
        cap(err, stdout, stderr, realNext);
      }
    }
    else {
      args.push(cap);
    }
    call(args[0], next);
  }

  // execute a command remotely
  function run() {
    prepare(arguments, function(cmd, next) {
      exec(interpolate("ssh #{host} '" + cmd + "'"), next);
    });
  }

  // execute a command locallly
  function local() {
    prepare(arguments, function(cmd, next) {
      exec(interpolate(cmd), next);
    });
  }

  function start(next) {
    console.log("::start::");
    send([
      [run, "[ -f #{pid} ] && [ `ps -ef | grep \\`cat #{pid}`` | wc -l` -gt 1 ]", capture]
    ], function() {
      if (appspec.exitcode > 0) { // not running, start is safe
        send([
          [run, "cd #{current} && (NODE_ENV=production setsid node server.js >> #{log}/boot.log &) & disown"],
        ], next);
      }
      else { // running not safe
        console.error("already running!");
        process.exit(1);
      }
    });
  }

  function stop(next) {
    console.log("::stop::");
    send([
      [run, "cat #{pid}", capture],
      [run, "kill -s QUIT #{stdout}"]
    ], next);
  }

  function reload(next) {
    console.log("::reload::");
    send([
      [run, "if [ -f #{pid} ] && [ `ps -ef | grep \\`cat #{pid}\\` | wc -l` -gt 1 ]; then echo 'alive'; else echo 'dead'; fi", capture]
    ], function() {
      if (appspec.stdout == 'dead') {
        // remove dead pid files and start
        console.error("dead pid detected");
        send([ [run, "rm -f #{pid}"] ], start.bind({}, next));
      }
      else {
        // send reload signal
        send([ [run, "kill -s USR2 `cat #{pid}`"] ], next);
      }
    });
  }

  // send a series of commands and call next when complete
  function send(cmds, next) {
    var index = 0;
    var loop = function(err, stdout, stderr) {
      if (err) { console.error(stderr); } else if (stdout) { console.log(stdout); }
      var cmd = cmds.shift();
      if (cmd) {
        console.log("\t%s[%d]: %s", (cmd[0] == run ? appspec.host : "local"), index++, interpolate(cmd[1]));
        var func = cmd.shift();
        cmd.push(loop);
        func.apply(appspec, cmd);
        //cmd[0](cmd[1], loop);
      }
      else if (next) { next(); }
    };
    loop();
  }

  function setup(next) {
    console.log("::setup::");
    send([ [run, "mkdir -p #{app} #{releases} #{tmp} #{pids} #{log}"] ], next);
  }

  // install package into current remote server
  function install(next) {
    console.log("::install::");
    send([
      [run, "cd #{current} && npm install"]
    ], next);
  }

  function push(next) {
    console.log("::push::");
    setup(function() {
      send([
        [local, "git archive #{branch} | bzip2 | ssh #{host} \"cat > #{shared}/tmp/#{name}.tar.bz2\""],
        [run, "mkdir #{release}"],
        [run, "tar -jmxf  #{shared}/tmp/#{name}.tar.bz2 -C #{release}"],
        [run, "ln -nfs #{release}/ #{current}"],
      ], install.bind({}, start));
    });
  }

  function pop(next) {
    send([
      [run, "ls -lhrt #{releases}/ | head -n 2 | tail -n 1 | sed 's/.*\\s//'", capture],
      [run, "ln -nfs #{releases}/#{stdout}/ #{current}"]
    ], next);
  }

  function spec(next) {
    console.log(appspec);
  }

  if (process.env.NODE_ENV == 'test') {
    // expose our internal definitions to our test environment
    //module.exports.
  }

  // expose commands with descriptions
  return  {
    setup: { cmd: setup, desc: "make remote server directories" },
    pop: { cmd: pop, desc: "pop the most recent master from remote server, NOTE: only roles back from the most recent deploy" },
    push: { cmd: push, desc: "push the latest master to remote server" },
    reload: { cmd: reload, desc: "send the reload signal to currently running application" },
    stop: { cmd: stop, desc: "send the kill signal to currently running application" },
    start: { cmd: start, desc: "start up the current application"},
    spec: { cmd: spec, desc: "dump the deploy spec"}
  }

}());

function CLI() {
  var command = process.argv.pop();

  if (!Commands[command]) {
    console.error("usage:");
    var blue = '\033[94m';
    var end = '\033[0m';
    Object.keys(Commands).forEach(function(cmd) {
      var desc = Commands[cmd].desc;
      console.log("\t%s%s%s:\t%s", blue, cmd, end, desc);
    });
    process.exit(1);
  }

  Commands[command].cmd();
}

module.exports = exports = {Deploy:Commands, CLI: CLI };

if (!module.parent) {
  process.on('SIGTERM', process.exit.bind(process,0));
  CLI();
}
