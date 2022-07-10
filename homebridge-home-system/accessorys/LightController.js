let {
    AccessoryConfig,
    Logger,
    API,
    CharacteristicValue,
    CharacteristicSetCallback,
    CharacteristicGetCallback,
    Characteristic,
    Service, HAPStatus
} = require("homebridge");
const i2c = require('i2c-bus');
const {Pca9685Driver} = require("pca9685");
const Accessory = require("../Accessory");
const {Gpio} = require("pigpio");
const {callbackify} = require("util");

module.exports.clazz = class LightController extends Accessory {

    /**
     * @type {string}
     */
    url;
    /**
     * @type {[Scene]}
     */
    scenes;
    /**
     * @type {Scene}
     */
    allScene;
    /**
     * @type {Gpio}
     */
    switch;
    /**
     * @type Pca9685Driver
     */
    pwmDriver1;
    /**
     * @type Pca9685Driver
     */
    pwmDriver2;

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
        const switchPin = config["switchPin"] || 4;
        this.scenes = [];
        (config["scenes"] || []).forEach(function (json) {
            this.scenes.push(new Scene(this.log, json, this.sendUpdate.bind(this)));
        }.bind(this));

        this.writeTimeout = 1000;
        this.allScene = new Scene(this.log, {
            "name": "All",
            "lights": [
                "1111",
                "1111",
                "1111",
                "1111",
                "1111",
                "1111"
            ]
        }, this.sendUpdate.bind(this));
        this.scenes.push(this.allScene);

        this.switchTime = 3000;
        this.switch = new Gpio(switchPin, {
            mode: Gpio.INPUT,
            pullUpDown: Gpio.PUD_UP
        });

        this.switchDuration = 0;
        setInterval(() => {
            this.switchTime = Math.max(0, this.switchTime - 10);
            this.writeTimeout = Math.max(0, this.writeTimeout - 10);

            const level = this.switch.digitalRead();
            if (level === 0 && this.switchTime === 0) {
                this.switchDuration += 10;

                if (this.switchDuration >= 100) {
                    let on = false;
                    this.scenes.forEach((scene) => {
                        if (scene.brightness > 0) {
                            on = true;
                        }
                    });
                    this.log(on);
                    this.allScene.setBrightness(on ? 0 : 100, (status, value) => {
                    });
                    this.switchDuration = 0;
                    this.switchTime = 2000;
                }
            } else {
                this.switchDuration = 0;
            }
        }, 10);

        setInterval(() => this.startPwmDriver, 1000 * 60);
        this.startPwmDriver();
        this.registerServices();
    }

    startPwmDriver() {
        if (this.pwmDriver1) {
            this.pwmDriver1.dispose();
        }
        if (this.pwmDriver2) {
            this.pwmDriver2.dispose();
        }

        this.pwmDriver1 = new Pca9685Driver({
            i2c: i2c.openSync(1),
            address: 0x40,
            frequency: 200,
            debug: false
        }, (e) => {
        });
        this.pwmDriver2 = new Pca9685Driver({
            i2c: i2c.openSync(1),
            address: 0x41,
            frequency: 200,
            debug: false
        }, (e) => {
        });
    }

    registerServices() {
        let informationService = new Service.AccessoryInformation();
        informationService.setCharacteristic(Characteristic.SerialNumber, this.serial);
        this.services.push(informationService);

        this.scenes.forEach(function (scene) {
            let light = new Service.Lightbulb(this.name + "-" + scene.name, "UUID-" + scene.name);
            this.registerCharacteristic(light, Characteristic.On, next => scene.getBrightness((status, value) => {
                next(status, value > 0);
            }), (value, next) => scene.setOn(value, next));
            this.registerCharacteristic(light, Characteristic.Brightness, next => scene.getBrightness(next), (value, next) => scene.setBrightness(value, next));
            scene.service = light;
            this.services.push(light);
        }.bind(this));
    }

    /**
     * @param {Scene} origin
     * @param {[[int]]} value
     */
    sendUpdate(origin, value) {
        this.scenes.forEach(function (scene) {
            if (scene.name !== origin.name) {
                scene.brightness = 0;
                scene.service.updateCharacteristic(Characteristic.Brightness, 0);
                scene.service.updateCharacteristic(Characteristic.On, false);
            }
        }.bind(this));

        async function send() {
            console.log(origin.name, "Send")

            function dutyCycle(value) {
                return (value / 100) * 0.25;
            }

            let i = 0;
            for (let r = 0; r < 6; r++) {
                for (let c = 0; c < 4; c++) {
                    if (i >= 16) {
                        this.pwmDriver2.setDutyCycle(i - 16, dutyCycle(value[r][c]));
                    } else {
                        this.pwmDriver1.setDutyCycle(i, dutyCycle(value[r][c]));
                    }
                    i++;
                }
            }
        }

        if (this.wait) {
            clearInterval(this.wait);
        }

        if (this.writeTimeout > 0) {
            console.log(origin.name, "Wait")
            this.wait = setInterval(() => {
                if (this.writeTimeout === 0) {
                    send.bind(this)();
                    clearInterval(this.wait);
                }
            }, 100);
            return
        }

        this.writeTimeout = 1000;
        send.bind(this)();
    }
}

/**
 *
 * @param a {[[int]]}
 * @param b {int}
 */
function multiply(a, b) {
    let r = JSON.parse(JSON.stringify(a));
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < a[i].length; j++) {
            r[i][j] = a[i][j] * b;
        }
    }
    return r;
}

class Scene {
    /**
     * @type {string}
     */
    name
    /**
     * @type {[[int]]}
     */
    lights;
    /**
     * @type {Service}
     */
    service;
    /**
     * @type {number}
     */
    brightness = 0;

    constructor(log, json, update) {
        this.log = log;
        this.name = json["name"] || "Scene";
        this.lights = [];
        (json["lights"] || []).forEach(function (line) {
            let lineNumbers = [];
            line.split("").forEach((i) => {
                lineNumbers.push(parseInt(i));
            })
            this.lights.push(lineNumbers);
        }.bind(this));
        this.update = update;
        if (this.lights.length === 6) {
            this.lights.forEach(function (row) {
                if (row.length !== 4) {
                    throw new Error("Light Matrix not 6x4");
                }
            })
        } else {
            throw new Error("Light Matrix not 6x4");
        }
    }

    /**
     * @param {CharacteristicGetCallback} next
     */
    getBrightness(next) {
        next(HAPStatus.SUCCESS, this.brightness);
    }

    /**
     * @param {CharacteristicValue} value
     * @param {CharacteristicSetCallback} next
     */
    setOn(value, next) {
        if (value) {
            if (this.brightness === 0) {
                this.setBrightness(100, function (status, value) {
                    next(status, value > 0);
                });

                this.service.updateCharacteristic(Characteristic.Brightness, this.brightness);
                return;
            }
        } else {
            if (this.brightness > 0) {
                this.setBrightness(0, function (status, value) {
                    next(status, value > 0);
                });
                this.service.updateCharacteristic(Characteristic.Brightness, this.brightness);
                return;
            }
        }
        next(HAPStatus.SUCCESS, this.brightness > 0);
    }

    /**
     * @param {CharacteristicValue} value
     * @param {CharacteristicSetCallback} next
     */
    setBrightness(value, next) {
        this.brightness = value;
        next(HAPStatus.SUCCESS, this.brightness);
        this.update(this, multiply(this.lights, this.brightness));
    }
}