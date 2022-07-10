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
    wind = 0;

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
        this.key = config["key"];
        this.callspeed = config["callspeed"] || 3;

        this.registerServices();

        this.requestData();
        setInterval(this.requestData.bind(this), this.callspeed * 60 * 1000);
    }

    registerServices() {
        let informationService = new Service.AccessoryInformation();
        informationService.setCharacteristic(Characteristic.SerialNumber, this.serial);
        this.services.push(informationService);

        this.temperatureService = new Service.TemperatureSensor(this.name + "-Temperatur");
        this.registerCharacteristic(this.temperatureService, Characteristic.CurrentTemperature, this.getTemperature);
        this.services.push(this.temperatureService);

        this.humidityService = new Service.HumiditySensor(this.name + "-Luftfeuchtigkeit");
        this.registerCharacteristic(this.humidityService, Characteristic.CurrentRelativeHumidity, this.getHumidity);
        this.services.push(this.humidityService);

        this.windService = new Service.LightSensor(this.name + "-Wind");
        this.registerCharacteristic(this.windService, Characteristic.CurrentAmbientLightLevel, this.getWind);
        this.services.push(this.windService);
    }

    requestData() {
        request(
            {
                url: "https://api.tomorrow.io/v4/timelines?" +
                    "location=10.9661952,50.8429262&" +
                    "fields=temperature&" +
                    "fields=humidity&" +
                    "fields=windSpeed&" +
                    "units=metric&" +
                    "timesteps=current&" +
                    "apikey=" + this.key,
                body: "",
                method: "GET",
            },
            function (error, response, body) {
                if (error) {
                    this.log("Get failed: " + error.message);
                } else {
                    try {
                        let json = JSON.parse(body);

                        console.log(json);
                        if (json.data) {
                            const values = json.data.timelines[0].intervals[0].values;

                            console.log(values);

                            this.temperature = values.temperature;
                            this.humidity = values.humidity;
                            this.wind = values.windSpeed;

                            this.temperatureService.getCharacteristic(Characteristic.CurrentTemperature).updateValue(this.temperature);
                            this.humidityService.getCharacteristic(Characteristic.CurrentRelativeHumidity).updateValue(this.humidity);
                            this.windService.getCharacteristic(Characteristic.CurrentAmbientLightLevel).updateValue(this.wind);
                        }
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
    getWind(next) {
        next(HAPStatus.SUCCESS, this.wind);
    }
}