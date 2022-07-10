const request = require("request");
let {
    AccessoryConfig,
    Logger,
    API,
    CharacteristicGetCallback,
    Characteristic,
    Service, HAPStatus
} = require("homebridge");
const Accessory = require("../Accessory");

module.exports.clazz = class WeatherStation extends Accessory {

    temperature = 0;
    humidity = 0;
    sun = 0;

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
        this.url = config["url"];
        this.callspeed = config["callspeed"] || 1;

        this.registerServices();

        this.requestData();
        setInterval(this.requestData.bind(this), this.callspeed * 1000);
    }

    registerServices() {
        let informationService = new Service.AccessoryInformation();
        informationService.setCharacteristic(Characteristic.SerialNumber, this.serial);
        this.services.push(informationService);

        this.temperatureService = new Service.TemperatureSensor(this.name);
        this.registerCharacteristic(this.temperatureService, Characteristic.CurrentTemperature, this.getTemperature);
        this.services.push(this.temperatureService);

        this.humidityService = new Service.HumiditySensor(this.name);
        this.registerCharacteristic(this.humidityService, Characteristic.CurrentRelativeHumidity, this.getHumidity);
        this.services.push(this.humidityService);

        this.sunService = new Service.LightSensor(this.name);
        this.registerCharacteristic(this.sunService, Characteristic.CurrentAmbientLightLevel, this.getSun);
        this.services.push(this.sunService);
    }

    requestData() {
        request(
            {
                url: this.url,
                body: "",
                method: "GET",
            },
            function (error, response, body) {
                if (error) {
                    this.log("Get failed: " + error.message);
                } else {
                    try {
                        let json = JSON.parse(body);

                        this.temperature = parseFloat(json.temperature);
                        this.humidity = parseFloat(json.humidity);
                        this.sun = parseFloat(json.sun);

                        this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.temperature);
                        this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(this.humidity);
                        this.sunService.getCharacteristic(Characteristic.CurrentAmbientLightLevel).updateValue(this.sun);
                    } catch (e) {
                        this.log("Error on Data Get: " + e);
                    }
                }
            }.bind(this)
        );
    }

    /**
     * @param {CharacteristicGetCallback} next
     */
    getTemperature(next) {
        next(HAPStatus.SUCCESS, this.temperature);
    }

    /**
     * @param {CharacteristicGetCallback} next
     */
    getHumidity(next) {
        next(HAPStatus.SUCCESS, this.humidity);
    }

    /**
     * @param {CharacteristicGetCallback} next
     */
    getSun(next) {
        next(HAPStatus.SUCCESS, this.sun);
    }
}