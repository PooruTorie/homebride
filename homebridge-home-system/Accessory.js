const {
    Characteristic,
    Service,
    CharacteristicValue,
    CharacteristicSetCallback,
    CharacteristicGetCallback,
} = require("homebridge");

module.exports = class Accessory {
    /**
     * @type {[Service]}
     */
    services = [];

    constructor(log) {
        this.log = log;
    }

    /**
     * @param {Service} service
     * @param {Characteristic} characteristic
     * @param {(next: CharacteristicGetCallback) => void} get
     * @param {(value: CharacteristicValue, next: CharacteristicSetCallback) => void} set
     */
    registerCharacteristic(service, characteristic, get, set = null) {
        let c = service.getCharacteristic(characteristic);
        c.on('get', get.bind(this));
        if (set != null) {
            c.on('set', set.bind(this));
        }
    }

    /**
     * @returns {[Service]}
     */
    getServices() {
        return this.services;
    }
}