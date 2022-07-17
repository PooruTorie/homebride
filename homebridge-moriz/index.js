const {API} = require("homebridge")

const plugin_id = "homebridge-moriz"

/**
 * @param {API} homebridge
 */
module.exports = function (homebridge) {
    register(homebridge, "Curtain");
    register(homebridge, "Temperature");
};

function register(homebridge, name) {
    const {clazz} = require("./accessorys/" + name + ".js");
    homebridge.registerAccessory(plugin_id, name, clazz);
}