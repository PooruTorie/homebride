let {
    AccessoryConfig,
    Logger,
    API,
    CharacteristicGetCallback,
    Characteristic,
    Service, HAPStatus
} = require("homebridge");
const Accessory = require("../Accessory");
const DHT = require("pigpio-dht");

module.exports.clazz = class Curtain extends Accessory {

    temperature = 0;
    humidity = 0;

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
        this.updateTime = config["updateTime"] || 1000;
        this.pin = config["pin"] || 18;

        const sensor = DHT(this.pin, 22);

        this.registerServices();

        sensor.on("result", data => {
            console.log(data);

            this.temperature = data.temperature;
            this.humidity = data.humidity;

            this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.temperature);
            this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(this.humidity);
        });

        setInterval(sensor.read, this.updateTime);
        sensor.read();
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
}