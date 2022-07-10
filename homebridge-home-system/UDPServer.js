const udp = require("dgram");
const dns = require("dns");

module.exports = class UDPServer {
    /**
     * @type {{client: string, callback: (msg: Buffer, info: RemoteInfo) => void}[]}
     */
    listener = [];
    /**
     * @type {Socket}
     */
    udpSocket;

    constructor() {
        this.udpSocket = udp.createSocket('udp4');
        this.udpSocket.on('error', (error) => {
            console.log();
            console.log("UDPServer Started:");
            console.log("   Error: " + error);
            console.log();
            this.udpSocket.close();
        });

        this.udpSocket.on('message', (msg, info) => {
            this.listener.forEach((listener) => {
                if (info.address === listener.client) {
                    listener.callback(msg, info);
                }
            });
        });

        this.udpSocket.on('listening', () => {
            const address = this.udpSocket.address();
            console.log();
            console.log("UDPServer Started:");
            console.log("   Server is listening at port: " + address.port);
            console.log("   Server ip: " + address.address);
            console.log("   Server is IP4/IP6: " + address.family);
            console.log();
        });

        this.udpSocket.on('close', () => {
            console.log();
            console.log("UDPServer is closed!");
            console.log();
        });

        this.udpSocket.bind(20255);
    }

    /**
     * @param {string} client
     * @param {(msg: Buffer, info: RemoteInfo) => void} callback
     */
    addListener(client, callback) {
        dns.lookup(client, 4, (err, address, family) => {
            this.listener.push({client: address, callback: callback});
        });
    }

    sendPacket(msg, address) {
        this.udpSocket.send(msg, 20255, address);
    }
}