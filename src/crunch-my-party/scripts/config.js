import {Logger} from './logger.js';

// keep values in sync with module.json!
const MOD_NAME = "<module-name>";
const MOD_PATH = `/modules/${MOD_NAME}`;
const MOD_TITLE = "";
const MOD_DESCRIPTION = "";
const MOD_LINK = `https://github.com/coffiarts/FoundryVTT-<module-name>`;

export class Config {
    static data = {
        // keep these values in sync with your module.json!
        modName: MOD_NAME,
        modPath: MOD_PATH,
        modTitle: MOD_TITLE,
        modDescription: MOD_DESCRIPTION,
        modlink: MOD_LINK
    };

    static async init() {
        // Register all globally relevant game settings here
        const data = {
            isActive: {
                scope: 'world', config: true, type: Boolean, default: false,
            }
        };
        Config.registerSettings(data);
    }

    static registerSettings(settingsData) {
        Object.entries(settingsData).forEach(([key, data]) => {
            let name = Config.localize(`setting.${key}.name`);
            let hint = Config.localize(`setting.${key}.hint`);
            game.settings.register(
                Config.data.modName, key, {
                    name: name,
                    hint: hint,
                    ...data
                }
            );
            Logger.info("Game Setting registered:", name);
        });
    }

    static setting(key) {
        return game.settings.get(Config.data.modName, key);
    }

    static async modifySetting(key, newValue) {
        game.settings.set(Config.data.modName, key, newValue);
        Logger.debug("Game Setting changed by module:", key, "=>", newValue);
    }

    /**
     * Returns the localized string for a given module scoped i18n key
     *
     * @ignore
     * @static
     * @param {*} key
     * @returns {string}
     * @memberof Config
     */
    static localize(key) {
        return game.i18n.localize(`${Config.data.modName}.${key}`);
    }

    static format(key, data) {
        return game.i18n.format(`${Config.data.modName}.${key}`, data);
    }


}
