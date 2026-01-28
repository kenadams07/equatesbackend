/* Seeder entrypoint for admin provisioning (DB connection only here). */
const mongoose = require("mongoose");
require("dotenv").config({ path: "../../.env" });

const logger = require("../logger/logger");
config = require("../config/config").getConfig();

const createUser = async () => {
  try {
    const url = config.MONGO_CONNECTION_STRING;
    logger.info(
      "process.env.MONGO_CONNECTION_STRING :::" +
        process.env.MONGO_CONNECTION_STRING,
    );

    // console.log("Pem File Path:", pemFilePath);
    // console.log("Current Working Directory:", process.cwd());

    const mongooseOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Add other options if necessary
    };
    // console.log("admin mongooseOptions", mongooseOptions);

    mongoose.connect(url, mongooseOptions);

    mongoose.connection.once("open", async () => {
      logger.info("Connected to database");
      //create seeder
    });
  } catch (error) {
    logger.error("Error", error);
  }
};

createUser();
