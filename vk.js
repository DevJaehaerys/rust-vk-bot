const { VK, Keyboard } = require('vk-io');
const { HearManager } = require('@vk-io/hear');
const WebSocket = require('ws');
const fs = require('fs');

class Bot {
    constructor(configPath) {
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.vk = new VK({ token: this.config.tokenVK });
        this.hearManager = new HearManager();
        this.ws = this.initializeWebSocket();

        this.setupHandlers();
    }

    initializeWebSocket() {
        const rustServerUrl = `ws://${this.config.serverConfig.ip}:${this.config.serverConfig.port}/${this.config.serverConfig.password}`;
        return new WebSocket(rustServerUrl);
    }

    setupHandlers() {
        this.hearManager.hear(/^привет/i, (context) => {
            if (this.isUserAllowed(context.senderId)) {
                this.sendMessage(context, 'Привет :^');
            }
        });

        this.hearManager.hear(/^!команда (.+)/i, (context) => {
            if (this.isUserAllowed(context.senderId)) {
                const command = context.$match[1];
                this.sendCommand(command, 1);
                this.sendMessage(context, `Вы отправили команду: ${command}`);
            }
        });

        this.vk.updates.on('message_new', this.hearManager.middleware);

        this.ws.on('message', async (data) => {
            if (this.config.adminIds.length > 0) {
                for (const adminId of this.config.adminIds) {
                    if (this.isUserAllowed(adminId)) {
                        try {
                            await this.vk.api.messages.send({
                                user_id: adminId,
                                message: `С сервера нам пришло вот такое: ${data}`,
                                random_id: Date.now(),
                            });
                        } catch (error) {
                            console.error(error);
                        }
                    }
                }
            }
        });

        this.vk.updates.start().then(() => {
            console.log('Успешный старт блин');
        }).catch(console.error);

        this.ws.on('close', () => {
            console.log('Клоус');
        });

        this.ws.on('error', (error) => {
            console.error(error);
        });
    }

    sendMessage(context, message) {
        context.send(message);
    }

    sendCommand(command, identifier) {
        const packet = {
            Identifier: identifier,
            Message: command,
            Name: 'WebRcon',
        };
        this.ws.send(JSON.stringify(packet));
    }

    isUserAllowed(userId) {
        return this.config.adminIds.includes(userId);
    }
}

const bot = new Bot('config.json');
