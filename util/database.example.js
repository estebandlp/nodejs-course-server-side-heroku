const mongoose = require("mongoose");

const databaseConnect = () => {
  return mongoose.connect(
    "mongodb+srv://user:<password>@cluster0.e8dgv.mongodb.net/Cluster0?retryWrites=true&w=majority"
  );
};

module.exports = databaseConnect; 
