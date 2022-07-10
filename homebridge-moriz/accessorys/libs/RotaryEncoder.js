const EventEmitter = require("events").EventEmitter;
const Gpio = require("pigpio").Gpio;

module.exports.RotaryEncoder = class RotaryEncoder extends EventEmitter {

    /**
     * @param pinA GPIO # of the first pin
     * @param pinB GPIO # of the second pin
     */
    constructor(pinA, pinB) {
        super();
        this.gpio_a = new Gpio(pinA, {mode: Gpio.INPUT, pullUpDown: Gpio.PUD_UP, edge: Gpio.EITHER_EDGE});
        this.gpio_b = new Gpio(pinB, {mode: Gpio.INPUT, pullUpDown: Gpio.PUD_UP, edge: Gpio.EITHER_EDGE});

        this.value = 2;
        this.lastEncoded = 0;

        this.gpio_a.on("interrupt", this.interrupt.bind(this));
        this.gpio_b.on("interrupt", this.interrupt.bind(this));
    }

    interrupt() {
        this.tick(this.gpio_a.digitalRead(), this.gpio_b.digitalRead());
    }

    tick(a, b) {
        const lastValue = this.value;

        const encoded = (a << 1) | b;
        const sum = (this.lastEncoded << 2) | encoded;

        if (sum === 0b1101 || sum === 0b0100 || sum === 0b0010 || sum === 0b1011) {
            this.value++;
        }
        if (sum === 0b1110 || sum === 0b0111 || sum === 0b0001 || sum === 0b1000) {
            this.value--;
        }

        this.lastEncoded = encoded;
        if (lastValue !== this.value) {
            this.emit("rotate", this.value / 4);
        }
    }
}