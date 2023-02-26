import {Logger} from './logger.js';

/// keep values in sync with module.json!
const MOD_ID = "crunch-my-party";
const MOD_PATH = `/modules/${MOD_ID}`;
const MOD_TITLE = "Crunch My Party!";
const MOD_DESCRIPTION = "The perfect party token utility: Easily collapse arbitrary groups of scene tokens (representing parties) into an easy-to-use single \"party token\", and vice versa. Manage up to 3 separate parties with up to 25 members each!";
const MOD_LINK = `https://github.com/coffiarts/FoundryVTT-${MOD_ID}`;

export class Config {
    static data = {
        // keep these values in sync with your module.json!
        modID: MOD_ID,
        modPath: MOD_PATH,
        modTitle: MOD_TITLE,
        modDescription: MOD_DESCRIPTION,
        modlink: MOD_LINK
    };

    static init() {

        // Register all globally relevant game settings here
        const data = {
            modVersion: {
                scope: 'client', config: true, type: String, default: game.modules.get(MOD_ID).version,
                onChange: value => {
                    if (value !== game.modules.get(MOD_ID).version) {
                        // This "pseudo-setting" is meant for display only.
                        // So we always want to snap back to its default on change
                        game.settings.set(Config.data.modID, `modVersion`, game.modules.get(MOD_ID).version);
                    }
                }
            },
            memberTokenNames1: {
                scope: 'world', config: true, type: String, default: "",
            },
            partyTokenName1: {
                scope: 'world', config: true, type: String, default: "",
            },
            memberTokenNames2: {
                scope: 'world', config: true, type: String, default: "",
            },
            partyTokenName2: {
                scope: 'world', config: true, type: String, default: "",
            },
            memberTokenNames3: {
                scope: 'world', config: true, type: String, default: "",
            },
            partyTokenName3: {
                scope: 'world', config: true, type: String, default: "",
            }
        };
        Config.registerSettings(data);
    }

    static registerSettings(settingsData) {
        Object.entries(settingsData).forEach(([key, data]) => {
            let name = Config.localize(`setting.${key}.name`);
            let hint = Config.localize(`setting.${key}.hint`);
            game.settings.register(
                Config.data.modID, key, {
                    name: name,
                    hint: hint,
                    ...data
                }
            );
            Logger.info("Game Setting registered:", name);
        });
    }

    static setting(key, verbose = false) {
        if (verbose) Logger.debug(`get setting: key = ${key}`);
        return game.settings.get(Config.data.modID, key);
    }

    static async modifySetting(key, newValue) {
        game.settings.set(Config.data.modID, key, newValue);
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
        return game.i18n.localize(`${Config.data.modID}.${key}`);
    }

    static format(key, data) {
        return game.i18n.format(`${Config.data.modID}.${key}`, data);
    }


}
