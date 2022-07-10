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
const server = require('../index')(null);


module.exports.clazz = class Curtain extends Accessory {

    position = 0;
    state = 1;
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
        this.client = config["client"];
        this.callspeed = config["callspeed"] || 10;

        server.addListener(this.client, (msg, info) => {
            switch (msg.readInt8()) {
                case 0:
                    this.position = msg.readInt8(1);
                    if (this.state === 2) {
                        if (Math.abs(this.position - this.target) >= 60) {
                            this.target = this.position;
                        }
                    }
                    break;
                case 1:
                    this.state = msg.readInt8(1);
                    break;
                case 2:
                    this.target = msg.readInt8(1);
                    break;
            }
        });

        this.registerServices();

        this.requestData();
        setInterval(this.requestData.bind(this), this.callspeed * 1000);
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

    requestData() {
        server.sendPacket(Buffer.from([0]), this.client);
        server.sendPacket(Buffer.from([1]), this.client);
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
        server.sendPacket(Buffer.from([2, this.target]), this.client);
        next(HAPStatus.SUCCESS, this.target);
    }
}