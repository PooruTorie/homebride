const {API} = require("homebridge");
const UDPServer = require("./UDPServer");

const plugin_id = "homebridge-home-system"

const server = new UDPServer();

/**
 * @param {API} homebridge
 */
module.exports = function (homebridge) {
    if (homebridge == null) {
        return server;
    }
    register(homebridge, "LightController");
    register(homebridge, "TemperatureHumiditySensor");
    register(homebridge, "WeatherAPI");
    register(homebridge, "Curtain");
};

function register(homebridge, name) {
    const {clazz} = require("./accessorys/" + name + ".js");
    homebridge.registerAccessory(plugin_id, name, clazz);
}