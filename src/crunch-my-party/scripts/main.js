import {Logger} from './logger.js';
import {Config} from './config.js'
import {ChatInfo} from "./chatinfo.js";

const SUBMODULES = {
    MODULE: Config,
    logger: Logger,
    chatinfo: ChatInfo
};

const optionalDependencies = ['hot-pan', 'JB2A_DnD5e', 'jb2a_patreon', 'autoanimations'];
let optionalDependenciesAvailable = [];

let ready2play;

/**
 * Global initializer block:
 * First of all, we need to initialize a lot of stuff in correct order:
 */
(async () => {
        console.log("Crunch My Party! | Initializing Module ...");

        await allPrerequisitesReady();

        Hooks.once("ready", () => {
            Config.modifySetting(`modVersion`, game.modules.get("crunch-my-party").version);
            ready2play = true;
            Logger.infoGreen(`Ready to play! Version: ${Config.setting("modVersion")}`);
            Logger.infoGreen(Config.globals.modDescription);
        });
    }
)
();

async function allPrerequisitesReady() {
    return Promise.all([
        areDependenciesReady(),
        areOptionalDependenciesReady()
    ]);
}

async function areDependenciesReady() {
    return new Promise(resolve => {
        Hooks.once('setup', () => {
            resolve(initSubmodules());
            resolve(initExposedClasses());
        });
    });
}

async function areOptionalDependenciesReady() {
    return new Promise(resolve => {
        Hooks.once('setup', () => {
            resolve(scanForOptionalDependencies());
        });
    });
}

async function initSubmodules() {
    Object.values(SUBMODULES).forEach(function (cl) {
        cl.init(); // includes loading each module's settings
        Logger.debug("(initSubmodules) Submodule loaded:", cl.name);
    });
}

async function initExposedClasses() {
    window.PartyCruncher = PartyCruncher;
    Logger.debug("(initExposedClasses) Exposed classes are ready");
}

async function scanForOptionalDependencies() {
    for (let modID of optionalDependencies) {
        if (game.modules.get(modID)?.active) {
            Logger.info(`Optional 3rd-party mod [${modID}] is installed - HURRAY!`);
            optionalDependenciesAvailable.push(modID);
        } else {
            Logger.info(`Optional 3rd-party mod [${modID}] is NOT installed.`);
        }
    }
    Logger.debug("(scanForOptionalDependencies) optionalDependenciesAvailable:", optionalDependenciesAvailable);
}

/**
 * Public class for accessing this module through macro code
 */
export class PartyCruncher {
    /**
     * Call this from the browser console if you're uncertain if the module has been initialized correctly
     * Syntax: PartyCruncher.healthCheck()
     */
    static healthCheck() {
        alert(`Module '${Config.globals.modTitle}' says: '${ready2play ? `I am alive!` : `I am NOT ready - something went wrong:(`}'`);
    }

    static #isBusy;

    static isBusy() {
        return this.#isBusy;
    }

    static async setBusy(isBusy) {
        //if (!isBusy) await Config.sleep(1000);
        this.#isBusy = isBusy;
        Logger.debug("(PartyCruncher.setBusy) ", isBusy ? "BUSY!" : "NOT BUSY")
    }

    static #instances = [null, null, null];

    static #getInstance(partyNo) {
        if (this.#instances[partyNo] == null) {
            this.#instances[partyNo] = new PartyCruncher();
        }
        return this.#instances[partyNo];
    }

    static Actions = Object.freeze({
        CRUNCH: Symbol("CRUNCH"),
        EXPLODE: Symbol("EXPLODE"),
        GROUP: Symbol("GROUP"),
        FIND: Symbol("FIND")
    });

    /**
     * Public method for usage in macros: Toggle existing party between CRUNCH and EXPLODE
     * @param partyNo
     * @param useHotPanIfAvailable - toggles "Hot Pan & Zoom!", if it is available (auto-focussing players' scene views onto the party).
     * @returns {Promise<void>}
     */
    static async toggleParty(partyNo = 1, useHotPanIfAvailable = true) {

        if (PartyCruncher.isBusy()) {
            Logger.warn(false, Config.localize("errMsg.pleaseWaitStillBusy"));
            return;
        }

        Logger.debug(`(PartyCruncher.toggleParty) TOGGLE - partyNo: #${partyNo}, useHotPan: ${useHotPanIfAvailable} ...`);

        const instance = PartyCruncher.#getInstance(partyNo);

        try {

            await PartyCruncher.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate party definitions from module settings
            // ==================================================================================================
            // grab raw input values from user prefs
            // TODO - Remove
            let validatedNames = instance.#collectValidatedTokenNamesFromModuleSettings(partyNo);
            Logger.debug("(PartyCruncher.toggleParty) validatedNames: ", validatedNames);

            // ==================================================================================================
            // Step 2 - Update user prefs in module settings with the now cleaned lists
            // ==================================================================================================
            await PartyCruncher.updatePartyConfig(partyNo, validatedNames);

            // ==================================================================================================
            // Step 3 - gather and validate all the involved tokens from current scene
            // ==================================================================================================
            let involvedTokens = instance.#collectInvolvedTokens(validatedNames, partyNo);
            Logger.debug("(PartyCruncher.toggleParty) involvedTokens: ", involvedTokens);

            // ==================================================================================================
            // Step 4 - auto-determine the required action (CRUNCH or EXPLODE?)
            // ==================================================================================================
            let requiredAction = instance.#determineRequiredAction(involvedTokens, partyNo);
            Logger.debug(`(PartyCruncher.toggleParty) required action: ${requiredAction.toString()}`);

            // ==================================================================================================
            // Step 5 - auto-determine target token (depending on requiredAction), and focus on it
            // ==================================================================================================
            if (requiredAction === PartyCruncher.Actions.CRUNCH && canvas.tokens.controlled.length !== 1 && Config.setting("forceUniqueTargetToken")) {
                Logger.warn(false, Config.localize("errMsg.pleaseSelectTargetToken")); // This will also print an error msg to the screen
                return;
            }
            let targetToken = instance.#getTarget(requiredAction, involvedTokens, partyNo);
            if (targetToken?.name === undefined) {
                Logger.warn(false, Config.localize("errMsg.pleaseActivateTokenLayer"));
                return;
            }
            Logger.debug(`(PartyCruncher.toggleParty) target token: [${targetToken.name}]`);
            canvas.tokens.releaseAll();
            if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
                Logger.debug(`(PartyCruncher.toggleParty) switching HotPan ON (useHotPan: ${useHotPanIfAvailable})`);
                HotPan.switchOn(true); // true means: silentMode (no UI message)
            }
            targetToken.control({releaseOthers: true});
            canvas.animatePan(this.#getTokenCenter(targetToken));
            if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
                setTimeout(function () {
                    Logger.debug(`(PartyCruncher.toggleParty) switching HotPan BACK (useHotPan: ${useHotPanIfAvailable})`);
                    HotPan.switchBack(true); // true means: silentMode (no UI message)
                }, 1000);
            }

            // ==================================================================================================
            // Step 6 - And finallyyyyyyy.... just DO IT!!
            // ==================================================================================================
            switch (requiredAction) {
                case PartyCruncher.Actions.CRUNCH:
                    Logger.info(`Crunching party ${partyNo} ...`);
                    await instance.#crunchParty(involvedTokens, targetToken);
                    break;
                case PartyCruncher.Actions.EXPLODE:
                    Logger.info(`Exploding party ${partyNo} - instance: ${instance}...`);
                    await instance.#explodeParty(involvedTokens, targetToken);
            }

        } catch (e) {
            Logger.error(false, e); // This will also print an error msg to the screen
            return;
        } finally {
            await PartyCruncher.setBusy(false);
        }

        Logger.info(`... Toggling of party #${partyNo} complete.`);
        await PartyCruncher.setBusy(false);
    }

    static #getTokenCenter(targetToken) {
        let x = targetToken.x, y = targetToken.y;
        return Config.getGameMajorVersion() >= 12
            ? targetToken.getCenterPoint({x, y})
            : targetToken.getCenter(x, y);
    }

    /**
     * Public method for usage in macros: Assign selected scene tokens to a party.
     * Prompts for the name of the party token that shall represent the members.
     * Checks for non-unique or missing tokens and throws errors as required.
     * @param partyNo
     */
    static async groupParty(partyNo = 1) {

        if (PartyCruncher.isBusy()) {
            Logger.warn(false, Config.localize("errMsg.pleaseWaitStillBusy"));
            return;
        }

        Logger.debug(`(PartyCruncher.toggleParty) GROUP - partyNo: ${partyNo} ...`);

        // Force activation of the Token Layer in the UI
        // The following steps require token selection, which won't work with any other layer active
        canvas.tokens.activate();

        const instance = PartyCruncher.#getInstance(partyNo);

        try {

            await PartyCruncher.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate current token selection, with input from the GM
            // ==================================================================================================
            // grab names from all currently selected tokens
            let namesFromSelection = instance.#collectNamesFromTokenSelection();
            // ask the GM for the name and mode of the party token to use
            let partyDefinitionInput = await PartyCruncher.#promptForPartyDefinition(partyNo);
            if (partyDefinitionInput.cancelled) {
                return;
            } else {
                namesFromSelection.partyTokenName = partyDefinitionInput.tokenName;
                namesFromSelection.partyTokenMode = partyDefinitionInput.mode;
                partyNo = partyDefinitionInput.partyNo;
                Logger.debug(`(PartyCruncher.groupParty) namesFromSelection for grouping party #${partyNo}:`, namesFromSelection);
            }
            const partyDefinition = instance.#createPartyDefinition(partyNo, namesFromSelection);
            const partyToken = canvas.scene.tokens.find(t => t.name === partyDefinition.partyTokenName);

            // ==================================================================================================
            // Step 2 - Update user prefs in module settings with detected names lists
            // ==================================================================================================
            const updates = {
                definition: partyDefinition,
                partyToken: partyToken
            };
            await PartyCruncher.updatePartyConfig(partyNo, updates);

            // Remove party token from scene if necessary
            if (partyDefinition.partyTokenMode === "PLACEHOLDER") {
                await partyToken.delete();
            }

            // ==================================================================================================
            // Step 3 - Confirm in UI that group assignment was successful
            // ==================================================================================================
            let msg =
                `${Config.localize('groupingConfirmation')
                    .replace('{partyNo}', partyNo)
                    .replace('{partyTokenName}', partyDefinition.partyTokenName
                    )}:` +
                `<ul><li>` +
                partyDefinition.memberTokenNames.join(`</li><li>`) +
                `</li></ul>`;
            ui.notifications.info(msg);
            await ChatMessage.create({
                whisper:ChatMessage.getWhisperRecipients("GM"),
                user: game.user.id ?? game.user._id,
                speaker: ChatMessage.getSpeaker({alias: Config.globals.modTitle}),
                content: msg
            }, {});
            Logger.info(msg);

            // ==================================================================================================
            // Step 4 - Ask the GM if new group should be crunched immediately
            // ==================================================================================================
            PartyCruncher.#promptForImmediateCrunch(partyNo);

        } catch (e) {
            Logger.error(false, e); // This will also print an error msg to the screen
            return;
        } finally {
            await PartyCruncher.setBusy(false);
        }

        Logger.info(`... Grouping of party #${partyNo} complete.`);
        await PartyCruncher.setBusy(false);
    }

    static toInitCap(string) {
        return string.substring(0, 1).toUpperCase() + string.substring(1);
    }

    /**
     * Public method for usage in macros: Select all member tokens of a given party in the scene.
     * The new target token depends on whether party is crunched or exploded (auto-detected).
     * @param partyNo
     * @param useHotPanIfAvailable - toggles "Hot Pan & Zoom!", if it is available (autofocussing players' scene views onto the party)*/
     static async findParty(partyNo, useHotPanIfAvailable = true) {

        if (PartyCruncher.isBusy()) {
            Logger.warn(false, Config.localize("errMsg.pleaseWaitStillBusy"));
            return;
        }

        Logger.debug(`(PartyCruncher.findParty) FIND - partyNo: ${partyNo}, useHotPan: ${useHotPanIfAvailable} ...`);

        const instance = PartyCruncher.#getInstance(partyNo);

        try {

            await PartyCruncher.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate party definitions from module settings
            // ==================================================================================================
            // grab raw input values from user prefs
            let validatedNames = instance.#collectValidatedTokenNamesFromModuleSettings(partyNo);
            Logger.debug("(PartyCruncher.findParty) validatedNames: ", validatedNames);

            // ==================================================================================================
            // Step 2 - gather and validate all the involved tokens from current scene
            // ==================================================================================================
            let involvedTokens = instance.#collectInvolvedTokens(validatedNames, partyNo);
            Logger.debug("(PartyCruncher.findParty) involvedTokens: ", involvedTokens);

            // ==================================================================================================
            // Step 3 - Finally... just FIND it!
            // ==================================================================================================
            if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
                Logger.debug(`switching HotPan ON (useHotPan: ${useHotPanIfAvailable})`);
                HotPan.switchOn(true); // true means: silentMode (no UI message)
            }

            // Decide what to focus on, depending on the chosen party's status in the scene:
            // Either The party token (if crunched) or one of its member tokens (if exploded)
            if (involvedTokens.partyToken.document.hidden) { // i.e. EXPLODED
                canvas.tokens.releaseAll();
                for (let token of involvedTokens.memberTokens) {
                    token.control({releaseOthers: false});
                }
                canvas.animatePan(involvedTokens.memberTokens[0].getCenter(involvedTokens.memberTokens[0].x, involvedTokens.memberTokens[0].y));
            } else { // i.e. CRUNCHED
                involvedTokens.partyToken.control({releaseOthers: true});
                canvas.animatePan(involvedTokens.partyToken.getCenter(involvedTokens.partyToken.x, involvedTokens.partyToken.y));
            }

            if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
                setTimeout(function () {
                    Logger.debug(`switching HotPan BACK (useHotPan: ${useHotPanIfAvailable})`);
                    HotPan.switchBack(true); // true means: silentMode (no UI message)
                }, 1000);
            }
        } catch (e) {
            Logger.error(false, e); // This will also print an error msg to the screen
            return;
        } finally {
            await PartyCruncher.setBusy(false);
        }

        Logger.debug(`FINDing of party #${partyNo} complete.`);
        await PartyCruncher.setBusy(false);
    }

    #collectValidatedTokenNamesFromModuleSettings(partyNo) {
        let memberTokenNamesString = Config.setting(`memberTokenNames${partyNo}`);
        let partyTokenNameString = Config.setting(`partyTokenName${partyNo}`);
        let namesFromSettings = this.#collectNamesFromStrings(partyNo, memberTokenNamesString, partyTokenNameString);
        return this.#createPartyDefinition(partyNo, namesFromSettings);
    }

    /**
     * Parse & split given list of token names from module settings.
     * Throw meaningful UI errors if anything isn't valid.
     * @param partyNo
     * @param memberTokenNamesString
     * @param partyTokenNameString
     * @returns {{partyTokenName: string[], memberTokenNames: string[]}}
     */
    #collectNamesFromStrings(partyNo = 1, memberTokenNamesString, partyTokenNameString) {

        // Parse & split given list of party names from module settings
        let memberTokenNames = memberTokenNamesString
            .split(",")
            .filter(name => name.length > 0); // ignore empty strings resulting from input like ",," or ", ,"
        let partyTokenNames = partyTokenNameString
            .split(",")
            .filter(name => name.length > 0); // ignore empty strings resulting from input like ",," oder ", ,"

        Logger.debug("(PartyCruncher.#collectNamesFromStrings) ",
            "memberTokenNames:", memberTokenNames,
            "partyTokenNames:", partyTokenNames);

        return {
            memberTokenNames: memberTokenNames,
            partyTokenName: partyTokenNames
        };
    }

    #collectNamesFromTokenSelection() {
        let tokenNamesFound = Array.from(canvas.tokens.controlled.map(t => t.name));
        if (tokenNamesFound.length < 2) {
            throw new Error(
                Config.localize('errMsg.invalidNumberOfMemberTokens').replace("{maxMembers}", Config.globals.maxMembersPerParty));
        }

        const namesFromSelection = {
            memberTokenNames: tokenNamesFound,
            partyTokenName: null, // Still unassigned. Will be set by user input prompt
            partyTokenMode: null // Still unassigned. Will be set by user input prompt
        };
        Logger.debug("(PartyCruncher.#collectNamesFromTokenSelection) namesFromSelection (1):", namesFromSelection);

        return namesFromSelection;
    }

    #createPartyDefinition(partyNo = 1, names) {

        Logger.debug("(PartyCruncher.#createPartyDefinition) names (before validation): ", names);
        let errMsg = "";

        // Check 1: Do we have enough tokens? Do we have not too many tokens?
        if (
            !names.memberTokenNames || names.memberTokenNames.length === 0 || names.memberTokenNames[0] === "" ||
            !names.partyTokenName || names.partyTokenName === "") {
            errMsg =
                // Error: invalidTokenCount => Names do not represent exactly ONE group and MORE THAN ONE members.
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "- " + Config.localize(`setting.memberTokenNames#.name`).replace("#", partyNo) + ": <strong>[ " + names.memberTokenNames + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName#.name`).replace("#", partyNo) + ": <strong>[ " + names.partyTokenName + " ]</strong><br/>" +
                "<br/>" +
                "<strong>" + Config.localize(`errMsg.invalidTokenCount`) + "</strong>";
        }

        if (errMsg) {
            throw new Error(errMsg);
        }

        // Check 2 (only up to v13): Are there party members with the same name as the party token?
        if (Config.getGameMajorVersion() <= 13) {
            const membersIncludeParty = names.memberTokenNames.some(element => {
                return element === names.partyTokenName;
            });
            if (membersIncludeParty) {
                errMsg =
                    // Error: groupAndMembersIntersect => Names must not exist both as member and as group.
                    Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                    "<br/>" +
                    "- " + Config.localize(`setting.memberTokenNames#.name`).replace("#", partyNo) + ": <strong>[ " + names.memberTokenNames + " ]</strong><br/>" +
                    "- " + Config.localize(`setting.partyTokenName#.name`).replace("#", partyNo) + ": <strong>[ " + names.partyTokenName + " ]</strong><br/>" +
                    "<br/>" +
                    "<strong>" + Config.localize(`errMsg.groupAndMembersIntersect`) + "</strong>";
            }

            if (errMsg) {
                throw new Error(errMsg);
            }
        }

        // Remove duplicates
        names.memberTokenNames = [...new Set(names.memberTokenNames)];
        Logger.debug("(PartyCruncher.#createPartyDefinition) memberTokenNames after removing duplicates: ", names.memberTokenNames);

        // In "Placeholder" mode (as of v14), we need to expel the party token's name from the members list
        if (names.partyTokenMode === "PLACEHOLDER") {
            const removeIndex = names.memberTokenNames.indexOf(names.partyTokenName)
            if (removeIndex > -1) {
                names.memberTokenNames.splice(removeIndex, 1)
            }
            Logger.debug("(PartyCruncher.#createPartyDefinition) memberTokenNames after removing party token: ", names.memberTokenNames);
        }

        // Check 3: Is max number of members per party exceeded?
        // For anyone interested: The max number is a hard limit (thus hard-coded)!
        // It is due to the problem of having to calculate "outward spiraling" spawn positions
        // around the party token on EXPLODE.
        // See #getMovementPathToExplodePosition() for details, if you're really into such brain-busting math stuff - as I am NOT :-D
        if (names.memberTokenNames.length > Config.globals.maxMembersPerParty) {
            throw new Error(
                // Error: groupAndMembersIntersect => Names must not exist both as member and as group.
                Config.localize('errMsg.tooManyMemberTokens') + ` (${names.memberTokenNames.length})!<br/>` +
                Config.localize('errMsg.invalidNumberOfMemberTokens').replace("{maxMembers}", Config.globals.maxMembersPerParty) + `<br/>` +
                "<br/>" +
                Config.localize(`setting.memberTokenNames#.name`).replace("#", partyNo) + ": <strong>[ " + names.memberTokenNames + " ]</strong>"
            );
        }

        // Check 4: Does any of the member tokens exist more than once in the scene?
        // This is only for checking at this time. It will throw an error if some tokens are NOT unique, so we just can ignore the returned values for now
        this.#collectTokensByNamesIfUnique(names.memberTokenNames);
        this.#collectTokensByNamesIfUnique([names.partyTokenName])[0];

        const partyDefinition = {
            partyNo: partyNo,
            partyTokenName: names.partyTokenName,
            partyTokenMode: names.partyTokenMode,
            memberTokenNames: names.memberTokenNames
        };
        Logger.debug("(PartyCruncher.#createPartyDefinition) new partyDefinition: ", partyDefinition);
        return partyDefinition;
    }

    static async updatePartyConfig(partyNo, updates) {

        // Validate passed params
        if (partyNo === undefined || isNaN(partyNo) || partyNo < 1 || partyNo > Config.globals.maxNoOfParties) {
            Logger.error(`PartyCruncher.#updatePartyConfig - unable to store Party Config updates: partyNo missing or invalid (must be a number between 1 and ${Config.globals.maxNoOfParties}): `, partyNo, updates);
            return;
        }

        const allConfigs = PartyCruncher.#getAllPartyConfigs();
        if (allConfigs[partyNo] === undefined) {
            allConfigs[partyNo] = {};
        }
        Logger.debug(`PartyCruncher.#updatePartyConfig - preparing to store Party Config #${partyNo}: `, allConfigs[partyNo]);

        if (updates.definition !== undefined) {
            allConfigs[partyNo].definition = updates.definition;
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(`PartyCruncher.#updatePartyConfig - new definition: `, allConfigs[partyNo].definition);
        }

        if (updates.partyToken !== undefined) {
            allConfigs[partyNo].partyToken = updates.partyToken.toObject();
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(`PartyCruncher.#updatePartyConfig - new partyToken: `, allConfigs[partyNo].partyToken);
        }

        if (updates.memberTokens !== undefined) {
            allConfigs[partyNo].memberTokens = updates.memberTokens.map(mt => mt.toObject());
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(`PartyCruncher.#updatePartyConfig - new memberTokens: `, allConfigs[partyNo].memberTokens);
        }

        Config.modifySetting("partyConfigs", allConfigs);

        Logger.debug(`PartyCruncher.#updatePartyConfig - updated Config for Party #${partyNo}: `, allConfigs[partyNo]);
        Logger.debug(`PartyCruncher.#updatePartyConfig - new full config (all Parties): `, allConfigs);
    }


    /**
     * Identify and collect all the tokens corresponding to the names lists in the scene and register them for later.
     * Throw meaningful UI error if some tokens can't be found or are not unique.
     * @param names
     * @param partyNo
     * @returns {{partyToken: any, memberTokens: *[]}}
     */
    #collectInvolvedTokens(names, partyNo = 1) {

        let errMsg = "";

        // Check 1: Does any of the member tokens exist more than once in the scene?
        const memberTokens = this.#collectTokensByNamesIfUnique(names.memberTokenNames);
        const partyToken = this.#collectTokensByNamesIfUnique([names.partyTokenName])[0];

        // Check 2: Are there any tokens that could NOT be found?
        let missingTokens = names.memberTokenNames
            .filter(() => false/*!memberTokens // (DEACTIVATED FEATURE as of 11.0.4)
                .map(t => t.name.toUpperCase())
                .includes((name))*/);
        if (!partyToken) {
            missingTokens.push(names.partyTokenName);
        }

        if (missingTokens.length > 0) {
            errMsg += `${Config.localize(`errMsg.tokensMissingInScene`)}: ${missingTokens.join(`, `)}<br/>`;
        }

        if (errMsg) {
            errMsg =
                // Collect all errors into one biiiiig message
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "- " + Config.localize(`setting.memberTokenNames#.name`).replace("#", partyNo) +
                ": <strong>[ " + Config.setting(`memberTokenNames${partyNo}`) + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName#.name`).replace("#", partyNo) +
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
     * Searches the current scene for all token names given in names, and creates an array from them.
     * Throws an error if multiple tokens with the same name are found.
     * @param names
     * @returns tokensFound {*[]}
     */
    #collectTokensByNamesIfUnique(names) {

        let tokensFound = [];
        let errMsg = "";

        for (let token of canvas.tokens.ownedTokens) {

            Logger.debug(`(PartyCruncher.#collectTokensByNamesIfUnique) Checking if scene token '${token.name}' is in list: ...`, names);

            if (names.map(n => n.trim().toLowerCase()).includes(token.name.trim().toLowerCase())) {

                // Hurray, we've found a  token from the list!
                if (tokensFound.filter(t => t.name === token.name).length === 0) { // not yet registered
                    tokensFound.push(token);
                    Logger.debug(`(PartyCruncher.#collectTokensByNamesIfUnique) Hurray! Found token from the list: [${token.name}]!`);
                } else {
                    // Error: ... but it's a duplicate!
                    errMsg += `[${token.name}] ${Config.localize(`errMsg.notUniqueInScene`)}<br/>`;
                }
            }
        }

        if (errMsg) {
            errMsg =
                // Collect all errors into one biiiiig message
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                names.join(`,`) + "<br/>" +
                "<br/>" +
                errMsg;
            throw new Error(errMsg);
        }

        return tokensFound;
    }

    /**
     * Determine current state of involved tokens and derive from it, which actions is to be next (Actions.CRUNCH or Actions.EXPLODE).
     * Throw a meaningful UI error if action cannot be determined, because the state of any token doesn't make sense
     * @param involvedTokens
     * @param partyNo
     * @returns {symbol}
     */
    #determineRequiredAction(involvedTokens, partyNo) {

        let noOfMembersVisible = involvedTokens?.memberTokens.filter(t => !t.document.hidden);
        let isPartyVisible = (!involvedTokens?.partyToken?.document.hidden);

        let errMsg = "";

        // Check: Either the party token or any of the member tokens need to be visible
        if (!isPartyVisible && noOfMembersVisible.length === 0) {
            errMsg = Config.localize('errMsg.membersAndPartyAllHidden');
        }

        if (errMsg) {
            errMsg =
                Config.localize('errMsg.cannotDetermineAction') + ":<br/>" +
                "<br/>" +
                errMsg + ":<br/>" +
                "<br/>" +
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "- " + Config.localize(`setting.memberTokenNames#.name`).replace("#", partyNo) + ": <strong>[ " + Config.setting(`memberTokenNames${partyNo}`) + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName#.name`).replace("#", partyNo) + ": <strong>[ " + Config.setting(`partyTokenName${partyNo}`) + " ]</strong>";
            throw new Error(errMsg);
        }

        return (isPartyVisible) ? PartyCruncher.Actions.EXPLODE : PartyCruncher.Actions.CRUNCH;
    }

    /**
     *
     * @param requiredAction
     * @param involvedTokens
     */
    #getTarget(requiredAction, involvedTokens) {
        if (requiredAction === PartyCruncher.Actions.CRUNCH) {

            if (canvas.tokens.controlled.length === 1 && involvedTokens.memberTokens.includes(canvas.tokens.controlled[0])) {
                // If only one of the members is selected, use it as the target
                // That way the GM can decide where to place the party token
                let targetToken = canvas.tokens.controlled[0];
                Logger.debug("(PartyCruncher.#getTarget) targetToken: ", targetToken);
                return targetToken;
            }

            // Release any currently active tokens
            canvas.tokens.releaseAll();

            // select all the member tokens, and use the first one as the target
            involvedTokens.memberTokens.forEach(t => t.control({releaseOthers: false}));
            return canvas.tokens.controlled[0];

        } else { // EXPLODE
            return involvedTokens.partyToken;
        }
    }

    static async #crunchParty(partyNo) {

        // Validate passed params
        if (partyNo === undefined || isNaN(partyNo) || partyNo < 1 || partyNo > Config.globals.maxNoOfParties) {
            Logger.error(`PartyCruncher.#crunchParty - unable to store Party Config updates: partyNo missing or invalid (must be a number between 1 and ${Config.globals.maxNoOfParties}): `, partyNo, updates);
            return;
        }

        // Retrieve stored partyConfig
        const partyConfig = PartyCruncher.#getPartyConfig(partyNo);
        Logger.debug(`PartyCruncher.#crunchParty(${partyNo}): partyConfig: `, partyConfig);

        // TODO - Check if Party Token already exists in Scene
        // ... If so: Prompt for replace, keep or abort

        // Gather member tokens in scene
        const memberTokensToRemove = [];
        for (let memberName of partyConfig.definition.memberTokenNames) {
            const tokenFound = canvas.scene.tokens.find(t => t.name === memberName);
            if (tokenFound === undefined) {
                Logger.info(`PartyCruncher.#crunchParty - member token '${memberName}' not found in scene => skipped`);
                continue;
            }
            if (memberName === partyConfig.definition.partyTokenName) {
               Logger.debug(`PartyCruncher.#crunchParty - member token '${memberName}' is also the party token => skipped`);
               continue;
            }
            memberTokensToRemove.push(tokenFound);
            Logger.debug(`PartyCruncher.#crunchParty - member token '${memberName}' found => added to list for removal`, tokenFound);
        }

        // TODO - Move all members to center

        // TODO - Identify target token
        // TODO - If "replace" was chosen above:
        // ... Update position and relative scale of existing token to reflect target token
        // ... otherwise:
        // ... - read party token data from storage
        // ... - update to reflect target token's pos and scale
        // ... - create party token in scene

        // TODO - Toggle Party Token on if it should be hidden


        // Store member tokens and remove tokens from scene
        if (memberTokensToRemove.length > 0) {
            const updates = {
                memberTokens: memberTokensToRemove
            }
            await PartyCruncher.updatePartyConfig(partyNo, updates);

            // TODO - Add sound and JB2A animation (encapsulate it in function!)

            Logger.debug(`PartyCruncher.#crunchParty - removing ${memberTokensToRemove.length} tokens from scene: `, memberTokensToRemove);
            for (const member of memberTokensToRemove) {
                await member.delete();
            }
        } else {
            Logger.warn(`PartyCruncher.#crunchParty - No member tokens found in Scene for Party #${partyNo} [${partyConfig.definition.partyTokenName}]`);
        }
    }

    /**
     * @deprecated since v14
     * Do it: Crunch my party NOW!
     * @param involvedTokens
     * @param targetToken - Here this is the one member selected, providing the new position of the party token
     */
    async #crunchParty_v13(involvedTokens, targetToken) {

        // Release any currently active tokens
        canvas.tokens.releaseAll();

        let audioPath = Config.setting('playAudio4Crunch') ? `${Config.setting('audioFile4Crunch').trim()}` : Config.NO_AUDIO_FILE;
        if (!audioPath) audioPath = Config.NO_AUDIO_FILE;
        Logger.debug(`audioPath: ${audioPath}`);
        Logger.debug(`Audio base dir (window.location.pathname): ${window.location.pathname}`);

        // If JB2A_DnD5e && AA are installed, play the animation
        if ((optionalDependenciesAvailable.includes('JB2A_DnD5e') || optionalDependenciesAvailable.includes('jb2a_patreon')) && optionalDependenciesAvailable.includes('autoanimations')) {
            let animationPath = Config.setting('animation4Crunch');
            if (animationPath) {
                Logger.debug(`(PartyCruncher.#crunchParty) playing CRUNCH animation: ${animationPath}`);
                new Sequence()
                    .effect()
                    .file(animationPath)
                    .atLocation(targetToken)
                    .scaleToObject(4)
                    .randomRotation()
                    .sound().file(audioPath)
                    .play();
            }
        } else if (audioPath) // Play audio without JB2A && AA
        {
            foundry.audio.AudioHelper.play({
                src: audioPath,
                volume: 1,
                autoplay: true,
                loop: false
            }, true);
        }

        // Crunch step #1: Everybody gather at the target now!!
        // We're reversing the order temporarily, because this is visually much nicer (especially with large groups).
        // It processes outer tokens first, inner ones last.
        let tokenUpdates = [];
        for (const token of involvedTokens.memberTokens.reverse()) {
            // Teleport to the target (which is the party's "center")
            tokenUpdates.push(this.#getTokenTeleportUpdate(token, targetToken.position, targetToken.document.elevation, false));
        }

        // Then teleport the party token to the crunch target's position (still invisible)
        tokenUpdates.push(this.#getTokenTeleportUpdate(involvedTokens.partyToken, targetToken.position, targetToken.document.elevation, true));

        // Finish step #1: Teleport!
        await this.#teleport(tokenUpdates);

        // Crunch step #2: Everybody, go invisible and move out of the way!
        tokenUpdates = [];
        for (const token of involvedTokens.memberTokens) {
            tokenUpdates.push(this.#getTokenTeleportUpdate(token, {x:0, y:0}, null, true));
        }

        // Move the party token into view and render it visible
        tokenUpdates.push(this.#getTokenTeleportUpdate(involvedTokens.partyToken, targetToken.position, null, false));

        // Finish step #2: Teleport!
        await this.#teleport(tokenUpdates);

        // Don't forget to set back memberToken order
        involvedTokens.memberTokens.reverse();

        // Set new focus on group token, then we're done here!
        involvedTokens.partyToken.control({releaseOthers: true});
    }

    async #teleport(tokenUpdates) {
        // Logger.debug(`(PartyCruncher.#teleport) tokenUpdates: `, tokenUpdates);
        if (Config.getGameMajorVersion() >= 13) {
            for (const update of tokenUpdates) {
                const tokenDoc = canvas.scene.tokens.get(update._id);
                if (!tokenDoc) return;

                await tokenDoc.update({hidden: update.hidden, elevation: update.elevation});

                // temporarily change the token's movementAction to a type supporting teleport (i.e. "displace" or "blink", to avoid wall collisions
                const actionKey = "blink";
                const actionConfig = CONFIG.Token?.movement?.actions?.[actionKey];
                if (!actionConfig) {
                    Logger.error(false, `${Config.localize("errMsg.movementActionNotFound")}: ${actionKey}.\n${Config.localize("errMsg.pleaseReportThisError")}`);
                    return;
                }
                const previousAction = tokenDoc.movementAction;

                try {
                    // set the token to use the teleport-capable action
                    if (previousAction !== actionKey) await tokenDoc.update({movementAction: actionKey});

                    await tokenDoc.move([{x: update.x, y: update.y}], // waypoints array
                        {
                            method: "config", // this enforces that the movementAction set above is used, and nothing else
                            showRuler: false,    // don’t display a path ruler
                            autoRotate: false,   // don’t rotate token to face the move direction
                            constrainOptions: {ignoreWalls: true} // documented option; the action's teleport flag is what really matters
                        });
                } finally {
                    try {
                        // restore previous movementAction if we changed it
                        await tokenDoc.update({movementAction: previousAction});
                    } catch (err) {
                        Logger.error(false, "Failed to restore previous movementAction:", err);
                    }
                }
            }
        } else { // v12 and older
            await canvas.scene.updateEmbeddedDocuments("Token", tokenUpdates, {
                animate: false, // no sliding animation
            });
        }
    }

        /**
     *
     * @param involvedTokens
     * @param targetToken - Here this is always the party token itself, providing the anchor point for the member tokens
     */
    async #explodeParty(involvedTokens, targetToken) {

        if (!canvas.ready) return false;

        // Release any currently active tokens
        canvas.tokens.releaseAll();

        let audioPath = Config.setting('playAudio4Explode') ? `${Config.setting('audioFile4Explode').trim()}` : Config.NO_AUDIO_FILE;
        if (!audioPath) audioPath = Config.NO_AUDIO_FILE;
        Logger.debug(`audioPath: ${audioPath}`);
        Logger.debug(`Audio base dir (window.location.pathname): ${window.location.pathname}`);

        // If JB2A_DnD5e && AA are installed, play the animation
        if ((optionalDependenciesAvailable.includes('JB2A_DnD5e') || optionalDependenciesAvailable.includes('jb2a_patreon')) && optionalDependenciesAvailable.includes('autoanimations')) {
            let animationPath = Config.setting('animation4Explode');
            if (animationPath) {
                Logger.debug(`(PartyCruncher.#explodeParty) playing EXPLODE animation: ${animationPath}`);
                new Sequence()
                    .effect()
                    .file(animationPath)
                    .atLocation(targetToken)
                    .scaleToObject(4)
                    .randomRotation()
                    .sound().file(audioPath)
                    .play();
            }
        } else if (audioPath) // Play audio without JB2A && AA
        {
            foundry.audio.AudioHelper.play({
                src: audioPath,
                volume: 1,
                autoplay: true,
                loop: false
            }, true);
        }

        // Explode step #1: Everybody, grab some drinks and show up at the "party center"
        let tokenUpdates = [];
        for (const memberToken of involvedTokens.memberTokens) {
            // Then teleport them to the "party center", but remain invisible for now (waiting for each token's glamorous entry later in step #2)
            tokenUpdates.push(this.#getTokenTeleportUpdate(memberToken, involvedTokens.partyToken.position, involvedTokens.partyToken.document.elevation, false));
        }

        // Move the party token out of the way and render it invisible ("WE are the party now!")
        tokenUpdates.push(this.#getTokenTeleportUpdate(involvedTokens.partyToken, {x: 0, y: 0}, null, true));

        // Finish step #1: Teleport!
        await this.#teleport(tokenUpdates);

        // // Explode step #2: Swarm out and take your places
        let tokenCounter = 0;
        for (const memberToken of involvedTokens.memberTokens) {
            //Set selection to current token.
            //Otherwise, movement by moveMany below won't have any effect
            memberToken.control({releaseOthers: true});

            // Position each token along an "outward spiral" around the origin (which is the party token)
            let movementPath = PartyCruncher.#getMovementPathToExplodePosition(tokenCounter++);
            Logger.debug(`(PartyCruncher.#explodeParty) [${memberToken.name}]: movementPath =>`, movementPath);

            if (Config.getGameMajorVersion() >= 13) {
                const tokenDoc = memberToken.document; // or canvas.scene.tokens.get(memberToken.id)
                if (!tokenDoc) return;

                const relative = movementPath;      // {x: dx, y: dy} from your matrix
                const gridSize = canvas.grid.size;

                let targetX = tokenDoc.x + relative.x * gridSize;
                let targetY = tokenDoc.y + relative.y * gridSize;
                // Snap to nearest grid
                const point = {x: targetX, y: targetY, elevation: tokenDoc.elevation};
                Logger.debug(`(PartyCruncher.#explodeParty) [${memberToken.name}]: point =>`, point);
                const snapped = canvas.grid.getSnappedPoint(point, CONST.GRID_SNAPPING_MODES.CENTER);
                Logger.debug(`(PartyCruncher.#explodeParty) [${memberToken.name}]: snapped =>`, snapped);
                targetX = snapped.x;
                targetY = snapped.y;

                let finalX = tokenDoc.x;
                let finalY = tokenDoc.y;

                const steps = Math.max(Math.abs(relative.x), Math.abs(relative.y));

                for (let i = 1; i <= steps; i++) {
                    const stepX = tokenDoc.x + (targetX - tokenDoc.x) * (i / steps);
                    const stepY = tokenDoc.y + (targetY - tokenDoc.y) * (i / steps);

                    const tokenCenter = memberToken.center;
                    const stepCenter = { x: stepX + memberToken.w / 2, y: stepY + memberToken.h / 2 };

                    const collision = CONFIG.Canvas.polygonBackends.move.testCollision(
                        tokenCenter, stepCenter, {
                            type: "move", // This is effectively a value of CONST.WALL_RESTRICTION_TYPES
                            mode: "any"
                    });

                    if (collision) {
                        break; // stop BEFORE wall
                    }

                    const snappedStep = canvas.grid.getSnappedPosition(stepX, stepY, 0);
                    finalX = snappedStep.x;
                    finalY = snappedStep.y;
                }

                await tokenDoc.move(
                    [{ x: finalX, y: finalY }],
                    {
                        method: "api",
                        showRuler: true,
                        constrainOptions: { ignoreWalls: false },
                        animation: { duration: 400 }
                    }
                );

            } else { // v12 or older}

                // Detect directions of this token's movement
                let xdir = (movementPath.x >= 0) ? 1 : -1;
                let ydir = (movementPath.y >= 0) ? 1 : -1;
                Logger.debug('(PartyCruncher.#explodeParty) xdir, ydir', xdir, ydir);

                let safetyCount = 0;

                for (let x = 0; x !== movementPath.x && safetyCount++ < 10; x += xdir) {
                    // take one step along movementPath.x
                    await this.#pushTokenByOneStep(xdir, 0, memberToken);
                    await Config.sleep(200);
                }
                for (let y = 0; y !== movementPath.y && safetyCount++ < 10; y += ydir) {
                    // take one step along movementPath.y
                    await this.#pushTokenByOneStep(0, ydir, memberToken);
                    await Config.sleep(200);
                }
            }
        }

        // Now we need to loop over all members once more to select them all
        // If we had done this within the first loop, together with the moving, the tokens movements
        // would interfere with each others cumulatively.
        for (const memberToken of involvedTokens.memberTokens) {
            memberToken.control({releaseOthers: false});
        }
    }

    #getTokenTeleportUpdate(token, targetPosition, targetElevation, hidden) {
        const effectiveTargetPosition = (targetPosition != null) ? targetPosition : token.position; // NULL target means: don't move, stay where you are!
        const effectiveTargetElevation = (targetElevation != null) ? targetElevation : token.document.elevation;
        return {
            _id: token.document._id,
            x: effectiveTargetPosition.x,
            y: effectiveTargetPosition.y,
            elevation: effectiveTargetElevation,
            hidden: hidden
        };
    }

    /**
     * Works with v12 and older only
     * @param x
     * @param y
     * @param token
     * @returns {Promise<unknown>}
     */
    async #pushTokenByOneStep(x, y, token) {
        return new Promise(resolve => {
            // v12 or older
            // Force activation of the Token Layer in the UI
            // Otherwise, the moveMany() calls further below won't work
            canvas.tokens.activate();
            let tokenLayer = canvas.activeLayer;
            if (!(tokenLayer instanceof TokenLayer)) return false;

            Logger.debug('(PartyCruncher.#pushTokenByOneStep) tokenLayer, x, y, token.name', tokenLayer, x, y, token.name);
            resolve(tokenLayer.moveMany(
                {dx: x, dy: y, rotate: false, ids: token.id}));
        });
    }

    /**
     * Delivers clockwise "outwards-spiraling" offsets in grid cell coordinates, relative to a given origin in the center (0, 0).
     * Normally, we should use some brains here (for a change). Real experts (and I am NOT one of them), would do
     * this with fancy "spiraling matrix maths", like this crazy stuff over here:
     * https://stackoverflow.com/questions/3706219/algorithm-for-iterating-over-an-outward-spiral-on-a-discrete-2d-grid-from-the-or
     * But I just don't get that (and as I am tooo lazy anyway).
     * Also, I don't want a real spiral, but rather a custom pattern.
     * So I'll just do it the unelegant way, fixing the maximum of 25 movement paths to 25 fixed positions in a hard-coded array!
     * Quite dull, isn't it? :)
     * @param counter
     */
    static #getMovementPathToExplodePosition(counter) {
        let movementVector = [
            {x: 0, y: 0}, // this is the origin
            // now the inner "ring" of 8 positions
            {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: -1}, {x: 1, y: 1}, {x: -1, y: 1}, {x: -1, y: -1},
            // and the outer "ring" with additional 16 positions
            {x: -1, y: -2}, {x: 0, y: -2}, {x: 1, y: -2}, {x: 2, y: -2}, {x: 2, y: -1}, {x: 2, y: 0}, {x: 2, y: 1}, {x: 2, y: 2},
            {x: 1, y: 2}, {x: 0, y: 2}, {x: -1, y: 2}, {x: -2, y: 2}, {x: -2, y: 1}, {x: -2, y: 0}, {x: -2, y: -1}, {x: -2, y: -2}
        ];
        return movementVector[counter];
    }

    static async #promptForPartyDefinition(partyNo = 1) {

        const title = Config.localize('promptForPartyDefinition.title');

        if (Config.getGameMajorVersion() <= 13) {
            const content =
                `<form>
                  <div>
                    <legend>${Config.localize('promptForPartyDefinition.text')}</legend>
                    <input type='text' name='partyTokenName' value="<name>"/>
                  </div>
                </form>`;

            return new Promise(resolve => {
                const data = {
                    title: title,
                    content: content.replace("<name>", Config.setting(`partyTokenName${partyNo}`)),
                    buttons: {
                        submit: {
                            icon: Config.globals.iconSubmit,
                            label: Config.localize('saveButton'),
                            callback: html => resolve(
                                PartyCruncher.#resolvePromptForPartyDefinition(
                                    html[0].querySelector('form').partyTokenName.value, null).tokenName)
                        },
                        cancel: {
                            icon: Config.globals.iconCancel,
                            label: Config.localize('cancelButton'),
                            callback: () => resolve({cancelled: true})
                        }
                    },
                    default: 'submit',
                    close: () => resolve({cancelled: true})
                }
                new Dialog(data, null).render(true);
            });
        }
        // v14 or higher
        else {
            let content = `
            <div style="max-height: 400px; overflow: scroll">
            <p>${Config.localize('promptForPartyDefinition.text')}</p>
            `;
            for(const t of canvas.tokens.controlled) {
                const checked = (canvas.tokens.controlled[0].name === t.name) ? " checked" : "";
                content += `<label><input type="radio" name="tokenChoice" value="${t.name}"${checked}/>${t.name}</label><br/>`;
            }
            content += `
                <hr>
                <p>${Config.localize('promptForPartyDefinition.partyTokenMode.text')}</p>
                <label><input type="radio" name="modeChoice" value="PLACEHOLDER" checked/>${Config.localize('promptForPartyDefinition.partyTokenMode.placeholder')}</label><br/>
                <label><input type="radio" name="modeChoice" value="MEMBER"/>${Config.localize('promptForPartyDefinition.partyTokenMode.member')}</label><br/>`;
            content += `
                <hr>
                <p>${Config.localize('promptForPartyDefinition.partyNo.text')}</p>`;

            // Make partyNo selectable: Populate an option list from all stored configs, limited by MAX_NO_OF_PARTIES
            const allConfigs = PartyCruncher.#getAllPartyConfigs();
            for(let i = 1; i <= Config.globals.maxNoOfParties; i++) {
                let partyName, members;
                if (allConfigs[i] !== undefined) {
                    partyName = allConfigs[i].definition.partyTokenName;
                    members = " (" + allConfigs[i].definition.memberTokenNames.join(", ") + ")";
                } else {
                    partyName = "EMPTY";
                    members = "";
                }
                const checked = (i === partyNo) ? " checked" : "";
                content += `<label>
                                <input type="radio" name="partyNoChoice" 
                                       value="${i}"${checked}
                                       alt="${partyName}"/>${i} - ${partyName}${members}
                            </label><br/>`;
            }
            content += `</div>`;
            //Logger.debug("PartyCruncher.#promptForPartyDefinition - content", content);

            return new Promise(resolve => {
                new foundry.applications.api.DialogV2({
                    window: { title: title },
                    content: content,
                    buttons: [
                        {
                            action: "submit",
                            label: Config.localize('saveButton'),
                            default: true,
                            callback: (event, button) => resolve(
                                PartyCruncher.#resolvePromptForPartyDefinition(
                                    button.form.elements.tokenChoice.value,
                                    button.form.elements.modeChoice.value,
                                    button.form.elements.partyNoChoice.value))
                        },
                        {
                            action: "cancel",
                            label: Config.localize('cancelButton'),
                            callback: () => resolve({cancelled: true})
                        }]
                }).render({ force: true });
            });
        }
    }

    static async #promptForImmediateCrunch(partyNo) {

        const content = `
            <form>
                <div>
                    <legend>${Config.localize('promptForCrunchAfterGrouping.text')}</legend>
                </div>
            </form>`;

        if (Config.getGameMajorVersion() <= 13) {
            return new Promise(resolve => {
                const data = {
                    title: Config.localize('promptForCrunchAfterGrouping.title'),
                    content: content,
                    buttons: {
                        yes: {
                            icon: Config.globals.iconSubmit,
                            label: Config.localize('promptForCrunchAfterGrouping.yes'),
                            callback: () => resolve(PartyCruncher.#crunchParty(partyNo))
                        },
                        no: {
                            icon: Config.globals.iconCancel,
                            label: Config.localize('promptForCrunchAfterGrouping.no'),
                            callback: () => resolve({cancelled: true})
                        }
                    },
                    default: 'yes',
                    close: () => resolve({cancelled: true})
                }
                new Dialog(data, null).render(true);
            });
        }
        // v14 or higher
        else {
            return new Promise(resolve => {
                new foundry.applications.api.DialogV2({
                    window: { title: Config.localize('promptForCrunchAfterGrouping.title') },
                    content: content,
                    buttons: [
                        {
                            action: "yes",
                            label: Config.localize('promptForCrunchAfterGrouping.yes'),
                            default: true,
                            callback: () => resolve(PartyCruncher.#crunchParty(partyNo))
                        },
                        {
                            action: "no",
                            label: Config.localize('promptForCrunchAfterGrouping.no'),
                            callback: () => resolve({cancelled: true})
                        }]
                }).render({ force: true });
            });
        }
    }

    static #resolvePromptForPartyDefinition(tokenChoice, modeChoice, partyNoChoice) {
        let result = {
            tokenName: tokenChoice,
            mode: modeChoice.toUpperCase(),
            partyNo: partyNoChoice,
        };
        Logger.debug('(PartyCruncher.#resolvePromptForPartyDefinition) user chosen value: ', result);
        return result;
    }

    static #getAllPartyConfigs() {
        const partyConfigs = foundry.utils.deepClone(
            Config.setting("partyConfigs")
        );
        Logger.debug('(PartyCruncher.#getAllStoredPartyConfigs) reading all partyConfigs: ', partyConfigs);
        return partyConfigs;
    }

    static #getPartyConfig(partyNo) {
        try {
            return foundry.utils.deepClone(Config.setting("partyConfigs")[partyNo]);
        } catch (e) {
            Logger.error(true, 'PartyCruncher.#getPartyConfig', e);
            ui.notifications.error(`[${Config?.globals?.modTitle ?? "" }] Can't read Party Configuration for Party #${partyNo}. Please check the logs`);
        }
    }
}
