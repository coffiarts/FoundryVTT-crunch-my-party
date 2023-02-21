import { Config } from './config.js'

export class Logger {

    static init(){
        // Register game settings relevant to this class specifically (all globally relevant settings are maintained by class Config)
        const settingsData = {
            debug : {
                scope: "client", config: true, type: Boolean, default: false,
            },
        };
        Config.registerSettings(settingsData);
    }
    static info(...args) {
        console.log(`${Config?.data?.modTitle ?? "" }  | `, ...args);
    }
    static debug(...args) {
        // During initialization, Config settings might not yet be present.
        // We can't rely on them here, so we need a fallback.
        let isDebugMode = false;
        try {
            isDebugMode = Config.setting('debug');
        } catch {}
        if (isDebugMode)
            console.debug(`${Config?.data?.modTitle ?? "" }  | DEBUG | `, ...args);
    }

    static warn(suppressUIMsg = false, ...args) {
        console.warn(`${Config?.data?.modTitle ?? "" } | WARNING | `, ...args);
        if (!suppressUIMsg)
            ui.notifications.warn(`${Config?.data?.modTitle ?? "" } | WARNING | ${args[0]}`);
    }

    static error(suppressUIMsg = false, ...args) {
        console.error(`${Config?.data?.modTitle ?? "" } | ERROR | `, ...args);
        if (!suppressUIMsg)
            ui.notifications.error(`${Config?.data?.modTitle ?? "" } | ERROR | ${args[0]}`);
    }

    static catchThrow(thrown, toastMsg = undefined) {
        console.warn(thrown);
        if(toastMsg) Logger.error(toastMsg);
    }
}
