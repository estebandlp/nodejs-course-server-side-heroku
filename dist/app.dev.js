"use strict";

var path = require("path");

var express = require("express");

var fs = require("fs");

var https = require("https");

var errorController = require("./controllers/error");

var databaseConnect = require("./util/database").databaseConnect;

var User = require("./models/user");

var session = require("express-session");

var MongoDBStore = require("connect-mongodb-session")(session);

var csrf = require("csurf");

var connectFlash = require("connect-flash");

var multer = require("multer");

var helmet = require("helmet");

var compression = require("compression");

var morgan = require("morgan");

var app = express();
var store = new MongoDBStore({
  uri: require("./util/database").MONGODB_URI,
  collection: "sessions"
});
var csrfProtection = csrf();
var fileStorage = multer.diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, "images");
  },
  filename: function filename(req, file, cb) {
    cb(null, "file" + "-" + file.originalname);
  }
});

var fileFilter = function fileFilter(req, file, cb) {
  if (file.mimetype === "image/png" || file.mimetype === "image/jpg" || file.mimetype === "image/jpeg") {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.set("view engine", "ejs");
app.set("views", "views");

var adminRoutes = require("./routes/admin");

var shopRoutes = require("./routes/shop");

var authRoutes = require("./routes/auth");

var accessLogStream = fs.createWriteStream(path.join(__dirname, "access.log"), {
  flags: "a"
});
app.use(helmet());
app.use(compression());
app.use(morgan("combined", {
  stream: accessLogStream
}));
app.use(express.urlencoded({
  extended: true
}));
app.use(express.json());
app.use(multer({
  dest: "images",
  storage: fileStorage,
  fileFilter: fileFilter
}).single("image"));
app.use(express["static"](path.join(__dirname, "public")));
app.use("/images", express["static"](path.join(__dirname, "images")));
app.use(session({
  secret: "in-production-must-be-long-string-value",
  resave: false,
  saveUninitialized: false,
  store: store
}));
app.use(csrfProtection);
app.use(connectFlash());
app.use(function (req, res, next) {
  if (!req.session.user) {
    return next();
  }

  User.findById(req.session.user._id).then(function (user) {
    if (!user) {
      return next();
    }

    req.user = user;
    next();
  })["catch"](function (err) {
    var error = new Error(err);
    error.status(500);
    return next(error);
  });
});
app.use(function (req, res, next) {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.csrfToken = req.csrfToken();
  next();
});
app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);
app.get("/500", errorController.get500);
app.use(errorController.get404);
app.use(function (error, req, res, next) {
  console.log(error);
  res.redirect("/500");
});
databaseConnect().then(function () {
  app.listen(process.env.PORT || 3000);
})["catch"](function (err) {
  throw new Error(err);
});