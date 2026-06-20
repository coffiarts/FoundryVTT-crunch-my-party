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
            PartyCruncher.setBusy(false);
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
        return PartyCruncher.#isBusy;
    }

    static async setBusy(isBusy) {
        //if (!isBusy) await Config.sleep(1000);
        PartyCruncher.#isBusy = isBusy;
        Logger.debug("(PartyCruncher.setBusy) ", isBusy ? "BUSY!" : "NOT BUSY")
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

        Logger.debug(`(PartyCruncher.toggleParty) TOGGLE - partyNo: #${partyNo}, useHotPanIfAvailable: ${useHotPanIfAvailable} ...`);

        try {

            await PartyCruncher.setBusy(true);

            // ==================================================================================================
            // Step 1 - Read partyConfig
            // ==================================================================================================
            const partyConfig = PartyCruncher.#getPartyConfig(partyNo);
            if (!PartyCruncher.isValidDefinition(partyConfig)) {
                return;
            }
            Logger.debug(`(PartyCruncher.toggleParty) partyConfig(${partyNo}) is valid: `, partyConfig);

            // ==================================================================================================
            // Step 2 - auto-determine new requested state
            // ==================================================================================================
            // TODO - Replace by dynamic detection
            const requestedState = PartyCruncher.#detectRequestedState(partyConfig);

            // ==================================================================================================
            // Step 3 - And fiiiiiiiiinally.... DO IT!!
            // ==================================================================================================
            Logger.debug(`(PartyCruncher.toggleParty) - lastKnownState of party#${partyNo}: ${partyConfig.lastKnownState}`);
            switch (requestedState) {
                case Config.globals.states.CRUNCHED:
                    Logger.info(`Crunching party ${partyNo} ...`, partyConfig);
                    await PartyCruncher.#crunchParty(partyConfig);
                    break;
                case Config.globals.states.EXPLODED:
                    Logger.info(`Exploding party ${partyNo} ...`, partyConfig);
                    await PartyCruncher.#explodeParty(partyConfig);
                    break;
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

    static async #panToTarget(targetToken, useHotPanIfAvailable) {
        canvas.tokens.releaseAll();
        if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
            Logger.debug(`(PartyCruncher.toggleParty) switching HotPan ON (useHotPan: ${useHotPanIfAvailable})`);
            HotPan.switchOn(true); // true means: silentMode (no UI message)
        }
        targetToken.control({releaseOthers: true});

        await canvas.animatePan(PartyCruncher.#getTokenCenter(targetToken));

        if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
            setTimeout(function () {
                Logger.debug(`(PartyCruncher.toggleParty) switching HotPan BACK (useHotPan: ${useHotPanIfAvailable})`);
                HotPan.switchBack(true); // true means: silentMode (no UI message)
            }, 1000);
        }
    }

    static #getTokenCenter(targetToken) {
        let x = targetToken.x, y = targetToken.y;
        return targetToken.getCenterPoint({x, y});
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

        try {

            await PartyCruncher.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate current token selection, with input from the GM
            // ==================================================================================================
            // grab all relevant information from all currently selected tokens
            let propertiesFromSelection = PartyCruncher.#collectNamesFromTokenSelection();

            // ask the GM for the name and mode of the party token to use
            let partyDefinitionInput = await PartyCruncher.#promptForPartyDefinition(partyNo);
            if (partyDefinitionInput.cancelled) {
                return;
            } else {
                propertiesFromSelection.partyTokenName = partyDefinitionInput.tokenName;
                propertiesFromSelection.partyTokenMode = partyDefinitionInput.mode;
                partyNo = partyDefinitionInput.partyNo;
                Logger.debug(`(PartyCruncher.groupParty) propertiesFromSelection for grouping party #${partyNo}:`, propertiesFromSelection);
            }
            const partyDefinition = PartyCruncher.#createPartyDefinition(partyNo, propertiesFromSelection);
            const partyToken = canvas.tokens.ownedTokens.find(t => t.name === partyDefinition.partyTokenName);
            const memberTokens = canvas.tokens.ownedTokens.filter(t => propertiesFromSelection.memberTokenNames.indexOf(t.name > -1));

            // ==================================================================================================
            // Step 2 - Update user prefs in module settings with detected names lists
            // ==================================================================================================
            const updates = {
                definition: partyDefinition,
                partyToken: partyToken,
                memberTokens: memberTokens,
                lastKnownState: Config.globals.states.EXPLODED
            };
            await PartyCruncher.updatePartyConfig(partyNo, updates);

            // Remove party token from scene if necessary
            if (partyDefinition.partyTokenMode === Config.globals.partyTokenModes.PLACEHOLDER) {
                await partyToken.document.delete();
            }

            // ==================================================================================================
            // Step 3 - Confirm in UI that group assignment was successful
            // ==================================================================================================
            let msg =
                `${Config.localize('groupingConfirmation')
                    .replace('{partyNo}', partyNo)
                    .replace('{partyTokenName}', partyDefinition.partyTokenName
                    )}:` +
                `<br/><br/>` +
                partyDefinition.memberTokenNames.map(n => (n === partyDefinition.partyTokenName) ? "<strong/>"+n+"</strong>" : n).join(`<br/>`);
            ui.notifications.info(msg);
            await ChatMessage.create({
                whisper: ChatMessage.getWhisperRecipients("GM"),
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

        try {

            await PartyCruncher.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate party definitions from module settings
            // ==================================================================================================
            // grab raw input values from user prefs
            let validatedNames = PartyCruncher.#collectValidatedTokenNamesFromModuleSettings(partyNo);
            Logger.debug("(PartyCruncher.findParty) validatedNames: ", validatedNames);

            // ==================================================================================================
            // Step 2 - gather and validate all the involved tokens from current scene
            // ==================================================================================================
            let involvedTokens = PartyCruncher.#collectInvolvedTokens(validatedNames, partyNo);
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

    static #collectValidatedTokenNamesFromModuleSettings(partyNo) {
        let memberTokenNamesString = Config.setting(`memberTokenNames${partyNo}`);
        let partyTokenNameString = Config.setting(`partyTokenName${partyNo}`);
        let propertiesFromSettings = PartyCruncher.#collectNamesFromStrings(partyNo, memberTokenNamesString, partyTokenNameString);
        return PartyCruncher.#createPartyDefinition(partyNo, propertiesFromSettings);
    }

    static async deleteParty(partyInfo) {
        const message = Config.localize("confirmDeleteParty")
            .replace("#", partyInfo.partyNo)
            .replace("{partyName}", partyInfo.partyName)
            .replace("{noOfMembers}", partyInfo.noOfMembers);
        const prompt = await PartyCruncher.#promptForSimpleConfirmation(message);
        if (prompt.ok) {
            let allConfigs = PartyCruncher.#getAllPartyConfigs();
            allConfigs[partyInfo.partyNo] = null;
            Config.modifySetting("partyConfigs", allConfigs);
        }
    }

    /**
     * Parse & split given list of token names from module settings.
     * Throw meaningful UI errors if anything isn't valid.
     * @param partyNo
     * @param memberTokenNamesString
     * @param partyTokenNameString
     * @returns {{partyTokenName: string[], memberTokenNames: string[]}}
     */
    static #collectNamesFromStrings(partyNo = 1, memberTokenNamesString, partyTokenNameString) {

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

    static #collectNamesFromTokenSelection() {

        let tokensSelected = Array.from(canvas.tokens.controlled.map(t => t.name));

        // Pre-Check 1: Is number of tokens within allowed range?
        if (tokensSelected.length < 2 || tokensSelected.length > Config.globals.maxMembersPerParty) {
            throw new Error(
                Config.localize('errMsg.invalidNumberOfMemberTokens').replace("{maxMembers}", Config.globals.maxMembersPerParty));
        }

        // Pre-Check 2: None of the selected tokens may exist more than once in the scene (by name, case-insensitive)
        const namesToCheck = Array.from(new Set(canvas.tokens.controlled.map(t => t.name)));

        const duplicates = PartyCruncher.#countTokensByNames(namesToCheck, 2);

        if (duplicates.length > 0) {
            throw new Error(
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/><br/>" +
                "<strong>" + Config.localize(`errMsg.duplicateTokens`) + "</strong><br/><br/>" +
                duplicates.map(d => d.name + ": " + d.count + "x").join("</br>"));
        }

        const namesFromSelection = {
            memberTokenNames: tokensSelected,
            partyTokenName: null, // Still unassigned. Will be set by user input prompt
            partyTokenMode: null // Still unassigned. Will be set by user input prompt
        };
        Logger.debug("(PartyCruncher.#collectNamesFromTokenSelection) propertiesFromSelection:", namesFromSelection);

        return namesFromSelection;
    }

    static #countTokensByNames(namesArr, minCount = 1) {

        Logger.debug("PartyCruncher.#countTokensByNames: ", namesArr.join(", "));

        let tokenCounts = [];
        namesArr.forEach(
            name =>
                tokenCounts.push({
                    name: name,
                    count: canvas.scene.tokens.filter(t => t.name.toLowerCase() === name.toLowerCase()).length
                }));
        Logger.debug(`PartyCruncher.#countTokensByNames - results of token count: `, tokenCounts);

        const returnArr = [];
        tokenCounts.forEach(
            entry =>
                returnArr[entry.name] = entry.count);

        Logger.debug(`PartyCruncher.#countTokensByNames - results returned: `, returnArr);
        return returnArr;
    }

    static #createPartyDefinition(partyNo = 1, properties) {

        Logger.debug("(PartyCruncher.#createPartyDefinition) properties (before validation): ", properties);
        let errMsg = "";

        // Check 1: Do we have enough tokens? Do we have not too many tokens?
        if (
            !properties.memberTokenNames || properties.memberTokenNames.length === 0 || properties.memberTokenNames[0] === "" ||
            properties.memberTokenNames.length > Config.globals.maxMembersPerParty ||
            !properties.partyTokenName || properties.partyTokenName === "") {
            errMsg =
                // Error: invalidTokenCount => Names do not represent exactly ONE group and MORE THAN ONE members.
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<strong>" + Config.localize(`errMsg.invalidTokenCount`) + "</strong>";
        }

        if (errMsg) {
            throw new Error(errMsg);
        }

        // Remove duplicates from selection
        properties.memberTokenNames = [...new Set(properties.memberTokenNames)];
        Logger.debug("(PartyCruncher.#createPartyDefinition) memberTokenNames after removing duplicates: ", properties.memberTokenNames);

        // In "Placeholder" mode (as of v14), we need to expel the party token's name from the members list
        if (properties.partyTokenMode === Config.globals.partyTokenModes.PLACEHOLDER) {
            const removeIndex = properties.memberTokenNames.indexOf(properties.partyTokenName)
            if (removeIndex > -1) {
                properties.memberTokenNames.splice(removeIndex, 1)
            }
            Logger.debug("(PartyCruncher.#createPartyDefinition) memberTokenNames after removing party token: ", properties.memberTokenNames);
        }

        // Check 3: Is max number of members per party exceeded?
        // For anyone interested: The max number is a hard limit (thus hard-coded)!
        // It is due to the problem of having to calculate "outward spiraling" spawn positions
        // around the party token on EXPLODE.
        // See #getMovementPathToExplodePosition() for details, if you're really into such brain-busting math stuff - as I am NOT :-D
        if (properties.memberTokenNames.length > Config.globals.maxMembersPerParty) {
            throw new Error(
                // Error: groupAndMembersIntersect => Names must not exist both as member and as group.
                Config.localize('errMsg.tooManyMemberTokens') + ` (${properties.memberTokenNames.length})!<br/>` +
                Config.localize('errMsg.invalidNumberOfMemberTokens').replace("{maxMembers}", Config.globals.maxMembersPerParty) + `<br/>` +
                "<br/>" +
                Config.localize(`setting.memberTokenNames#.name`).replace("#", partyNo) + ": <strong>[ " + properties.memberTokenNames + " ]</strong>"
            );
        }

        // Check 4: Does any of the member tokens exist more than once in the scene?
        // This is only for checking at this time. It will throw an error if some tokens are NOT unique, so we just can ignore the returned values for now
        PartyCruncher.#collectTokensByNamesIfUnique(properties.memberTokenNames);
        PartyCruncher.#collectTokensByNamesIfUnique([properties.partyTokenName])[0];

        const partyDefinition = {
            partyNo: partyNo,
            partyTokenName: properties.partyTokenName,
            partyTokenMode: properties.partyTokenMode,
            memberTokenNames: properties.memberTokenNames
        };
        Logger.debug("(PartyCruncher.#createPartyDefinition) new partyDefinition: ", partyDefinition);
        return partyDefinition;
    }

    static async updatePartyConfig(partyNo, updates) {

        // Validate passed params
        if (partyNo === undefined || isNaN(partyNo) || partyNo < 1 || partyNo > Config.setting("maxNoOfParties")) {
            Logger.error(`PartyCruncher.#updatePartyConfig - unable to store Party Config updates: partyNo missing or invalid (must be a number between 1 and ${Config.setting("maxNoOfParties")}): `, partyNo, updates);
            return;
        }

        Logger.debug(`PartyCruncher.#updatePartyConfig - updates: `, updates);

        const allConfigs = PartyCruncher.#getAllPartyConfigs();

        if (PartyCruncher.#isEmptyConfig(allConfigs[partyNo])) {
            Logger.debug(`PartyCruncher.#updatePartyConfig - creating new entry: `, updates);
            allConfigs[partyNo] = { definition: null };
        }
        Logger.debug(`PartyCruncher.#updatePartyConfig - preparing to store Party Config #${partyNo}: `, allConfigs[partyNo]);

        if (updates.definition) {
            allConfigs[partyNo].definition = updates.definition;
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(`PartyCruncher.#updatePartyConfig - new definition: `, allConfigs[partyNo].definition);
        }

        if (updates.partyToken) {
            allConfigs[partyNo].partyToken = updates.partyToken.document.toObject();
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(`PartyCruncher.#updatePartyConfig - new partyToken: `, allConfigs[partyNo].partyToken);
        }

        if (updates.memberTokens) {
            allConfigs[partyNo].memberTokens = updates.memberTokens.map(mt => mt.document.toObject());
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(`PartyCruncher.#updatePartyConfig - new memberTokens: `, allConfigs[partyNo].memberTokens);
        }

        if (updates.lastKnownState) {
            allConfigs[partyNo].lastKnownState = updates.lastKnownState;
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(`PartyCruncher.#updatePartyConfig - new lastKnownState: `, allConfigs[partyNo].lastKnownState);
        }

        Config.modifySetting("partyConfigs", allConfigs);

        Logger.debug(`PartyCruncher.#updatePartyConfig - updated Config for Party #${partyNo}: `, allConfigs[partyNo]);
        Logger.debug(`PartyCruncher.#updatePartyConfig - new full config (all Parties): `, allConfigs);
    }


    static #isEmptyConfig(partyConfig) {
        return partyConfig === undefined || partyConfig === null || partyConfig === {};
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

        // Check 1: Does any of the member tokens exist more than once in the scene?
        const memberTokens = PartyCruncher.#collectTokensByNamesIfUnique(names.memberTokenNames);
        const partyToken = PartyCruncher.#collectTokensByNamesIfUnique([names.partyTokenName])[0];

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
    static #collectTokensByNamesIfUnique(names) {

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
                    errMsg += `${Config.localize(`errMsg.notUniqueInScene`).replace("{tokenName}", token.name)}<br/>`;
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

    static #detectRequestedState(partyConfig) {

        const partyNo = partyConfig.definition.partyNo;

        let membersVisibleInScene = canvas.scene.tokens.filter(
            t =>
                partyConfig.definition.memberTokenNames.map(
                    n =>
                        n !== partyConfig.definition.partyTokenName
                        && n.toLowerCase()).indexOf(t.name.toLowerCase()) > -1
                && !t.hidden);
        Logger.debug(`PartyCruncher.#detectRequestedState - membersVisibleInScene: `, membersVisibleInScene);

        let partyTokensVisibleInScene = canvas.scene.tokens.filter(
            t =>
                partyConfig.definition.partyTokenName.toLowerCase() === t.name.toLowerCase()
                && !t.hidden);
        Logger.debug(`PartyCruncher.#detectRequestedState - partyTokensVisibleInScene: `, partyTokensVisibleInScene);

        let errMsg = "";

        // Check: Either the party token or any of the member tokens need to be present and visible
        if (membersVisibleInScene.length === 0 && partyTokensVisibleInScene.length === 0) {
            errMsg = Config.localize('errMsg.noTokensVisible');
        }
        // Check: Party and member tokens must not be present at the same time
        else if (partyConfig.definition.partyTokenMode === Config.globals.partyTokenModes.PLACEHOLDER
            && membersVisibleInScene.length > 0 && partyTokensVisibleInScene.length > 0) {
            errMsg = Config.localize('errMsg.membersAndPartyTokenVisible');
        }

        if (errMsg) {
            errMsg =
                Config.localize('errMsg.cannotDetermineAction') + "<br/>" +
                "<br/>" +
                errMsg + ":<br/>" +
                "<br/>" +
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "<strong>" + Config.localize("party") + "#" + partyNo + ":</strong><br/>" +
                "- " + partyConfig.definition.partyTokenName + " (" + Config.localize("labels.partyTokenName") + ")<br/>- " +
                "- " + partyConfig.definition.memberTokenNames.join("<br/>");
            throw new Error(errMsg);
        }

        const requestedState = (membersVisibleInScene.length > 0) ? Config.globals.states.CRUNCHED : Config.globals.states.EXPLODED;
        Logger.debug(`PartyCruncher.#detectRequestedState - requestedState: ${requestedState}`);
        return requestedState;
    }

    static async #crunchParty(partyConfig, useHotPanIfAvailable = true) {

        if (!PartyCruncher.isValidDefinition(partyConfig)) {
            return;
        }
        // Apart from a valid definition, the config also needs a stored partyToken
        if (!PartyCruncher.#hasPartyToken(partyConfig)) {
            return;
        }
        const partyNo = partyConfig.definition.partyNo;
        Logger.debug(`PartyCruncher.#crunchParty() - party#${partyNo} - partyConfig is valid: `, partyConfig);

        // Check if we need to abort because of duplicate member tokens in the scene
        const memberTokenDuplicates = PartyCruncher.#countTokensByNames(partyConfig.definition.memberTokenNames, 2);
        if (memberTokenDuplicates.length > 0) {
            Logger.debug(`PartyCruncher.#crunchParty - the following members have duplicates in scene: ${memberTokenDuplicates.map(c => c.name + ": " + c.count + "x").join(", ")}`);
            Logger.error(false, `${Config.localize('errMsg.notUniqueInScenePlural')}:<br/><br/>
                ${memberTokenDuplicates.map(c => c.name + ": " + c.count + "x").join("<br/>")}`);
            return;
        }

        const tokenUpdates = [];
        const partyConfigUpdates = {};

        // Collect member tokens in scene
        const memberTokensToRemove = [];
        for (let memberName of partyConfig.definition.memberTokenNames) {
            const tokenFound = canvas.tokens.ownedTokens.find(t => t.name === memberName);
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

        // Identify target token
        let targetToken;
        if (Config.globals.partyTokenModes.MEMBER === partyConfig.definition.partyTokenMode) {
            targetToken = canvas.tokens.ownedTokens.find(t => t.name === partyConfig.definition?.partyTokenName) ?? undefined;
            Logger.debug(`PartyCruncher.#crunchParty - trying to use party member as targetToken: [${partyConfig.definition?.partyTokenName}]`, targetToken);
        }
        if (targetToken === undefined) {
            const memberTokensSelected = memberTokensToRemove
                .filter(t =>
                    canvas.tokens.controlled.map(tc => tc.name)
                        .find(tn => tn === t.name));
            if (memberTokensSelected.length === 0) {
                memberTokensToRemove.forEach(t => t.control({releaseOthers: false}));
            }
            targetToken = canvas.tokens.controlled[0];
            Logger.debug(`PartyCruncher.#crunchParty - using last selected token as targetToken: [${targetToken.name}]`, targetToken);
        }
        Logger.debug(`PartyCruncher.#crunchParty - targetToken (final): [${targetToken.name}]`, targetToken);

        // Select the target and try to shift the view to it
        await PartyCruncher.#panToTarget(targetToken, useHotPanIfAvailable);

        // Move all members towards target token (including aligning elevation!)
        for (const token of memberTokensToRemove.reverse()) { // reverse() may make this visually a bit nicer
            tokenUpdates.push(
                PartyCruncher.#createTokenTeleportUpdate(
                    token,
                    {
                        name: token.document.name,
                        x: targetToken.document.x,
                        y: targetToken.document.y,
                        elevation: targetToken.document.elevation,
                        hidden: true
                    }));
        }

        // Check if party token already exists in Scene
        let effectivePartyToken;
        const tokenCount = PartyCruncher.#countTokensByNames([partyConfig.definition.partyTokenName]);
        const partyTokenCount = tokenCount[partyConfig.definition.partyTokenName];

        // Replace already existing party token(s) if necessary
        if (partyTokenCount > 1) {
            if (PartyCruncher.#hasPartyToken(partyConfig)) {

                const partyTokenConflictResolution = await PartyCruncher.#promptForDuplicateReplaceOrKeep(tokenCount, false);
                Logger.debug(`PartyCruncher.#crunchParty - tokenConflictResolution: `, partyTokenConflictResolution);

                // Apply the chosen conflict resolution
                if (partyTokenConflictResolution.replace) {
                    for (const t of canvas.tokens.ownedTokens.filter(t => t.name === partyConfig.definition.partyTokenName)) {
                        Logger.debug(`PartyCruncher.#crunchParty - deleting redundant party token: `, t);
                        await t.delete();
                    }
                } else if (partyTokenConflictResolution.keep) {
                    effectivePartyToken = canvas.tokens.ownedTokens.find(t => t.name === partyConfig.definition.partyTokenName);
                    partyConfigUpdates.partyToken = effectivePartyToken;
                    Logger.debug(`PartyCruncher.#crunchParty - effectivePartyToken reused from scene: `, effectivePartyToken);
                } else { // partyTokenConflictResolution.cancelled
                    return false;
                }
            }
        }

        // If no partyToken has been assigned until here, the default applies:
        // If one exists in the scene, reuse it. Otherwise instantiate a new one from partyConfig
        if (effectivePartyToken === undefined) {
            if (partyTokenCount === 1) {
                effectivePartyToken = canvas.tokens.ownedTokens.find(t => t.name === partyConfig.definition.partyTokenName);
            }
            else {
                // If a partyToken is stored in config, instantiate it (hidden) at the target position
                if (partyConfig.partyToken !== undefined) {
                    partyConfig.partyToken.x = targetToken.x;
                    partyConfig.partyToken.y = targetToken.y;
                    partyConfig.partyToken.elevation = targetToken.elevation;
                    partyConfig.partyToken.hidden = true;
                    await canvas.scene.createEmbeddedDocuments("Token", [partyConfig.partyToken]);
                    effectivePartyToken = canvas.tokens.ownedTokens.find(t => t.name === partyConfig.definition.partyTokenName);
                    Logger.debug(`PartyCruncher.#crunchParty - effectivePartyToken created from partyConfig: `, effectivePartyToken);
                    Logger.debug(`PartyCruncher.#crunchParty - effectivePartyToken pos [x:${effectivePartyToken.document.x}|y:${effectivePartyToken.document.y}|e:${effectivePartyToken.document.elevation}] set to targetToken pos [x:${targetToken.document.x}|y:${targetToken.document.y}|e:${targetToken.document.elevation}]`);

                } else {
                    // Otherwise throw an error
                    Logger.error(false, Config.localize("partyTokenMissingInConfig").replace("#tokenName", partyConfig.partyTokenName));
                    return;
                }
            }
        }

        // Reveal the party token
        tokenUpdates.push(
            PartyCruncher.#createTokenTeleportUpdate(
                effectivePartyToken,
                {
                    name: effectivePartyToken.document.name,
                    hidden: false
                }));

        // Play audio and JB2A animation (if supported)
        await PartyCruncher.#playAnimation(Config.globals.states.CRUNCHED, targetToken);

        // Apply all the updates
        for (const update of tokenUpdates) {
            const tokenDoc = canvas.scene.tokens.get(update._id);
            if (!tokenDoc) return;
            Logger.debug(`PartyCruncher.#crunchParty - token update: `, update);
            Logger.debug(`PartyCruncher.#crunchParty - updating token [${update.name}] to [x:${update.x}|y:${update.y}|e:${update.elevation}|hidden:${update.hidden}]`);
            await tokenDoc.update(
                {
                    x: update.x,
                    y: update.y,
                    elevation: update.elevation,
                    hidden: update.hidden
                });
        }

        // Store member tokens and remove them from the scene
        if (memberTokensToRemove.length > 0) {
            partyConfigUpdates.memberTokens = memberTokensToRemove;
            Logger.debug(`PartyCruncher.#crunchParty - removing ${memberTokensToRemove.length} tokens from scene: `, memberTokensToRemove);
            for (const member of memberTokensToRemove) {
                await member.document.delete();
            }
        } else {
            Logger.warn(`PartyCruncher.#crunchParty - No member tokens found in Scene for Party #${partyNo} [${partyConfig.definition.partyTokenName}]`);
        }

        partyConfigUpdates.lastKnownState = Config.globals.states.CRUNCHED;
        await PartyCruncher.updatePartyConfig(partyNo, partyConfigUpdates);

        // Finally, make party token the active one
        await effectivePartyToken.control({releaseOthers: true});
    }

    /**
     *
     * @param involvedTokens
     * @param targetToken - Here this is always the party token itself, providing the anchor point for the member tokens
     */
    static async #explodeParty(involvedTokens, targetToken) {
        // TODO - replace involvedTokens by partyConfig
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
            tokenUpdates.push(PartyCruncher.#createTokenTeleportUpdate(memberToken, involvedTokens.partyToken.position, involvedTokens.partyToken.document.elevation, false));
        }

        // Move the party token out of the way and render it invisible ("WE are the party now!")
        tokenUpdates.push(PartyCruncher.#createTokenTeleportUpdate(involvedTokens.partyToken, {x: 0, y: 0}, null, true));

        // Finish step #1: Teleport!
        // TODO - FIX (or remove whole surrounding function if not needed anymore)
        //await PartyCruncher.#teleport(tokenUpdates);

        // // Explode step #2: Swarm out and take your places
        let tokenCounter = 0;
        for (const memberToken of involvedTokens.memberTokens) {
            //Set selection to current token.
            //Otherwise, movement by moveMany below won't have any effect
            memberToken.control({releaseOthers: true});

            // Position each token along an "outward spiral" around the origin (which is the party token)
            let movementPath = PartyCruncher.#getMovementPathToExplodePosition(tokenCounter++);
            Logger.debug(`(PartyCruncher.#explodeParty) [${memberToken.name}]: movementPath =>`, movementPath);

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
                const stepCenter = {x: stepX + memberToken.w / 2, y: stepY + memberToken.h / 2};

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
                [{x: finalX, y: finalY}],
                {
                    method: "api",
                    showRuler: true,
                    constrainOptions: {ignoreWalls: false},
                    animation: {duration: 400}
                }
            );

        }

        // Now we need to loop over all members once more to select them all
        // If we had done this within the first loop, together with the moving, the tokens movements
        // would interfere with each others cumulatively.
        for (const memberToken of involvedTokens.memberTokens) {
            memberToken.control({releaseOthers: false});
        }
    }

    static #createTokenTeleportUpdate(tokenToMove, updates) {
        const x = (updates.x !== undefined) ? updates.x : tokenToMove.document.x; // NULL target means: don't move, stay where you are!
        const y = (updates.y !== undefined) ? updates.y : tokenToMove.document.y; // NULL target means: don't move, stay where you are!
        const elevation = (updates.elevation !== null) ? updates.elevation : tokenToMove.elevation; // NULL target means: don't move, stay where you are!
        const update = {
            name: updates.name,
            _id: tokenToMove.document._id,
            x: x,
            y: y,
            elevation: elevation,
            hidden: updates.hidden
        };
        Logger.debug(`PartyCruncher.#createTokenTeleportUpdate() - update: `, update);
        return update;
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
            {x: 0, y: -1}, {x: 1, y: 0}, {x: 0, y: 1}, {x: -1, y: 0}, {x: 1, y: -1}, {x: 1, y: 1}, {
                x: -1,
                y: 1
            }, {x: -1, y: -1},
            // and the outer "ring" with additional 16 positions
            {x: -1, y: -2}, {x: 0, y: -2}, {x: 1, y: -2}, {x: 2, y: -2}, {x: 2, y: -1}, {x: 2, y: 0}, {
                x: 2,
                y: 1
            }, {x: 2, y: 2},
            {x: 1, y: 2}, {x: 0, y: 2}, {x: -1, y: 2}, {x: -2, y: 2}, {x: -2, y: 1}, {x: -2, y: 0}, {
                x: -2,
                y: -1
            }, {x: -2, y: -2}
        ];
        return movementVector[counter];
    }

    static async #promptForPartyDefinition(partyNo = 1) {

        const title = Config.localize('promptForPartyDefinition.title');

        let content = `
        <div style="max-height: 600px; max-width: 600px; overflow: auto">
        <p>${Config.localize('promptForPartyDefinition.text')}</p>`;
        for (const t of canvas.tokens.controlled) {
            const checked = (t === canvas.tokens.controlled[0]) ? " checked" : "";
            content += `<label><input type="radio" name="tokenChoice" value="${t.name}"${checked}/>${t.name}</label><br/>`;
        }
        content += `
            <hr>
            <p>${Config.localize('promptForPartyDefinition.partyTokenMode.text')}</p>
            <label><input type="radio" name="modeChoice" value="${Config.globals.partyTokenModes.PLACEHOLDER}" checked/>${Config.localize('promptForPartyDefinition.partyTokenMode.placeholder')}</label><br/>
            <label><input type="radio" name="modeChoice" value="${Config.globals.partyTokenModes.MEMBER}"/>${Config.localize('promptForPartyDefinition.partyTokenMode.member')}</label><br/>`;
        content += `
            <hr>
            <p>${Config.localize('promptForPartyDefinition.partyNo.text')}</p>`;

        // Make partyNo selectable: Populate an option list from all stored configs, limited by MAX_NO_OF_PARTIES
        const allConfigs = PartyCruncher.#getAllPartyConfigs();
        for (let i = 1; i <= Config.setting("maxNoOfParties"); i++) {
            let partyName, members;
            if (allConfigs[i]?.definition) {
                partyName = allConfigs[i].definition.partyTokenName;
                members = " (" + allConfigs[i].definition.memberTokenNames.join(", ") + ")";
            } else {
                partyName = Config.localize('empty').toUpperCase();
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
                window: {title: title},
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
            }).render({force: true});
        });
    }

    static async #promptForImmediateCrunch(partyNo) {

        const content = `
            <form>
                <div>
                    <legend>${Config.localize('promptForCrunchAfterGrouping.text')}</legend>
                </div>
            </form>`;

        return new Promise(resolve => {
            new foundry.applications.api.DialogV2({
                window: {title: Config.localize('promptForCrunchAfterGrouping.title')},
                content: content,
                buttons: [
                    {
                        action: "yes",
                        label: Config.localize('promptForCrunchAfterGrouping.yes'),
                        default: true,
                        callback: () => resolve(PartyCruncher.toggleParty(partyNo))
                    },
                    {
                        action: "no",
                        label: Config.localize('promptForCrunchAfterGrouping.no'),
                        callback: () => resolve({cancelled: true})
                    }]
            }).render({force: true});
        });
    }

    static async #promptForDuplicateReplaceOrKeep(duplicateData, allowApplyToAll = false) {

        let content = `
            <form>
                <div style="max-height: 600px; max-width: 600px; overflow: auto">
                    <legend>${Config.localize('promptForDuplicateReplaceOrKeep.text')
            .replace("{tokenName}", duplicateData.name)
            .replace("{count}", duplicateData.count)}</legend><br/>`;
        if (duplicateData.count > 1) {
            content += `
                    <label>${Config.localize('promptForDuplicateReplaceOrKeep.disallowKeepText')
                .replace("{count}", duplicateData.count)}</label><br/>`;
        }
        if (allowApplyToAll) {
            content += `
                    <label>
                        <input type="checkbox" name="applyToAll" checked 
                               alt="${Config.localize('#applyToAll')}"/>
                               ${Config.localize('#applyToAll')}</label><br/>`;
        }
        content += `
                </div>
            </form>`;

        return new Promise(resolve => {
            new foundry.applications.api.DialogV2({
                window: {title: Config.localize('promptForDuplicateReplaceOrKeep.title')},
                content: content,
                buttons: [
                    {
                        action: "replace",
                        label: Config.localize('promptForDuplicateReplaceOrKeep.replace'),
                        default: true,
                        callback: (event, button) => resolve({
                            replace: true,
                            applyToAll: (allowApplyToAll && button.form.elements.applyToAll.checked)
                        })
                    },
                    {
                        action: "keep",
                        label: Config.localize('promptForDuplicateReplaceOrKeep.keep'),
                        default: true,
                        disabled: (duplicateData.count > 1),
                        callback: (event, button) => resolve({
                            keep: true,
                            applyToAll: (allowApplyToAll && button.form.elements.applyToAll.checked)
                        })
                    }, {
                        action: "cancel",
                        label: Config.localize('cancelButton'),
                        callback: () => resolve({cancelled: true})
                    }]
            }).render({force: true});
        });
    }

    static async #promptForDuplicateDelete(duplicateData, allowApplyToAll = false) {

        let content = `
            <form>
                <div style="max-height: 600px; max-width: 600px; overflow: auto">
                    <legend>${Config.localize('promptForDuplicateDelete.text')
            .replace("{tokenName}", duplicateData.name)
            .replace("{count}", duplicateData.count)}</legend><br/>`;
        if (allowApplyToAll) {
            content += `
                    <label>
                        <input type="checkbox" name="applyToAll" checked 
                               alt="${Config.localize('applyToAll')}"/>
                               ${Config.localize('applyToAll')}</label><br/>`;
        }
        content += `
                </div>
            </form>`;

        return new Promise(resolve => {
            new foundry.applications.api.DialogV2({
                window: {title: Config.localize('promptForDuplicateDelete.title')},
                content: content,
                buttons: [
                    {
                        action: "delete",
                        label: Config.localize('promptForDuplicateDelete.delete'),
                        default: true,
                        callback: (event, button) => resolve({
                            delete: true,
                            applyToAll: (allowApplyToAll && button.form.elements.applyToAll.checked)
                        })
                    }, {
                        action: "cancel",
                        label: Config.localize('cancelButton'),
                        callback: () => resolve({cancelled: true})
                    }]
            }).render({force: true});
        });
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

    static async #promptForSimpleConfirmation(message) {

        let content = `
            <form>
                <div style="max-height: 600px; max-width: 600px; overflow: auto">
                    <legend>${message}</legend><br/>
                </div>
            </form>`;

        return new Promise(resolve => {
            new foundry.applications.api.DialogV2({
                window: {title: Config.localize('promptForSimpleConfirmation')},
                content: content,
                buttons: [
                    {
                        action: "ok",
                        label: Config.localize('okButton'),
                        default: false,
                        callback: () => resolve({ok: true})
                    },
                    {
                        action: "cancel",
                        label: Config.localize('cancelButton'),
                        default: true,
                        callback: () => resolve({cancelled: true})
                    }]
            }).render({force: true});
        });
    }

    static async showPartyConfigurations() {

        const tableTemplate = `${Config.globals.templatePath}/config-list-table.html`;
        const tableRowTemplate = `${Config.globals.templatePath}/config-list-table-row.html`;
        const imgTemplate = `${Config.globals.templatePath}/config-list-token-img.html`;

        const allConfigs = PartyCruncher.#getAllPartyConfigs();
        let contentHTML = "";
        let rowsHTML = ""

        let buttons = [];

        for (let i = 1; i <= Config.setting("maxNoOfParties"); i++) {

            const config = allConfigs[i];
            // Logger.debug(`PartyCruncher.showPartyConfigurations() - config`, config);

            // Defaults (for any unused party slots)
            let partyNo = i;
            let partyName = Config.localize('empty').toUpperCase();
            let partyImg = "";
            let membersNames = "";
            let membersImgs = "";

            // Party information
            if (config) {
                partyName = config.definition.partyTokenName;
                const partyTokenImgPath = config.partyToken?.texture?.src;
                partyImg = (partyTokenImgPath !== undefined)
                    ? await PartyCruncher.#renderHTML(imgTemplate,
                        {
                            imgPath: partyTokenImgPath,
                            alt: partyName,
                            title: partyName,
                            size: 60
                        })
                    : "";
                // Logger.debug(`PartyCruncher.showPartyConfigurations() - rendered partyImg`, partyImg);

                // Member information
                let membersNamesArr = [];
                let membersImgsArr = [];
                for (let name of config.definition.memberTokenNames) {
                    let memberNameFormatted = (name === partyName) ? "<strong>" + name + "</strong>" : name;
                    let size = (name === partyName) ? 50 : 40;
                    const memberImgPath = config.memberTokens?.find(t => t.name === name)?.texture?.src;

                    let memberImg = (memberImgPath !== undefined)
                        ? await PartyCruncher.#renderHTML(imgTemplate,
                            {
                                imgPath: memberImgPath,
                                alt: name,
                                title: name,
                                size: size
                            })
                        : "";
                    // Logger.debug(`PartyCruncher.showPartyConfigurations() - rendered memberImg`, memberImg);

                    membersNamesArr.push(memberNameFormatted);
                    membersImgsArr.push(memberImg);
                }
                membersNames = membersNamesArr.join(", ");
                membersImgs = membersImgsArr.join("");

                // Add FIND and DELETE button for this party
                buttons.push(
                    {
                        action: `find${partyNo}`,
                        label: Config.localize('showPartyConfigurations.findButton').replace('{partyNo}', partyNo),
                        callback: () => PartyCruncher.findParty(partyNo)
                    },
                    {
                        action: `delete${partyNo}`,
                        label: Config.localize('showPartyConfigurations.deleteButton').replace('{partyNo}', partyNo),
                        callback: () => PartyCruncher.deleteParty({
                            partyNo: partyNo,
                            partyName: partyName,
                            noOfMembers: membersNamesArr.length
                        })
                    });
            }

            rowsHTML += await PartyCruncher.#renderHTML(tableRowTemplate,
                {
                    partyNo: partyNo,
                    partyImg: partyImg,
                    partyName: partyName,
                    membersImgs: membersImgs,
                    membersNames: membersNames
                });
            // Logger.debug(`PartyCruncher.showPartyConfigurations() - rendered rowsHTML`, rowsHTML);
        }

        // Finally, render the full table
        const tableData = {
            partyHeaderText: Config.localize('labels.partyTokenName'),
            membersHeaderText: Config.localize('labels.memberTokenNames'),
            rowsHTML: rowsHTML
        };

        contentHTML += await PartyCruncher.#renderHTML(tableTemplate, tableData);
        // Logger.debug(`PartyCruncher.showPartyConfigurations() - rendered contentHTML`, contentHTML);

        buttons.push(
            {
                action: "ok",
                label: Config.localize('closeButton'),
                default: true
            }
        );

        Logger.debug(`PartyCruncher.showPartyConfigurations() - buttonsData`, buttons);

        return new Promise(resolve => {
            new foundry.applications.api.DialogV2({
                window: {title: Config.localize('settingsMenu.partyConfigSection')},
                content: contentHTML,
                buttons: buttons
            }).render({force: true});
        });
    }

    static #renderHTML(templateFile, templateData) {
        return foundry.applications.handlebars.renderTemplate(templateFile, templateData);
    }

    static #getAllPartyConfigs() {
        const partyConfigs = foundry.utils.deepClone(
            Config.setting("partyConfigs")
        );
        Logger.debug('(PartyCruncher.#getAllStoredPartyConfigs) reading all partyConfigs: ', partyConfigs);
        return (partyConfigs !== undefined && partyConfigs !== null) ? partyConfigs : {};
    }

    static #getPartyConfig(partyNo) {
        try {
            return foundry.utils.deepClone(Config.setting("partyConfigs")[partyNo]);
        } catch (e) {
            Logger.error(true, 'PartyCruncher.#getPartyConfig', e);
            ui.notifications.error(`[${Config?.globals?.modTitle ?? ""}] Can't read Party Configuration for Party #${partyNo}. Please check the logs`);
        }
    }

    static isValidDefinition(partyConfig) {
        if (partyConfig.definition === undefined) {
            Logger.error(false, 'PartyCruncher.isValidDefinition(partyConfig) - definition is empty.');
            return false;
        }
        if (partyConfig.definition.partyNo === undefined || isNaN(partyConfig.definition.partyNo) || partyConfig.definition.partyNo < 1 || partyConfig.definition.partyNo > Config.setting("maxNoOfParties")) {
            Logger.error(false, `PartyCruncher.#isValid(partyConfig) - definition does not contain a  valid partyNo (must be a number between 1 and ${Config.setting("maxNoOfParties")}): `, partyNo);
            return false;
        }
        if (partyConfig.definition.partyTokenName === undefined) {
            Logger.error(false, 'PartyCruncher.isValidDefinition(partyConfig) - definition.partyTokenName is missing or empty: ', definition.partyTokenName);
            return false;
        }
        const allowedModes = Object.values(Config.globals.partyTokenModes);
        if (partyConfig.definition.partyTokenMode === undefined || !allowedModes.find(m => m === partyConfig.definition.partyTokenMode)) {
            Logger.error(false, `PartyCruncher.#isValid(partyConfig) - definition.partyTokenMode is invalid (must be one of: ${allowedModes.join((", "))}) `, definition.partyTokenName);
            return false;
        }
        if (partyConfig.definition.memberTokenNames === undefined || partyConfig.definition.memberTokenNames.length === 0) {
            Logger.error(false, 'PartyCruncher.isValidDefinition(partyConfig) - definition.memberTokenNames is missing or an empty list: ', definition.memberTokenNames);
            return false;
        }

        // If you've come this far, consider yourself valid ;-)
        return true;
    }

    static #hasPartyToken(partyConfig) {
        if (partyConfig.partyToken === undefined
            || typeof partyConfig.partyToken !== "object") {
            Logger.error(false, 'PartyCruncher.#hasPartyToken(partyConfig) - no partyToken in partyConfig: ', partyConfig);
            return false;
        }
        return true;
    }

    static async #playAnimation(requestedState, targetToken) {

        const animationPath = Config.setting(`animationFile${requestedState}`).trim();
        let audioPath = Config.setting(`playAudio${requestedState}`) ? Config.setting(`audioFile${requestedState}`).trim() : Config.NO_AUDIO_FILE;
        if (!audioPath) audioPath = Config.NO_AUDIO_FILE;
        Logger.debug(`PartyCruncher.#playAnimation - animationPath: ${animationPath}`);
        Logger.debug(`PartyCruncher.#playAnimation - audioPath: ${audioPath}`);
        Logger.debug(`PartyCruncher.#playAnimation - Audio base dir (window.location.pathname): ${window.location.pathname}`);

        // If JB2A_DnD5e && AA are installed, play the animation
        if (animationPath && (
            optionalDependenciesAvailable.includes('JB2A_DnD5e')
            || optionalDependenciesAvailable.includes('jb2a_patreon'))
            && optionalDependenciesAvailable.includes('autoanimations')) {
            Logger.debug(`PartyCruncher.#playAnimation - animationPath: ${animationPath}`);

            new Sequence()
                .effect()
                .file(animationPath)
                .atLocation(targetToken)
                .scaleToObject(4)
                .randomRotation()
                .sound().file(audioPath)
                .play();

        }
        // Play audio without JB2A && AA
        else if (audioPath)
        {
            foundry.audio.AudioHelper.play({
                src: audioPath,
                volume: 1,
                autoplay: true,
                loop: false
            }, true);
        }
    }
}
