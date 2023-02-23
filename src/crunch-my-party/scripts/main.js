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

        ready2play = true;
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
    /**
     * Call this from the browser console if you're uncertain if the module has been initialized correctly
     * Syntax: PartyCruncher.healthCheck()
     */
    static healthCheck() {
        alert(`Module '${Config.data.modTitle}' says: '${ready2play ? `I am alive!` : `I am NOT ready - something went wrong:(`}'` );
    }

    static Actions = Object.freeze({
        CRUNCH: Symbol("CRUNCH"),
        EXPLODE: Symbol("EXPLODE")
    });

    /**
     * Public "main" method for usage in macros
     * @param partyNo
     */
    static toggleParty(partyNo = 1) {
        Logger.info(`Toggling party #${partyNo} ...`);

        try {

            // Step 1 - Parse & validate party definitions from module settings
            let namesFromSettings = this.#collectNamesFromSettings(partyNo);
            Logger.debug(namesFromSettings);

            // Step 2 - Update user prefs in module settings with the cleaned lists
            Config.modifySetting(`memberTokenNames${partyNo}`, namesFromSettings.memberTokenNames.join(`, `))
            Config.modifySetting(`partyTokenName${partyNo}`, namesFromSettings.partyTokenName)

            // Step 3 - gather all the requested tokens in current scene
            let involvedTokens = this.#collectInvolvedTokens(namesFromSettings, partyNo);
            Logger.debug(involvedTokens);

            // Step 4 - determine required action ("crunch" or "explode"?)
            let requiredAction = this.#determineRequiredAction(involvedTokens, partyNo);
            switch (requiredAction) {
                case this.Actions.CRUNCH:
                    Logger.info(`Crunching party ${partyNo} ...`);
                    break;
                case this.Actions.EXPLODE:
                    Logger.info(`Exploding party ${partyNo} ...`);
            }

        } catch (e) {
            Logger.error(false, e); // This will also print an error msg to the screen
            return;
        }

        Logger.info(`... Toggling of party #${partyNo} complete.`);
    }

    /**
     * Parse, split & validate given list of token names from module settings.
     * Throw meaningful UI errors if anything isn't valid.
     * @param partyNo
     * @returns {{partyTokenName: string, memberTokenNames: string[]}}
     */
    static #collectNamesFromSettings(partyNo = 1) {

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
        let partyTokenNames = partyTokenNameSetting
            .split(",")
            .map(name => name.trim().toLowerCase())
            .filter(name  => name.length > 0); // ignore empty strings resulting from input like ",," oder ", ,"

        Logger.debug(memberTokenNames);
        Logger.debug(partyTokenNames);

        // Check 1: Do we have enough tokens? Do we have not too many tokens?
        if (
            !memberTokenNames || memberTokenNames.length === 0 ||  memberTokenNames[0] === "" ||
            !partyTokenNames || partyTokenNames.length !== 1 || partyTokenNames[0] === "") {
            errMsg =
                // Error: invalidTokenCount => Names do not represent exactly ONE group and MORE THAN ONE members.
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "- " + Config.localize(`setting.memberTokenNames${partyNo}.name`) + ": <strong>[ " + memberTokenNamesSetting + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName${partyNo}.name`) + ": <strong>[ " + partyTokenNameSetting + " ]</strong><br/>" +
                "<br/>" +
                "<strong>" + Config.localize(`errMsg.invalidTokenCount`) + "</strong>";
        }

        if (errMsg) {
            throw new Error(errMsg);
        }

        // Check 2: Are there intersecting names between members list and party?
        const membersIncludeParty = partyTokenNames.some(element => {
            return memberTokenNames.includes(element);
        });
        const partyIncludesMembers = memberTokenNames.some(element => {
            return partyTokenNames.includes(element);
        });
        if (membersIncludeParty || partyIncludesMembers) {
            errMsg =
                // Error: groupAndMembersIntersect => Names must not exist both as member and as group.
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "- " + Config.localize(`setting.memberTokenNames${partyNo}.name`) + ": <strong>[ " + memberTokenNamesSetting + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName${partyNo}.name`) + ": <strong>[ " + partyTokenNameSetting + " ]</strong><br/>" +
                "<br/>" +
                "<strong>" + Config.localize(`errMsg.groupAndMembersIntersect`) + "</strong>";
        }

        if (errMsg) {
            throw new Error(errMsg);
        }

        // Remove duplicates
        memberTokenNames = [...new Set(memberTokenNames)];
        let partyTokenName = partyTokenNames[0]; // there CAN be only one by now, so we can safely reduce it to its first & only member

        return {
            memberTokenNames: memberTokenNames,
            partyTokenName: partyTokenName
        };
    }

    /**
     * Identify and collect all the tokens corresponding to the names lists in the scene and register them for later.
     * Throw meaningful UI error if some tokens can't be found or are not unique.
     * @param names
     * @param partyNo
     * @returns {{partyToken: any, memberTokens: *[]}}
     */
    static #collectInvolvedTokens(names, partyNo = 1) {

        let errMsg = "";

        let memberTokens = [];
        let partyToken;

        // Check 1: Does any of the named tokens exist more than once in the scene?
        for (let token of canvas.tokens.ownedTokens) {

            Logger.debug(`Checking if scene token is in list: [${token.name}] ...`);

            if (names.memberTokenNames.includes(token.name.toLowerCase())) {

                // Hurray, we've found a  member token!
                if (memberTokens.filter(t=>t.name === token.name).length === 0) { // not yet registered
                    memberTokens.push(token);
                    Logger.debug(`Hurray! Found token from memberTokenNames${partyNo}: [${token.name}]!`);
                } else {
                    // Error: ... but it's a duplicate!
                    errMsg += `[${token.name}] ${Config.localize(`errMsg.notUniqueInScene`)}<br/>`;
                }
            }

            if (names.partyTokenName === token.name.toLowerCase()) {

                // Hurray, we've found the party token!
                if (!partyToken) {
                    partyToken = token;
                    Logger.debug(`Hurray! Found partyTokenName${partyNo}: [${token.name}]`);
                } else {
                    // Error: ... but it's a duplicate!
                    errMsg += `[${token.name}] ${Config.localize(`errMsg.notUniqueInScene`)}<br/>`;
                }
            }
        }

        // Check 2: Are there any tokens that could NOT be found?
        let missingTokens = names.memberTokenNames
                            .map(name => name.toUpperCase())
                            .filter(name => !memberTokens
                                .map(t => t.name.toUpperCase())
                                .includes((name)));
        if (!partyToken) {
            missingTokens.push(names.partyTokenName.toUpperCase());
        }
        if (missingTokens.length > 0)
        {
            errMsg += `${Config.localize(`errMsg.tokensMissingInScene`)}: ${missingTokens.join(`, `)}<br/>`;
        }

        if (errMsg) {
            errMsg =
                // Collect all errors into one biiiiig message
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "- " + Config.localize(`setting.memberTokenNames${partyNo}.name`) +
                            ": <strong>[ " + Config.setting(`memberTokenNames${partyNo}`) + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName${partyNo}.name`) +
                            ": <strong>[ " + Config.setting(`partyTokenName${partyNo}`) + " ]</strong><br/>" +
                "<br/>" +
                errMsg;
            throw new Error(errMsg);
        }

        return {
            memberTokens: memberTokens,
            partyToken: partyToken
        };
    }

    /**
     * Determine current state of involved tokens and derive from it, which actions is to be next (Actions.CRUNCH or Actions.EXPLODE).
     * Throw a meaningful UI error if action cannot be determined, because the state of any token doesn't make sense
     * @param involvedTokens
     * @param partyNo
     * @returns {symbol}
     */
    static #determineRequiredAction(involvedTokens, partyNo) {

        let noOfMembersVisible = involvedTokens.memberTokens.filter(t => !t.document.hidden);
        let isPartyVisible = (!involvedTokens.partyToken.document.hidden);

        let errMsg = "";

        // Check1: Party members and party token can't be visible (active) at the same time.
        if (isPartyVisible && noOfMembersVisible.length > 0) {
            errMsg = Config.localize('errMsg.membersAndPartyBothVisible');
        } else
        // Check1: Party members and party token can't be visible (active) at the same time.
        if (!isPartyVisible && noOfMembersVisible.length === 0) {
            errMsg = Config.localize('errMsg.membersAndPartyAllHidden');
        }

        if (errMsg) {
            errMsg =
                // Error: Party members and party token can't be visible (active) at the same time.
                Config.localize('errMsg.cannotDetermineAction') + ":<br/>" +
                "<br/>" +
                errMsg + ":<br/>" +
                "<br/>" +
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "- " + Config.localize(`setting.memberTokenNames${partyNo}.name`) + ": <strong>[ " + Config.setting(`memberTokenNames${partyNo}`) + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName${partyNo}.name`) + ": <strong>[ " + Config.setting(`partyTokenName${partyNo}`) + " ]</strong>";
            throw new Error(errMsg);
        }

        let requiredAction = (isPartyVisible) ? this.Actions.EXPLODE : this.Actions.CRUNCH;
        Logger.debug("Required requiredAction: " + requiredAction.toString());

        return requiredAction;
    }
}
