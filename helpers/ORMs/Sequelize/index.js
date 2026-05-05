const fs = require("fs");
const path = require("path");
const { Sequelize, DataTypes } = require("sequelize");

const OauthTokens = require("./models/oauthtokens");
const PasswordResets = require("./models/passwordresets");
const User = require("./models/user");

const dialect = process.env.DATABASE_DIALECT || "sqlite";
const dataDir = path.join(__dirname, "../../../data");

let _instance = null;

// We export the sequelize connection instance to be used around our app.
module.exports = {
  connect: async () => {
    if (_instance) return _instance;
    if (dialect === "sqlite" && !fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const sequelize = dialect === "sqlite"
      ? new Sequelize({
          dialect: "sqlite",
          storage: path.join(dataDir, "database.sqlite"),
          logging: false,
        })
      : new Sequelize({
          host: process.env.DATABASE_SERVER,
          username: process.env.DATABASE_USERNAME,
          password: process.env.DATABASE_PASSWORD,
          database: process.env.DATABASE_NAME,
          dialect: dialect,
          logging: false,
        });

    const modelDefiners = [
      OauthTokens,
      PasswordResets,
      User,
      // Add more models here...
      // require('./models/item'),
    ];

    // We define all models according to their files.
    for (let i = 0; i < modelDefiners.length; i++) {
      modelDefiners[i] = modelDefiners[i](sequelize, DataTypes);
      modelDefiners[i].associate(sequelize.models);
    }

    // Await sync() so the tables exist before we return the connection
    try {
      await sequelize.sync();
    } catch (err) {
      console.error("Error syncing database:", err);
    }
    _instance = sequelize;
    return sequelize;
  },
};
