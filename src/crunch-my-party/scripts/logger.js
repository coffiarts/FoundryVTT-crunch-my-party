import { Config } from './config.js'

export class Logger {

    static init(){
        // create separator and title at the beginning of this settings section
        if (Config.getGameMajorVersion() >= 13) {
            Hooks.on('renderSettingsConfig', (app, html) => {
                const inputEl = html.querySelector(`#settings-config-${Config.data.modID.replace(/\./g, "\\.")}\\.debug`);
                const formGroup = inputEl.closest(".form-group");
                formGroup?.insertAdjacentHTML("beforebegin", `<div><h4 style="margin-top: 0; border-bottom: 1px solid #888; padding-bottom: 4px; margin-bottom: 6px;">Logging</h4></div>`);
            });
        }
        else {
            Hooks.on('renderSettingsConfig', (app, [html]) => {
                html.querySelector(`[data-setting-id="${Config.data.modID}.debug"]`)?.insertAdjacentHTML('beforeBegin', `<h3>Logging</h3>`)
            });
        }

        // Register game settings relevant to this class specifically (all globally relevant settings are maintained by class Config)
        const settingsData = {
            debug : {
                scope: "client", config: true, type: Boolean, default: false,
            },
        };
        Config.registerSettings(settingsData);
    }
    static info(...args) {
        console.log(`${Config?.data?.modTitle ?? "" } [${Config?.data?.modID ?? "" }] | `, ...args);
    }

    static infoGreen(msg) {
        console.log(`%c${Config?.data?.modTitle ?? "" } [${Config?.data?.modID ?? "" }] | ${msg}`, 'color: green');
    }

    static debug(...args) {
        // During initialization, Config settings might not yet be present.
        // We can't rely on them here, so we need a fallback.
        let isDebugMode = false;
        try {
            isDebugMode = Config.setting('debug');
        } catch {}
        if (isDebugMode)
            console.debug(`${Config?.data?.modTitle ?? "" } [${Config?.data?.modID ?? "" }] | DEBUG | `, ...args);
    }

    static warn(suppressUIMsg = false, ...args) {
        console.warn(`${Config?.data?.modTitle ?? "" } [${Config?.data?.modID ?? "" }] | WARNING | `, ...args);
        if (!suppressUIMsg)
            ui.notifications.warn(`[${Config?.data?.modTitle ?? "" }] ${args[0]}`);
    }

    static error(suppressUIMsg = false, ...args) {
        console.error(`${Config?.data?.modTitle ?? "" } [${Config?.data?.modID ?? "" }] | ERROR | `, ...args);
        if (!suppressUIMsg)
            ui.notifications.error(`[${Config?.data?.modTitle ?? "" }] ${args[0]}`);
    }

    static catchThrow(thrown, toastMsg = undefined) {
        console.warn(thrown);
        if(toastMsg) Logger.error(toastMsg);
    }
}
