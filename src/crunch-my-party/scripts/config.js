import {Logger} from './logger.js';
import {PartyCruncher} from "./main.js";

/// keep values in sync with module.json!
const MOD_ID = "crunch-my-party";
const MOD_PATH = `/modules/${MOD_ID}`;
const MOD_TITLE = "Crunch My Party!";
const MOD_DESCRIPTION = "*The* perfect utility for the game master handling multiple tokens as one party. Easily collapse arbitrary groups of scene tokens (representing parties) into an easy-to-use single \"party token\", and vice versa. Manage up to 5 separate parties with up to 25 members each!";
const MOD_LINK = `https://github.com/coffiarts/FoundryVTT-${MOD_ID}`;

const NO_OF_PARTIES = 5;

export class Config {
    static data = {
        // keep these values in sync with your module.json!
        modID: MOD_ID,
        modPath: MOD_PATH,
        modTitle: MOD_TITLE,
        modDescription: MOD_DESCRIPTION,
        modlink: MOD_LINK
    };
    static NO_AUDIO_FILE = '../modules/crunch-my-party/audio/audio_null.wav';

    static init() {

        const settingsData1 = {
            modVersion: {
                scope: 'client', config: true, type: String, default: game.modules.get(MOD_ID).version,
                onChange: value => {
                    if (value !== game.modules.get(MOD_ID).version) {
                        // This "pseudo-setting" is meant for display only.
                        // So we always want to snap back to its default on change
                        game.settings.set(Config.data.modID, `modVersion`, game.modules.get(MOD_ID).version);
                    }
                }
            }
        };
        Config.registerSettings(settingsData1);

        // create separator and title at the beginning of this settings section
        if (Config.getGameMajorVersion() >= 13) {
            Hooks.on('renderSettingsConfig', (app, html) => {
                const inputEl = html.querySelector(`#settings-config-${Config.data.modID.replace(/\./g, "\\.")}\\.memberTokenNames1`);
                const formGroup = inputEl.closest(".form-group");
                formGroup?.insertAdjacentHTML("beforebegin", `<div><h4 style="margin-top: 0; border-bottom: 1px solid #888; padding-bottom: 4px; margin-bottom: 6px;">${Config.localize('settingsMenu.membersSection')}</h4></div>`);
            });
        }
        else {
            Hooks.on('renderSettingsConfig', (app, [html]) => {
                html.querySelector(`[data-setting-id="${Config.data.modID}.memberTokenNames1"]`)?.insertAdjacentHTML('beforeBegin', `<h3>${Config.localize('settingsMenu.membersSection')}</h3>`)
            });
        }

        const settingsData2 = [];
        // Special treatment for generic "party settings" (dynamically add as many individual entries as defined by NO_OF_PARTIES)
        for (let index = 1; index <= NO_OF_PARTIES; index++) {
            settingsData2[`memberTokenNames${index}`] = {
                scope: 'world', config: true, type: String, default: ""
            };
            settingsData2[`partyTokenName${index}`] = {
                scope: 'world', config: true, type: String, default: ""
            }
        }
        Config.registerSettings(settingsData2);

        // create separator and title at the beginning of this settings section
        if (Config.getGameMajorVersion() >= 13) {
            Hooks.on('renderSettingsConfig', (app, html) => {
                const inputEl = html.querySelector(`#settings-config-${Config.data.modID}\\.animation4Crunch`);
                const formGroup = inputEl.closest(".form-group");
                formGroup?.insertAdjacentHTML("beforebegin", `<div><h4 style="margin-top: 0; border-bottom: 1px solid #888; padding-bottom: 4px; margin-bottom: 6px;">${Config.localize('settingsMenu.animationsSection')}</h4></div>`);
            });
        }
        else {
            Hooks.on('renderSettingsConfig', (app, [html]) => {
                html.querySelector(`[data-setting-id="${Config.data.modID}.animation4Crunch"]`)?.insertAdjacentHTML('beforeBegin', `<h3>${Config.localize('settingsMenu.animationsSection')}</h3>`)
            });
        }

        const settingsData3 = {
            animation4Crunch: {
                scope: 'world', config: true, type: String, default: "jb2a.extras.tmfx.inpulse.circle.02.normal"
            },
            playAudio4Crunch: {
                scope: 'world', config: true, type: Boolean, default: true
            },
            audioFile4Crunch: {
                scope: 'world',
                config: true,
                type: String,
                filePicker: "audio",
                default: "modules/crunch-my-party/audio/audio_crunch.wav"
            },
            animation4Explode: {
                scope: 'world', config: true, type: String, default: "jb2a.extras.tmfx.outpulse.circle.02.normal"
            },
            playAudio4Explode: {
                scope: 'world', config: true, type: Boolean, default: true
            },
            audioFile4Explode: {
                scope: 'world',
                config: true,
                type: String,
                filePicker: "audio",
                default: "modules/crunch-my-party/audio/audio_explode.wav"
            }
        };
        Config.registerSettings(settingsData3);

        // Add the keybindings for FIND
        for (let index = 1; index <= NO_OF_PARTIES; index++) {
            game.keybindings.register("crunch-my-party", `find${index}`, {
                name: Config.localize('keybindingMenuLabelFind').replace('#', index),
                editable: [
                    //{ key: "Key1/2/3/4", modifiers: [KeyboardManager.MODIFIER_KEYS.SHIFT] }
                ],
                restricted: true,
                onDown: () => {
                    if (!game.user.isGM) {
                        return;
                    }
                    PartyCruncher.findParty(index);
                }
            });
        }
        Logger.info(`${NO_OF_PARTIES} empty keybindings for FIND registered. Assign it to your liking in the game settings.`);

        // Add the keybindings for TOGGLE
        for (let index = 1; index <= NO_OF_PARTIES; index++) {
            game.keybindings.register("crunch-my-party", `toggle${index}`, {
                name: Config.localize('keybindingMenuLabelToggle').replace('#', index),
                editable: [
                    //{ key: "Key1/2/3/4", modifiers: [KeyboardManager.MODIFIER_KEYS.SHIFT, KeyboardManager.MODIFIER_KEYS.CONTROL] }
                ],
                restricted: true,
                onDown: () => {
                    if (!game.user.isGM) {
                        return;
                    }
                    PartyCruncher.toggleParty(index);
                }
            });
        }
        Logger.info(`${NO_OF_PARTIES} empty keybindings for TOGGLE registered. Assign it to your liking in the game settings.`);
    }

    static registerSettings(settingsData) {
        Object.entries(settingsData).forEach(([key, data]) => {

            // Special treatment for the generic "party settings": Use ony localization key for all
            let localizeKey = key;
            const isPartySetting = (key.startsWith('memberTokenNames') || key.startsWith('partyTokenName'));
            if (isPartySetting) {
                localizeKey = localizeKey.replace(/\d+/, '#'); // maps any setting like partyTokenName2 to partyTokenName#
            }

            let name = Config.localize(`setting.${localizeKey}.name`);
            let hint = Config.localize(`setting.${localizeKey}.hint`);

            // Another special treatment for the generic "party settings": replace "#" by index number
            if (isPartySetting) {
                name = name.replace('#', `#${key.match(/\d+/)}`);
                hint = hint.replace('#', `#${key.match(/\d+/)}`);
            }
            game.settings.register(
                Config.data.modID, key, {
                    name: name,
                    hint: hint,
                    ...data
                }
            );
            Logger.debug("(Config.registerSettings) Game Setting registered:", name);
        });
    }

    static setting(key, verbose = false) {
        if (verbose) Logger.debug(`(Config.setting) get setting: key = ${key}`);
        return game.settings.get(Config.data.modID, key);
    }

    static async modifySetting(key, newValue) {
        game.settings.set(Config.data.modID, key, newValue);
        Logger.debug("(Config.modifySetting) Game Setting changed by module:", key, "=>", newValue);
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

    static async sleep(msec) {
        Logger.debug(`(Config.sleep) Waiting for ${msec} msec. Zzzzzz....`)
        return new Promise(resolve => setTimeout(resolve, msec));
    }

    static getGameMajorVersion() {
        return game.version.split('.')[0];
    }
}
