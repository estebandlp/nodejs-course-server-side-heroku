const mongoose = require("mongoose");

const MONGODB_URI = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@cluster0.e8dgv.mongodb.net/${process.env.MONGO_DEFAULT_DATABASE}`;

const databaseConnect = () => {
  return mongoose.connect(MONGODB_URI);
};

exports.databaseConnect = databaseConnect;
exports.MONGODB_URI = MONGODB_URI;
