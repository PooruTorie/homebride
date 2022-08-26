const {API} = require("homebridge");
const pigpio = require("pigpio");

const plugin_id = "homebridge-moriz";

/**
 * @param {API} homebridge
 */
module.exports = function (homebridge) {
    if (homebridge === "pigpio") {
        return pigpio;
    }

    register(homebridge, "Curtain");
    //register(homebridge, "Temperature"); fix todo
    register(homebridge, "Switches");

    homebridge.on("shutdown", () => {
        pigpio.terminate();
        console.log("Cleanup pigpio");
    });
};

function register(homebridge, name) {
    const {clazz} = require("./accessorys/" + name + ".js");
    homebridge.registerAccessory(plugin_id, name, clazz);
}