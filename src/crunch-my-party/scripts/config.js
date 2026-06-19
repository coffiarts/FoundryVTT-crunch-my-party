import {Logger} from './logger.js';
import {PartyCruncher} from "./main.js";

// keep values in sync with module.json!
const MOD_ID = "crunch-my-party";
const MOD_PATH = `/modules/${MOD_ID}`;
const MOD_TITLE = "Crunch My Party!";
const MOD_DESCRIPTION = "A neat little utility for the game master handling multiple tokens as one party. Easily collapse arbitrary groups of scene tokens (representing parties) into an easy-to-use single \"party token\", and vice versa. Manage up to 5 separate parties with up to 25 members each!";
const MOD_LINK = `https://github.com/coffiarts/FoundryVTT-${MOD_ID}`;

const DEFAULT_NO_OF_PARTIES = 5;
const MAX_MEMBERS_PER_PARTY = 25;
const ICON_SUBMIT = "<i class='fas fa-check'></i>";
const ICON_CANCEL = "<i class='fas fa-cancel'></i>";

export class Config {
    static globals = {
        // keep these values in sync with your module.json!
        modID: MOD_ID,
        modPath: MOD_PATH,
        modTitle: MOD_TITLE,
        modDescription: MOD_DESCRIPTION,
        modlink: MOD_LINK,
        maxMembersPerParty: MAX_MEMBERS_PER_PARTY,
        iconSubmit: ICON_SUBMIT,
        iconCancel: ICON_CANCEL,
        modes: {
            PLACEHOLDER: "PLACEHOLDER",
            MEMBER: "MEMBER",
        },
        states: {
            CRUNCHED: "CRUNCHED",
            EXPLODED: "EXPLODED",
        }
    };
    static NO_AUDIO_FILE = '../modules/crunch-my-party/audio/audio_null.mp3';

    static init() {

        // =====================================================================
        // Setting: Version No (read-only)
        // =====================================================================
        Config.registerSettings( {
            modVersion: {
                scope: 'client', config: true, type: String, default: game.modules.get(MOD_ID).version,
                onChange: value => {
                    if (value !== game.modules.get(MOD_ID).version) {
                        // This "pseudo-setting" is meant for display only.
                        // So we always want it to snap back to its default on change
                        game.settings.set(Config.globals.modID, `modVersion`, game.modules.get(MOD_ID).version);
                    }
                }
            }
        });

        // =====================================================================
        // ===========================SEPARATOR ================================
        // =====================================================================
        Hooks.on('renderSettingsConfig', (app, html) => {
            const inputEl = html.querySelector(`#settings-config-${Config.globals.modID.replace(/\./g, "\\.")}\\.maxNoOfParties`);
            const formGroup = inputEl?.closest(".form-group");
            formGroup?.insertAdjacentHTML("beforebegin", `<div><h4 style="margin-top: 0; border-bottom: 1px solid #888; padding-bottom: 4px; margin-bottom: 6px;">${Config.localize('settingsMenu.partyConfigSection')}</h4></div>`);
        });

        // =====================================================================
        // Setting: Maximum No of Parties
        // =====================================================================
        Config.registerSettings({
            maxNoOfParties: {
                scope: 'world', config: true, type: Number, default: DEFAULT_NO_OF_PARTIES,
                requiresReload: true,
                range: {
                    min: 1,
                    max: 10,
                    step: 1
                },
                onChange: value => {}
            }
        });

        // =====================================================================
        // Setting: Member Token Names and Party Token Names per Party
        // DEPRECATED! REMOVE IN A FUTURE VERSION > 14.0.0
        // =====================================================================
        /**
         * @deprecated since v14 - will be kept for a while to ease manual migration of older party definitions
         * TODO - exclude from initialization (once it is not needed anymore)
         */
        let settingsData_v13 = [];
        //if (Config.getGameMajorVersion() >= 13) {
            // Special treatment for generic "party settings"
            for (let index = 1; index <= DEFAULT_NO_OF_PARTIES; index++) {
                settingsData_v13[`memberTokenNames${index}`] = {
                    scope: 'world', config: true, type: String, default: ""
                };
                settingsData_v13[`partyTokenName${index}`] = {
                    scope: 'world', config: true, type: String, default: ""
                }
            }
            Config.registerSettings(settingsData_v13);
        //}

        Config.registerSettings( {
            partyConfigs: {
                scope: 'world', config: false, type: Object, default: {}
            }
        });

        // =====================================================================
        // ===========================SEPARATOR ================================
        // =====================================================================
        Hooks.on('renderSettingsConfig', (app, html) => {
            const inputEl = html.querySelector(`#settings-config-${Config.globals.modID.replace(/\./g, "\\.")}\\.forceUniqueTargetToken`);
            const formGroup = inputEl?.closest(".form-group");
            formGroup?.insertAdjacentHTML("beforebegin", `<div><h4 style="margin-top: 0; border-bottom: 1px solid #888; padding-bottom: 4px; margin-bottom: 6px;">${Config.localize('settingsMenu.behaviourSection')}</h4></div>`);
        });

        // =====================================================================
        // Setting: Force Unique Target Token
        // =====================================================================
        Config.registerSettings({
            forceUniqueTargetToken: {
                scope: 'world', config: true, type: Boolean, default: true
            }
        });

        // =====================================================================
        // ===========================SEPARATOR ================================
        // =====================================================================
        Hooks.on('renderSettingsConfig', (app, html) => {
            const inputEl = html.querySelector(`#settings-config-${Config.globals.modID}\\.animation4Crunch`);
            const formGroup = inputEl?.closest(".form-group");
            formGroup?.insertAdjacentHTML("beforebegin", `<div><h4 style="margin-top: 0; border-bottom: 1px solid #888; padding-bottom: 4px; margin-bottom: 6px;">${Config.localize('settingsMenu.animationsSection')}</h4></div>`);
        });

        // =====================================================================
        // Setting: Animation & Audio
        // =====================================================================
        Config.registerSettings( {
            animationFileCRUNCHED: {
                scope: 'world', config: true, type: String, default: "jb2a.extras.tmfx.inpulse.circle.02.normal"
            },
            playAudioCRUNCHED: {
                scope: 'world', config: true, type: Boolean, default: true
            },
            audioFileCRUNCHED: {
                scope: 'world',
                config: true,
                type: String,
                filePicker: "audio",
                default: "modules/crunch-my-party/audio/audio_crunch.mp3"
            },
            animationFileEXPLODED: {
                scope: 'world', config: true, type: String, default: "jb2a.extras.tmfx.outpulse.circle.02.normal"
            },
            playAudioEXPLODED: {
                scope: 'world', config: true, type: Boolean, default: true
            },
            audioFileEXPLODED: {
                scope: 'world',
                config: true,
                type: String,
                filePicker: "audio",
                default: "modules/crunch-my-party/audio/audio_explode.mp3"
            }
        });

        // =====================================================================
        // Keybindings
        // =====================================================================
        // Keybinding: FIND
        for (let index = 1; index <= DEFAULT_NO_OF_PARTIES; index++) {
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
        Logger.info(`${DEFAULT_NO_OF_PARTIES} empty keybindings for FIND registered. Assign them to your liking in the game settings.`);

        // Keybinding: TOGGLE
        for (let index = 1; index <= DEFAULT_NO_OF_PARTIES; index++) {
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
        Logger.info(`${DEFAULT_NO_OF_PARTIES} empty keybindings for TOGGLE registered. Assign them to your liking in the game settings.`);

        // Keybinding: SHOW CONFIGS
        game.keybindings.register("crunch-my-party", `showConfig`, {
            name: Config.localize('keybindingMenuLabelShowConfig'),
            editable: [
                //{ key: "Key1/2/3/4", modifiers: [KeyboardManager.MODIFIER_KEYS.SHIFT, KeyboardManager.MODIFIER_KEYS.CONTROL] }
            ],
            restricted: true,
            onDown: () => {
                if (!game.user.isGM) {
                    return;
                }
                PartyCruncher.showPartyConfigurations();
            }
        });
        Logger.info(`${DEFAULT_NO_OF_PARTIES} empty keybindings for TOGGLE registered. Assign them to your liking in the game settings.`);
    }

    static registerSettings(settingsData) {
        Object.entries(settingsData).forEach(([key, data]) => {

            // Special treatment for the generic "party settings": Use ony localization key for all
            // TODO - v13 only. Encapsulate or remove once possible.
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
                Config.globals.modID, key, {
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
        return game.settings.get(Config.globals.modID, key);
    }

    static async modifySetting(key, newValue) {
        game.settings.set(Config.globals.modID, key, newValue);
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
        return game.i18n.localize(`${Config.globals.modID}.${key}`);
    }

    static format(key, data) {
        return game.i18n.format(`${Config.globals.modID}.${key}`, data);
    }

    static async sleep(msec) {
        Logger.debug(`(Config.sleep) Waiting for ${msec} msec. Zzzzzz....`)
        return new Promise(resolve => setTimeout(resolve, msec));
    }

    static getGameMajorVersion() {
        return game.version.split('.')[0];
    }
}
