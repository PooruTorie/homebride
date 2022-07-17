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
const RotaryEncoder = require("./libs/RotaryEncoder").RotaryEncoder;
const Gpio = require("pigpio").Gpio;
const fs = require("fs");

module.exports.clazz = class Curtain extends Accessory {

    position = 0;
    state = 2;
    target = 0;
    rawPosition = 0;

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
        this.clkPin = (config["pins"] || {})["clock"] || 17;
        this.dtPin = (config["pins"] || {})["data"] || 27;
        this.stopButton = new Gpio((config["pins"] || {})["stop"] || 2, {mode: Gpio.OUTPUT});
        this.upButton = new Gpio((config["pins"] || {})["up"] || 3, {mode: Gpio.OUTPUT});
        this.downButton = new Gpio((config["pins"] || {})["down"] || 4, {mode: Gpio.OUTPUT});
        this.maxRotation = config["calibration"]["maxRotation"];
        this.targetTolerance = config["calibration"]["targetTolerance"] || 5;

        const rotary = new RotaryEncoder(this.clkPin, this.dtPin);

        rotary.on("rotate", (value) => {
            this.updatePosition(value);
        });

        this.registerServices();

        fs.readFile("save.json", (err, data) => {
            if (!err) {
                data = JSON.parse(data);
                if (data.target) {
                    this.target = data.target;
                }
                if (data.rawPosition) {
                    rotary.value = data.rawPosition * 4;
                    this.updatePosition(data.rawPosition);
                }
            }
        });
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
        this.checkState();
        next(HAPStatus.SUCCESS, this.target);
    }

    updatePosition(value) {
        this.rawPosition = value;
        this.position = Math.max(0, Math.min(this.rawPosition, this.maxRotation)) / this.maxRotation * 100;
        this.checkState();
        this.curtainService.getCharacteristic(Characteristic.CurrentPosition).updateValue(this.position);
    }

    pushButton(pin) {
        pin.digitalWrite(1);
        setTimeout(() => pin.digitalWrite(0), this.clickTime);
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

        fs.writeFile("save.json", JSON.stringify({
            target: this.target,
            rawPosition: this.rawPosition
        }), () => null);

        this.curtainService.getCharacteristic(Characteristic.PositionState).updateValue(this.state);
    }
}