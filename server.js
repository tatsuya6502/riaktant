// This file is the entry point for no.de
var web = require("./lib/web/server"),
    syslog = require("./lib/syslog/server")

// Use the supplied app-server port
web.listen(process.env.PORT || 8001, function(){
  console.log("Web server started. Listening at %s:%d in %s mode", 
              web.address().address,
              web.address().port,
              web.settings.env);
})

// Bind to a really high port so sudo is not needed
syslog.bind(10514)
