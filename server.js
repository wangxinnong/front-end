var request      = require("request")
  , express      = require("express")
  , morgan       = require("morgan")
  , path         = require("path")
  , bodyParser   = require("body-parser")
  , async        = require("async")
  , cookieParser = require("cookie-parser")
  , session      = require("express-session")
  , config       = require("./config")
  , helpers      = require("./helpers")
  , cart         = require("./api/cart")
  , catalogue    = require("./api/catalogue")
  , orders       = require("./api/orders")
  , user         = require("./api/user")
  , metrics      = require("./api/metrics")
  , app          = express()

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
app.use(helpers.rewriteSlash);
app.use(metrics);
app.use(express.static("public"));
//if(process.env.SESSION_REDIS) {
//    console.log('Using the redis based session manager');
//    app.use(session(config.session_redis));
//}
//else {
//    console.log('Using local session manager');
//    app.use(session(config.session));
//}
var Keycloak = require('keycloak-connect');
var memoryStore = new session.MemoryStore();
var hogan = require('hogan-express');
app.use(session({
  secret: 'mySecret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));
app.set('view engine', 'html');
app.set('views', require('path').join(__dirname, '/view'));
app.engine('html', hogan);
var keycloak = new Keycloak({
  store: memoryStore
}, './keycloak_config/keycloak.json');

app.use(bodyParser.json());
app.use(cookieParser());
app.use(helpers.sessionMiddleware);
app.use(morgan("dev", {}));

var domain = "";
process.argv.forEach(function (val, index, array) {
  var arg = val.split("=");
  if (arg.length > 1) {
    if (arg[0] == "--domain") {
      domain = arg[1];
      console.log("Setting domain to:", domain);
    }
  }
});
app.use(keycloak.middleware({
  logout: '/oauthlogout',
  admin: '/'
}));

app.get('/tokens', keycloak.protect(), function (req, res) {
    res.render('tokens', {
        result: JSON.stringify(req.kauth.grant, null, 4),
        event: '1. Authentication\n2. Login'
    });
});

app.get('/oauthlogin', keycloak.protect(), function (req, res) {
    res.status(200);
    var cookie_name = 'logged_in';
    req.session.customerId = req.kauth.grant.id_token.content.name;
    console.log("req.session.customerId: " + req.session.customerId);
    res.cookie(cookie_name, req.session.id, {
        maxAge: 3600000
    });
    res.redirect('/');
});

app.get( '/special', keycloak.protect('special'), function(req, res, next) {
    res.end("<body><p>special</p><a href='/'>Home</a></body>");
});

app.get( '/admin', keycloak.protect( 'realm:admin' ), function(req, res, next) {
    res.end("<body><p>realm:admin</p><a href='/'>Home</a></body>");
});

/* Mount API endpoints */
app.use(cart);
app.use(catalogue);
app.use(orders);
//app.use(user);

app.use(helpers.errorHandler);

var server = app.listen(process.env.PORT || 8079, function () {
  var port = server.address().port;
  console.log("App now running in %s mode on port %d", app.get("env"), port);
});
