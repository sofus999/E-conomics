const kerberos = require('kerberos');

class GSSAPIClient {
    constructor() {
        this.client = null;
    }

    async initialize(servicePrincipalName) {
        return new Promise((resolve, reject) => {
            kerberos.initializeClient(servicePrincipalName, {}, (err, client) => {
                if (err) {
                    return reject(err);
                }
                this.client = client;
                resolve();
            });
        });
    }

    async authenticate() {
        return new Promise((resolve, reject) => {
            this.client.step('', (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        });
    }

    async continue(response) {
        return new Promise((resolve, reject) => {
            this.client.step(response, (err, response) => {
                if (err) {
                    return reject(err);
                }
                resolve(response);
            });
        });
    }
}

module.exports = GSSAPIClient;