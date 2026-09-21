const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const config = getDefaultConfig(__dirname);
// The shared model has no React or platform dependencies.
config.watchFolders = [path.resolve(__dirname, "../src")];
module.exports = config;
