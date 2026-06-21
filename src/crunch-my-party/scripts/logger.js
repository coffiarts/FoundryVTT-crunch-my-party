import { Config } from './config.js'

export class Logger {

    static init(){
        // create separator and title at the beginning of this settings section
        Hooks.on('renderSettingsConfig', (app, html) => {
            const inputEl = html.querySelector(`#settings-config-${Config.globals.modID.replace(/\./g, "\\.")}\\.debug`);
            const formGroup = inputEl.closest(".form-group");
            formGroup?.insertAdjacentHTML("beforebegin", `<div><h4 style="margin-top: 0; border-bottom: 1px solid #888; padding-bottom: 4px; margin-bottom: 6px;">Logging</h4></div>`);
        });

        // Register game settings relevant to this class specifically (all globally relevant settings are maintained by class Config)
        const settingsData = {
            debug : {
                scope: "client", config: true, type: Boolean, default: false,
            },
        };
        Config.registerSettings(settingsData);
    }
    static info(...args) {
        console.log(`${Config?.globals?.modTitle ?? "" } [${Config?.globals?.modID ?? "" }] | INFO |`, ...args);
    }

    static infoGreen(msg) {
        console.log(`%c${Config?.globals?.modTitle ?? "" } [${Config?.globals?.modID ?? "" }] | INFO | ${msg}`, 'color: green');
    }

    static debug(caller, ...args) {
        // During initialization, Config settings might not yet be present.
        // We can't rely on them here, so we need a fallback.
        let isDebugMode = false;
        try {
            isDebugMode = Config.setting('debug');
        } catch {}
        if (isDebugMode)
            console.debug(`${Config?.globals?.modTitle ?? "" } [${Config?.globals?.modID ?? "" }] | DEBUG | (${caller}) - `, ...args);
    }

    static warn(caller, suppressUIMsg = false, ...args) {
        console.warn(`${Config?.globals?.modTitle ?? "" } [${Config?.globals?.modID ?? "" }] | WARNING | (${caller}) - `, ...args);
        if (!suppressUIMsg)
            ui.notifications.warn(`[${Config?.globals?.modTitle ?? "" }] ${args[0]}`);
    }

    static error(caller, suppressUIMsg = false, ...args) {
        console.error(`${Config?.globals?.modTitle ?? "" } [${Config?.globals?.modID ?? "" }] | ERROR | (${caller}) - `, ...args);
        if (!suppressUIMsg)
            ui.notifications.error(`[${Config?.globals?.modTitle ?? "" }] ${args[0]}`);
    }
}
