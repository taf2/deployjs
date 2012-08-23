[![build status](https://secure.travis-ci.org/taf2/deployjs.png)](http://travis-ci.org/taf2/deployjs)
=deployjs

Stupid simple deployment for cluster.js applications.

    npm install deployjs

Add a file deploy.js to your project

    require("deployjs").CLI();

Add a project .deployspec

    {
      "name": "application_name",
      "dir": "/path/to/your/application",
      "host": "hostname",
      "branch": "gitbranch"
    }

What it does:

    usage:
      setup:  make remote server directories
      pop:  pop the most recent master from remote server, NOTE: only roles back from the most recent deploy
      push: push the latest master to remote server
      reload: send the reload signal to currently running application
      stop: send the kill signal to currently running application
      start:  start up the current application
      spec: dump the deploy spec

