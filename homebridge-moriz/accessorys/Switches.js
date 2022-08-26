let {
    AccessoryConfig,
    Logger,
    API,
    CharacteristicSetCallback,
    CharacteristicGetCallback,
    Characteristic,
    CharacteristicValue,
    Service, HAPStatus
} = require("homebridge");
const Accessory = require("../Accessory");
const Gpio = require("../index")("pigpio").Gpio;

module.exports.clazz = class Switches extends Accessory {

    switch = false;

    /**
     * @param {Logger} log
     * @param {AccessoryConfig} config
     * @param {API} api
     */
    constructor(log, config, api) {
        super(log);
        Characteristic = api.hap.Characteristic;
        Service = api.hap.Service;

        this.name = config["name"];
        this.serial = config["serial"] || "12341234";
        this.type = config["type"] || undefined;
        this.clickTime = config["clickTime"] || 100;
        this.switchOn = new Gpio(config["on"] || 2, {mode: Gpio.OUTPUT});
        this.switchOff = new Gpio(config["off"] || 3, {mode: Gpio.OUTPUT});

        this.registerServices();
    }

    registerServices() {
        let informationService = new Service.AccessoryInformation();
        informationService.setCharacteristic(Characteristic.SerialNumber, this.serial);
        this.services.push(informationService);

        if (this.type === "licht") {
            this.switchService = new Service.Lightbulb(this.name);
        } else if (this.type === "venti") {
            this.switchService = new Service.Fan(this.name);
        } else if (this.type === "stecki") {
            this.switchService = new Service.Outlet(this.name);
        } else {
            this.switchService = new Service.Switch(this.name);
        }
        this.registerCharacteristic(this.switchService, Characteristic.On, this.getSwitch, this.setSwitch);
        this.services.push(this.switchService);
    }

    async pushButton(pin) {
        const sleep = s => new Promise(r => setTimeout(r, s));

        pin.digitalWrite(1);
        await sleep(this.clickTime);
        pin.digitalWrite(0);
    }

    /**
     * @param {CharacteristicGetCallback} next
     */
    getSwitch(next) {
        next(HAPStatus.SUCCESS, this.switch);
    }

    /**
     * @param {CharacteristicValue} value
     * @param {CharacteristicSetCallback} next
     */
    setSwitch(value, next) {
        if (this.switch !== value) {
            this.switch = value;

            if (this.switch) {
                this.pushButton(this.switchOn);
            } else {
                this.pushButton(this.switchOff);
            }
        }

        next(HAPStatus.SUCCESS, this.switch);
    }
}