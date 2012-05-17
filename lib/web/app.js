// Web facing server
// Runs on Express (http://expressjs.com), fetching data from Riak using riak-js (http://riakjs.org)
// Sessions are also stored in Riak using the session store provided by riak-js
var express = require('express'),
    connect = require('connect'),
    config = require("../../config/config.js"),
    riak = require('riak-js').getClient(config),
    sessionStore = require("../session_store.js"),
    mrFunctions = require("../map_reduce.js");

// Setup server
// bodyParser - To parse form data
// cookieParser - To support session support
// session - To enable session support using Riak
var app = express.createServer(
  express.static(__dirname + '/public'),
  express.bodyParser(),
  connect.cookieParser(),
  connect.session({
    secret: 'aos;fop;qe13hpoaneruhwphfepaf',
    store: new sessionStore({
      bucket: "syslog-web-sessions",
      client: riak
    })
  })
);
app.set('views', __dirname + '/views');

// Dumps the given object as a JSON string
var json = function(object) {
  return JSON.stringify(object);
}

// Builds a query for Riak Search
var buildQuery = function(params) {
  // @TODO chech if the query alredy has a keyword
  var query = "originalMessage:" + params.query;
  if (params.facility !== null && params.facility !== "") {
    query += " AND facility:" + params.facility;
  }

  // Support for time ranges
  // To enable open end searches, 0 is used as the lowest character
  // and 9999999999 as the upper end.
  var from = params.from, to = params.to;
  if (from !== null && from !== "" && to !== null && to !== "") {
    query += " AND time:[\"" + from +  "\" TO \"" + to + "\"]";
  } else if (from !== null && from !== "" && (to === null || to === "")) {
    query += " AND time:[\"" + from +  "\" TO 99999999999]";
  } else if ((from === null || from === "") && to !== null && to !== "") {
    query += " AND time:[0 TO \"" + to + "\"]";
  }

  console.log("buildQuery: %s", query)

  return query;
}

// Filter to restrict access to logged-in users only
var restrict = function(req, res, next) {
  if (req.session.logged_in) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}

// Authenticate user (with static credentials)
var authenticate = function(user, password) {
  return user == 'riak' && password == 'nodejs';
}

// Filter to run a MapReduce request
// Only runs when the flag is set, otherwise hands over
// Control to the next filter
function mapReduce(request, response, next) {
  if (request.body.search.map_reduce == '1') {
    var mr = riak.search('syslog', buildQuery(request.body.search));
    if (request.body.search.map_function !== null && request.body.search.map_function !== "") {
      mr.map(mrFunctions['map'][request.body.search.map_function]);
    }

    if (request.body.search.reduce_function !== null && request.body.search.reduce_function.length > 0) {
      for (var i in request.body.search.reduce_function) {
        var reduce = request.body.search.reduce_function[i];
        if (reduce !== null && reduce !== "") {
          mr.reduce(mrFunctions['reduce'][reduce]);
        }
      }
    }

    mr.run(function(err, data) {
      response.send(json({mapreduce: data}));
    });
  } else {
    next();
  }
}

// Filter to set content type as JSON
var contentTypeIsJson = function(request, response, next) {
  response.contentType('.json');
  next();
}

// Filter to run a query on Riak Search
var search = function(request, response, next) {
  riak.search('syslog', buildQuery(request.body.search), {sort: 'time', rows: 200})
    .map('Riak.mapValuesJson').run(function(err, data) {
      var docs = [];
      if (err)
        console.log("search - err: %s, %s",
                    err.statusCode,
                    parseObject(err.message));
      if (data) {
        // console.log("search - %d records. data[0]=%s",
        //            data.length,
        //            parseObject(data[0]));
        docs = data.sort(function(a,b) {
          var atime = new Date(a.time).valueOf();
          var btime = new Date(b.time).valueOf();
          return (atime > btime) - (atime < btime)
        });
      }
      response.send(json({results: docs}));
    });
}

app.get('/', restrict, function(request, response) {
  response.render('index.ejs');
});

app.post('/search', contentTypeIsJson, mapReduce, search);

app.get('/login', function(request, response) {
  if (request.session.logged_in) {
    response.redirect('/');
  } else {
    response.render('login.ejs');
  }
});

app.post('/login', function(request, response) {
  if (authenticate(request.body.user, request.body.password)) {
    request.session.regenerate(function(){
      request.session.logged_in = true;
      response.redirect('/');
    });
  } else {
    response.render('login.ejs');
  }
});

var parseObject = function(obj) {
  var output = '';
  for (property in obj) {
    output += property + ': ' + obj[property]+'; ';
  }
  return output;
}

module.exports = app;
