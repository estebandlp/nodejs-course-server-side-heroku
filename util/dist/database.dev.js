"use strict";

var mongoose = require("mongoose");

var MONGODB_URI = "mongodb+srv://".concat(process.env.MONGODB_USER, ":").concat(process.env.MONGODB_PASSWORD, "@cluster0.e8dgv.mongodb.net/").concat(process.env.MONGO_DEFAULT_DATABASE);

var databaseConnect = function databaseConnect() {
  return mongoose.connect(MONGODB_URI);
};

exports.databaseConnect = databaseConnect;
exports.MONGODB_URI = MONGODB_URI;