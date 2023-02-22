import {Logger} from './logger.js';
import {Config} from './config.js'
import {ChatInfo} from "./chatinfo.js";

const SUBMODULES = {
    MODULE: Config,
    logger: Logger,
    chatinfo: ChatInfo
};

let ready2play;

/*
  Global initializer:
  First of all, we need to initialize a lot of stuff in correct order:
 */
(async () => {
        console.log("Crunch My Party! | Initializing Module ...");

        await allPrerequisitesReady();

        Logger.info(`Ready to play! Version: ${game.modules.get(Config.data.modID).version}`);
        Logger.info(Config.data.modDescription);
    }
)
();

async function allPrerequisitesReady() {
    return Promise.all([
        areDependenciesReady()
    ]);
}

async function areDependenciesReady() {
    return new Promise(resolve => {
        Hooks.once('setup', () => {
            resolve(initDependencies());
            resolve(initExposedClasses());
        });
    });
}

async function initDependencies() {
    Object.values(SUBMODULES).forEach(function (cl) {
        cl.init(); // includes loading each module's settings
        Logger.debug("Submodule loaded:", cl.name);
    });
}

async function initExposedClasses() {
    window.PartyCruncher = PartyCruncher;
    Logger.debug("Exposed classes are ready");
}

/*
Public class for accessing this module through macro code
 */
export class PartyCruncher {
    static healthCheck() {
        alert(`Module '${Config.data.modTitle}' says: '${ready2play ? `I am alive!` : `I am NOT ready - something went wrong:(`}'` );
    }

    static toggleParty(partyNo = 1) {
        Logger.info(`Toggling party #${partyNo} ...`);

        // Step 1 - Parse & validate party definitions from module settings
        let tokenListsFromSettings;
        try {
            tokenListsFromSettings = this.#parsePartySettings(partyNo);
        } catch (e) {
            Logger.error(false, e); // This will also print an error msg to the screen
            return;
        }

        Logger.debug(tokenListsFromSettings);

        Logger.info(`... Toggling of party #${partyNo} complete.`);
    }

    static #parsePartySettings(partyNo = 1) {

        let errMsg = "";

        // grab raw input values from user prefs
        let memberTokenNamesSetting = Config.setting(`memberTokenNames${partyNo}`);
        let partyTokenNameSetting = Config.setting(`partyTokenName${partyNo}`);

        // Parse & split given list of party names from module settings
        // We want to make this veeeeeery robust against "creative" text input from the users
        let memberTokenNames = memberTokenNamesSetting
            .split(",")
            .map(name => name.trim().toLowerCase())
            .filter(name  => name.length > 0); // ignore empty strings resulting from input like ",," or ", ,"
        let partyTokenName = partyTokenNameSetting
            .split(",")
            .map(name => name.trim().toLowerCase())
            .filter(name  => name.length > 0); // ignore empty strings resulting from input like ",," oder ", ,"

        Logger.debug(memberTokenNames);
        Logger.debug(partyTokenName);
        // Check 1: Do we have enough tokens? Do we have not too many tokens?
        if (
            !memberTokenNames || memberTokenNames.length == 0 ||  memberTokenNames[0] === "" ||
            !partyTokenName || partyTokenName.length != 1 || partyTokenName[0] === "") {
            //TODO localize!!
            errMsg =
                "Invalid game settings:<br/>" +
                "Expecting 2+ party member names and exactly 1 group token name.<br/>" +
                "Please check your settings for party #" + partyNo + ":<br/>" +
                "- member token names: " + memberTokenNamesSetting + "<br/>" +
                "- group token name: " + partyTokenNameSetting;
        }

        if (errMsg) {
            throw new Error(errMsg);
        }

        // Check 2: Are there intersecting names between members list and party?
        const membersContainParty = partyTokenName.some(element => {
            return memberTokenNames.includes(element);
        });
        const partyContainsMembers = memberTokenNames.some(element => {
            return partyTokenName.includes(element);
        });
        if (membersContainParty || partyContainsMembers) {
            // TODO localize!
            errMsg =
                "Invalid game settings:<br/>" +
                "At least one name is mentioned both in party and in members list<br/>" +
                "Please check your settings for party #" + partyNo + ":<br/>" +
                "- member token names: " + memberTokenNamesSetting + "<br/>" +
                "- group token name: " + partyTokenNameSetting;
        }

        if (errMsg) {
            throw new Error(errMsg);
        }

        // Remove duplicates
        memberTokenNames = [...new Set(memberTokenNames)];
        partyTokenName = [...new Set(partyTokenName )];

        return {
            memberTokenNames: memberTokenNames,
            partyTokenName: partyTokenName
        };
    }
}
