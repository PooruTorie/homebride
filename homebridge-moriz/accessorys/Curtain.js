let {
    AccessoryConfig,
    Logger,
    API,
    CharacteristicSetCallback,
    CharacteristicGetCallback,
    Characteristic,
    Service, HAPStatus
} = require("homebridge");
const Accessory = require("../Accessory");
const i2c = require("i2c-bus");
const VL53L0X = require("vl53l0x");
const Gpio = require("pigpio").Gpio;
const fs = require("fs");

module.exports.clazz = class Curtain extends Accessory {

    position = 0;
    state = 2;
    target = 0;

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
        this.clickTime = config["clickTime"] || 100;
        this.sensorAddress = (config["sensor"] || {})["address"] || 0x29;
        this.sensorUpdateOffset = (config["sensor"] || {})["updateOffset"] || 10;
        this.curtainSelectIndex = ((config["control"] || {})["select"] || {})["index"] || 1;
        this.selectUpButton = new Gpio(((config["control"] || {})["select"] || {})["up"] || 21, {mode: Gpio.INPUT});
        this.stopButton = new Gpio((config["control"] || {})["stop"] || 2, {mode: Gpio.INPUT});
        this.upButton = new Gpio((config["control"] || {})["up"] || 3, {mode: Gpio.INPUT});
        this.downButton = new Gpio((config["control"] || {})["down"] || 4, {mode: Gpio.INPUT});
        this.maxDistance = config["calibration"]["maxDistance"];
        this.targetTolerance = config["calibration"]["targetTolerance"] || 5;

        fs.readFile("save.json", (err, data) => {
            if (!err) {
                data = JSON.parse(data);
                if (data.target) {
                    this.target = data.target;
                }
            }
        });

        i2c.openPromisified(3, {forceAccess: true}).then(async bus => {
            const laser = VL53L0X(bus, this.sensorAddress);
            await laser.setSignalRateLimit(0.1);
            await laser.setVcselPulsePeriod("pre", 18);
            await laser.setVcselPulsePeriod("final", 14);
            await laser.setMeasurementTimingBudget(200000);

            let lastDistance = undefined;

            setInterval(async () => {
                const distance = await laser.measure();
                if (!lastDistance || Math.abs(lastDistance - distance) > this.sensorUpdateOffset) {
                    lastDistance = distance;
                    this.updatePosition(distance);
                }
            }, 1000);
        });

        this.registerServices();
    }

    registerServices() {
        let informationService = new Service.AccessoryInformation();
        informationService.setCharacteristic(Characteristic.SerialNumber, this.serial);
        this.services.push(informationService);

        this.curtainService = new Service.WindowCovering(this.name);
        this.registerCharacteristic(this.curtainService, Characteristic.CurrentPosition, this.getPosition);
        this.registerCharacteristic(this.curtainService, Characteristic.PositionState, this.getState);
        this.registerCharacteristic(this.curtainService, Characteristic.TargetPosition, this.getTarget, this.setTarget);
        this.services.push(this.curtainService);
    }

    /**
     * @param {CharacteristicGetCallback} next
     */
    getPosition(next) {
        next(HAPStatus.SUCCESS, this.position);
    }

    /**
     * @param {CharacteristicGetCallback} next
     */
    getState(next) {
        next(HAPStatus.SUCCESS, this.state);
    }

    /**
     * @param {CharacteristicGetCallback} next
     */
    getTarget(next) {
        next(HAPStatus.SUCCESS, this.target);
    }

    /**
     * @param {CharacteristicValue} value
     * @param {CharacteristicSetCallback} next
     */
    setTarget(value, next) {
        this.target = value;
        fs.writeFile("save.json", JSON.stringify({
            target: this.target
        }), () => null);
        this.checkState();
        next(HAPStatus.SUCCESS, this.target);
    }

    updatePosition(value) {
        this.position = Math.max(0, Math.min(value, this.maxDistance)) / this.maxDistance * 100;
        this.checkState();
        this.curtainService.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.position);
    }

    async pushButton(pin) {
        const sleep = s => new Promise(r => setTimeout(r, s));

        /*
        for (let i = 1; i < this.curtainSelectIndex; i++) {
            this.selectUpButton.mode(Gpio.INPUT);
            await sleep(this.clickTime);
            this.selectUpButton.mode(Gpio.OUTPUT);
            await sleep(this.clickTime);
            this.selectUpButton.mode(Gpio.INPUT);
            await sleep(1000);
        }
        */

        pin.mode(Gpio.INPUT);
        await sleep(this.clickTime);
        pin.mode(Gpio.OUTPUT);
        await sleep(this.clickTime);
        pin.mode(Gpio.INPUT);
    }

    checkState() {
        const dif = this.position - this.target;

        if (Math.abs(dif) <= this.targetTolerance) {
            if (this.state !== 2) {
                this.state = 2;
                this.pushButton(this.stopButton);
            }
        } else {
            if (dif < 0) {
                if (this.state !== 1) {
                    this.state = 1;
                    this.pushButton(this.upButton);
                }
            } else {
                if (this.state !== 0) {
                    this.state = 0;
                    this.pushButton(this.downButton);
                }
            }
        }

        this.curtainService.getCharacteristic(Characteristic.PositionState).updateValue(this.state);
    }
}