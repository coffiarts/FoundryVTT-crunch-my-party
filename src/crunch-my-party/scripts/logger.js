import {Config} from './config.js'

export class Logger {

    static MODE = {
        DEBUG: "DEBUG",
        INFO: "INFO",
        WARN: "WARN",
        ERROR: "ERROR"};

    static init() {
        // create separator and title at the beginning of this settings section
        Hooks.on('renderSettingsConfig', (app, html) => {
            const inputEl = html.querySelector(`#settings-config-${Config.globals.modID.replace(/\./g, "\\.")}\\.debug`);
            const formGroup = inputEl.closest(".form-group");
            formGroup?.insertAdjacentHTML("beforebegin", `<div><h4 style="margin-top: 0; border-bottom: 1px solid #888; padding-bottom: 4px; margin-bottom: 6px;">Logging</h4></div>`);
        });

        // Register game settings relevant to this class specifically (all globally relevant settings are maintained by class Config)
        const settingsData = {
            debug: {
                scope: "client", config: true, type: Boolean, default: false,
            },
        };
        Config.registerSettings(settingsData);
    }

    static info(...args) {
        console.log(`${Config?.globals?.modTitle ?? ""} [${Config?.globals?.modID ?? ""}] | INFO | `, ...args);
    }

    static infoGreen(msg) {
        console.log(`%c${Config?.globals?.modTitle ?? ""} [${Config?.globals?.modID ?? ""}] | INFO | ${msg}`, 'color: green');
    }

    static debug(caller, ...args) {
        // During initialization, Config settings might not yet be present.
        // We can't rely on them here, so we need a fallback.
        let isDebugMode = false;
        try {
            isDebugMode = Config.setting('debug');
        } catch {
        }
        if (isDebugMode)
            console.debug(`${Config?.globals?.modTitle ?? ""} [${Config?.globals?.modID ?? ""}] | DEBUG | (${caller}) - `, ...args);
    }

    static async warn(caller, suppressUIMsg = false, ...args) {
        console.warn(`${Config?.globals?.modTitle ?? ""} [${Config?.globals?.modID ?? ""}] | WARNING | (${caller}) - `, ...args);
        if (!suppressUIMsg)
            await this.#showUIMsg(args[0], this.MODE.WARN);
    }

    static async error(caller, suppressUIMsg = false, ...args) {
        console.error(`${Config?.globals?.modTitle ?? ""} [${Config?.globals?.modID ?? ""}] | ERROR | (${caller}) - `, ...args);
        if (!suppressUIMsg)
            await this.#showUIMsg(args[0], this.MODE.ERROR);
    }

    static async #showUIMsg(message, mode = this.MODE.INFO) {
        //ui.notifications.warn(`[${Config?.globals?.modTitle ?? "" }] ${args[0]}`);
        let color;
        switch (mode) {
            case this.MODE.WARN:
                color = "#fbe4b4";
                break;
            case this.MODE.ERROR:
                color = "#fbc1c1";
                break;
            default:
                color = '#cccccc';
        }

        let content = `
            <form>
                <div style="background-color: ${color}; max-height: 600px; max-width: 600px; overflow: auto; padding: 5px">
                    <legend>${message}</legend><br/>
                </div>
            </form>`;

        return new Promise(resolve => {
            new foundry.applications.api.DialogV2({
                window: {title: Config.globals.modTitle},
                content: content,
                buttons: [
                    {
                        action: "ok",
                        label: Config.localize('okButton'),
                        default: true,
                        callback: () => resolve({ok: true})
                    }]
            }).render({force: true});
        });
    }
}
