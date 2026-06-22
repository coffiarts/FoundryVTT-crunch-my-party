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
        Logger.debug(initSubmodules.name, "Submodule loaded:", cl.name);
    });
}

async function initExposedClasses() {
    window.PartyCruncher = PartyCruncher;
    Logger.debug(initExposedClasses.name, "Exposed classes are ready");
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
    Logger.debug(scanForOptionalDependencies.name, "optionalDependenciesAvailable:", optionalDependenciesAvailable);
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
        Logger.debug(this.setBusy.name, (isBusy) ? "BUSY!" : "NOT BUSY");
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
    static async toggleParty(partyNo = undefined, useHotPanIfAvailable = true) {

        if (this.isBusy()) {
            Logger.warn(this.toggleParty.name, false, Config.localize("errMsg.pleaseWaitStillBusy"));
            return;
        }

        if (partyNo === undefined) {
            const prompt = await this.#promptForPartySelection();
            if (prompt.cancelled) {
                return;
            }
            partyNo = prompt.partyNo;
        }

        Logger.debug(this.toggleParty.name, `TOGGLE - partyNo: #${partyNo}, useHotPanIfAvailable: ${useHotPanIfAvailable} ...`);

        try {

            await this.setBusy(true);

            // ==================================================================================================
            // Step 1 - Read partyConfig
            // ==================================================================================================
            const partyConfig = this.#getPartyConfig(partyNo);
            if (!this.isValidDefinition(partyConfig)) {
                return;
            }
            Logger.debug(this.toggleParty.name, `partyConfig(${partyNo}) is valid: `, partyConfig);

            // ==================================================================================================
            // Step 2 - auto-determine new requested state
            // ==================================================================================================
            // TODO - Replace by dynamic detection
            const requestedState = this.#detectRequestedState(partyConfig);

            // ==================================================================================================
            // Step 3 - And fiiiiiiiiinally.... DO IT!!
            // ==================================================================================================
            switch (requestedState) {
                case Config.globals.states.CRUNCHED:
                    Logger.info(`Crunching party ${partyNo} ...`, partyConfig);
                    await this.#crunchParty(partyConfig);
                    break;
                case Config.globals.states.EXPLODED:
                    Logger.info(`Exploding party ${partyNo} ...`, partyConfig);
                    await this.#explodeParty(partyConfig);
                    break;
            }

        } catch (e) {
            Logger.error(this.toggleParty.name, false, e); // This will also print an error msg to the screen
            return;
        } finally {
            await this.setBusy(false);
        }

        Logger.info(`... Toggling of party #${partyNo} complete.`);
        await this.setBusy(false);
    }

    static async #panToTarget(targetToken, useHotPanIfAvailable) {
        canvas.tokens.releaseAll();
        const caller = this.#panToTarget.name;
        if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
            Logger.debug(this.#panToTarget.name, `switching HotPan ON (useHotPan: ${useHotPanIfAvailable})`);
            HotPan.switchOn(true); // true means: silentMode (no UI message)
        }
        targetToken.control({releaseOthers: true});

        await canvas.animatePan(this.#getTokenCenter(targetToken));

        if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
            setTimeout(function () {
                Logger.debug(caller, `switching HotPan BACK (useHotPan: ${useHotPanIfAvailable})`);
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

        if (this.isBusy()) {
            Logger.warn(this.groupParty.name, false, Config.localize("errMsg.pleaseWaitStillBusy"));
            return;
        }

        Logger.debug(this.toggleParty.name, `GROUP - partyNo: ${partyNo} ...`);

        // Force activation of the Token Layer in the UI
        // The following steps require token selection, which won't work with any other layer active
        canvas.tokens.activate();

        try {

            await this.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate current token selection, with input from the GM
            // ==================================================================================================
            // grab all relevant information from all currently selected tokens
            let propertiesFromSelection = this.#collectNamesFromTokenSelection();

            // ask the GM for the name and mode of the party token to use
            let partyDefinitionInput = await this.#promptForPartyDefinition(partyNo);
            if (partyDefinitionInput.cancelled) {
                return;
            } else {
                propertiesFromSelection.partyTokenName = partyDefinitionInput.tokenName;
                propertiesFromSelection.partyTokenMode = partyDefinitionInput.mode;
                partyNo = partyDefinitionInput.partyNo;
                Logger.debug(this.groupParty.name, `propertiesFromSelection for grouping party #${partyNo}:`, propertiesFromSelection);
            }
            const partyDefinition = this.#createPartyDefinition(partyNo, propertiesFromSelection);
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
            await this.#updatePartyConfig(partyNo, updates);

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
            this.#promptForImmediateCrunch(partyNo);

        } catch (e) {
            Logger.error(this.groupParty.name, false, e); // This will also print an error msg to the screen
            return;
        } finally {
            await this.setBusy(false);
        }

        Logger.info(`... Grouping of party #${partyNo} complete.`);
        await this.setBusy(false);
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

        if (this.isBusy()) {
            Logger.warn(this.findParty.name, false, Config.localize("errMsg.pleaseWaitStillBusy"));
            return;
        }

        Logger.debug(this.findParty.name, `partyNo: ${partyNo}, useHotPan: ${useHotPanIfAvailable} ...`);

        try {

            await this.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate party definitions from module settings
            // ==================================================================================================
            // grab raw input values from user prefs
            let validatedNames = this.#collectValidatedTokenNamesFromModuleSettings(partyNo);
            Logger.debug(this.findParty.name, "validatedNames: ", validatedNames);

            // ==================================================================================================
            // Step 2 - gather and validate all the involved tokens from current scene
            // ==================================================================================================
            let involvedTokens = this.#collectInvolvedTokens(validatedNames, partyNo);
            Logger.debug(this.findParty.name, "involvedTokens: ", involvedTokens);

            // ==================================================================================================
            // Step 3 - Finally... just FIND it!
            // ==================================================================================================
            if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
                Logger.debug(this.findParty.name, `switching HotPan ON (useHotPan: ${useHotPanIfAvailable})`);
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
                    Logger.debug(this.findParty.name, `switching HotPan BACK (useHotPan: ${useHotPanIfAvailable})`);
                    HotPan.switchBack(true); // true means: silentMode (no UI message)
                }, 1000);
            }
        } catch (e) {
            Logger.error(this.findParty.name, false, e); // This will also print an error msg to the screen
            return;
        } finally {
            await this.setBusy(false);
        }

        Logger.debug(this.findParty.name, `Finding of Party with partyNo #${partyNo} complete.`);
        await this.setBusy(false);
    }

    static #collectValidatedTokenNamesFromModuleSettings(partyNo) {
        let memberTokenNamesString = Config.setting(`memberTokenNames${partyNo}`);
        let partyTokenNameString = Config.setting(`partyTokenName${partyNo}`);
        let propertiesFromSettings = this.#collectNamesFromStrings(partyNo, memberTokenNamesString, partyTokenNameString);
        return this.#createPartyDefinition(partyNo, propertiesFromSettings);
    }

    static async deleteParty(partyInfo) {
        const message = Config.localize("confirmDeleteParty")
            .replace("#", partyInfo.partyNo)
            .replace("{partyName}", partyInfo.partyName)
            .replace("{noOfMembers}", partyInfo.noOfMembers);
        const prompt = await this.#promptForSimpleConfirmation(message);
        if (prompt.ok) {
            let allConfigs = this.#getAllPartyConfigs();
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

        Logger.debug(this.#collectNamesFromStrings.name,
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
        if (tokensSelected.length < 2 || tokensSelected.length > Config.globals.maxMembersPerParty + 1) {
            throw new Error(
                Config.localize('errMsg.invalidNumberOfMemberTokens').replace("{maxMembers}", Config.globals.maxMembersPerParty));
        }

        // Pre-Check 2: None of the selected tokens may exist more than once in the scene (by name, case-insensitive)
        const namesToCheck = Array.from(new Set(canvas.tokens.controlled.map(t => t.name)));

        const duplicates = this.#countTokensByNames(namesToCheck, 2);

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
        Logger.debug(this.#collectNamesFromTokenSelection.name, "propertiesFromSelection:", namesFromSelection);

        return namesFromSelection;
    }

    static #countTokensByNames(namesArr, minCount = 1) {

        Logger.debug(this.#countTokensByNames.name, namesArr.join(", "));

        let tokenCounts = [];
        namesArr.forEach(
            name =>
                tokenCounts.push({
                    name: name,
                    count: canvas.scene.tokens.filter(t => t.name.toLowerCase() === name.toLowerCase()).length
                }));
        Logger.debug(this.#countTokensByNames.name, `results of token count: `, tokenCounts);

        tokenCounts = tokenCounts.filter(tc => tc.count >= minCount);

        // TODO - can we get rid of this?
        /*const returnArr = [];
        tokenCounts.forEach(
            entry =>
                returnArr[entry.name] = entry.count);*/

        Logger.debug(this.#countTokensByNames.name, `tokenCounts returned: `, tokenCounts);
        return tokenCounts;
    }

    static #createPartyDefinition(partyNo = 1, properties) {

        Logger.debug(this.#createPartyDefinition.name, "properties (before validation): ", properties);
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
        Logger.debug(this.#createPartyDefinition.name, "memberTokenNames after removing duplicates: ", properties.memberTokenNames);

        // In "Placeholder" mode (as of v14), we need to expel the party token's name from the members list
        if (properties.partyTokenMode === Config.globals.partyTokenModes.PLACEHOLDER) {
            const removeIndex = properties.memberTokenNames.indexOf(properties.partyTokenName)
            if (removeIndex > -1) {
                properties.memberTokenNames.splice(removeIndex, 1)
            }
            Logger.debug(this.#createPartyDefinition.name, "memberTokenNames after removing party token: ", properties.memberTokenNames);
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
        this.#collectTokensByNamesIfUnique(properties.memberTokenNames);
        this.#collectTokensByNamesIfUnique([properties.partyTokenName])[0];

        const partyDefinition = {
            partyNo: partyNo,
            partyTokenName: properties.partyTokenName,
            partyTokenMode: properties.partyTokenMode,
            memberTokenNames: properties.memberTokenNames
        };
        Logger.debug(this.#createPartyDefinition.name, "new partyDefinition: ", partyDefinition);
        return partyDefinition;
    }

    static async #updatePartyConfig(partyNo, updates) {

        // Validate passed params
        if (partyNo === undefined || isNaN(partyNo) || partyNo < 1 || partyNo > Config.setting("maxNoOfParties")) {
            Logger.error(this.#updatePartyConfig.name, false, `Unable to store Party Config updates: partyNo missing or invalid (must be a number between 1 and ${Config.setting("maxNoOfParties")}): `, partyNo, updates);
            return;
        }

        Logger.debug(this.#updatePartyConfig.name, `updates: `, updates);

        const allConfigs = this.#getAllPartyConfigs();

        if (this.#isEmptyConfig(allConfigs[partyNo])) {
            Logger.debug(this.#updatePartyConfig.name, `creating new entry: `, updates);
            allConfigs[partyNo] = { definition: null };
        }
        Logger.debug(this.#updatePartyConfig.name, `preparing to store Party Config #${partyNo}: `, allConfigs[partyNo]);

        if (updates.definition) {
            allConfigs[partyNo].definition = updates.definition;
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(this.#updatePartyConfig.name, `new definition: `, allConfigs[partyNo].definition);
        }

        if (updates.partyToken) {
            allConfigs[partyNo].partyToken = updates.partyToken.document.toObject();
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(this.#updatePartyConfig.name, `new partyToken: `, allConfigs[partyNo].partyToken);
        }

        if (updates.memberTokens) {
            allConfigs[partyNo].memberTokens = updates.memberTokens.map(mt => mt.document.toObject());
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(this.#updatePartyConfig.name, `new memberTokens: `, allConfigs[partyNo].memberTokens);
        }

        if (updates.lastKnownState) {
            allConfigs[partyNo].lastKnownState = updates.lastKnownState;
            allConfigs[partyNo].timestamp = Date.now();
            Logger.debug(this.#updatePartyConfig.name, `new lastKnownState: `, allConfigs[partyNo].lastKnownState);
        }

        Config.modifySetting("partyConfigs", allConfigs);

        Logger.debug(this.#updatePartyConfig.name, `updated Config for Party #${partyNo}: `, allConfigs[partyNo]);
        Logger.debug(this.#updatePartyConfig.name, `new full config (all Parties): `, allConfigs);
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
        // TODO - function probably unused
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
    static #collectTokensByNamesIfUnique(names) {

        let tokensFound = [];
        let errMsg = "";

        for (let token of canvas.tokens.ownedTokens) {

            Logger.debug(this.#collectTokensByNamesIfUnique.name, `Checking if scene token '${token.name}' is in list: ...`, names);

            if (names.map(n => n.trim().toLowerCase()).includes(token.name.trim().toLowerCase())) {

                // Hurray, we've found a  token from the list!
                if (tokensFound.filter(t => t.name === token.name).length === 0) { // not yet registered
                    tokensFound.push(token);
                    Logger.debug(this.#collectTokensByNamesIfUnique.name, `Hurray! Found token from the list: [${token.name}]!`);
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

        Logger.debug(this.#detectRequestedState.name, `lastKnownState of party#${partyConfig.definition.partyNo}: ${partyConfig.lastKnownState}`);

        // TODO - decide whether simplified logic can be upheld ...
        const requestedState = (partyConfig.lastKnownState === Config.globals.states.EXPLODED) ? Config.globals.states.CRUNCHED : Config.globals.states.EXPLODED;
        Logger.debug(this.#detectRequestedState.name, `requestedState: ${requestedState}`);
        return requestedState;

        // TODO - ... otherwise replace the code above by this ...
        /*const partyNo = partyConfig.definition.partyNo;

        let membersVisibleInScene = canvas.scene.tokens.filter(
            t =>
                partyConfig.definition.memberTokenNames.map(
                    n =>
                        n !== partyConfig.definition.partyTokenName
                        && n.toLowerCase()).indexOf(t.name.toLowerCase()) > -1
                && !t.hidden);
        Logger.debug(this.#detectRequestedState.name, `membersVisibleInScene: `, membersVisibleInScene);

        let partyTokensVisibleInScene = canvas.scene.tokens.filter(
            t =>
                partyConfig.definition.partyTokenName.toLowerCase() === t.name.toLowerCase()
                && !t.hidden);
        Logger.debug(this.#detectRequestedState.name, `partyTokensVisibleInScene: `, partyTokensVisibleInScene);

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

        Logger.debug(this.#detectRequestedState.name, `requestedState: ${requestedState}`);
        return requestedState;*/
    }

    static async #crunchParty(partyConfig, useHotPanIfAvailable = true) {

        if (!this.#checkActionPreconditions(partyConfig)) {
            return;
        }

        // Apart from a regular preconditions above, the config also needs a stored partyToken
        if (!this.#hasPartyToken(partyConfig)) {
            return;
        }

        const partyNo = partyConfig.definition.partyNo;
        Logger.debug(this.#crunchParty.name, `party#${partyNo} - partyConfig is valid: `, partyConfig);

        // Check if we need to abort because of duplicate member tokens in the scene
        const memberTokenDuplicates = this.#countTokensByNames(partyConfig.definition.memberTokenNames, 2);
        if (memberTokenDuplicates.length > 0) {
            Logger.error(this.#crunchParty.name, false,`${Config.localize('errMsg.notUniqueInScenePlural')}:<br/><br/>
                ${memberTokenDuplicates.map(c => c.name + ": " + c.count + "x").join("<br/>")}`);
            return;
        }

        const tokenUpdates = [];
        const partyConfigUpdates = {};

        // Collect member tokens in scene
        let memberTokensToRemove = [];
        for (let memberName of partyConfig.definition.memberTokenNames) {
            const tokenFound = canvas.tokens.ownedTokens.find(t => t.name === memberName);
            if (tokenFound === undefined) {
                Logger.info(`this.#crunchParty - member token '${memberName}' not found in scene => skipped`);
                continue;
            }
            if (memberName === partyConfig.definition.partyTokenName) {
                Logger.debug(this.#crunchParty.name, `Member token '${memberName}' is also the party token => skipped`);
                continue;
            }
            memberTokensToRemove.push(tokenFound);
            Logger.debug(this.#crunchParty.name, `member token '${memberName}' found => added to list for removal`, tokenFound);
        }

        // Identify target token
        let targetToken;
        // Case 1: If a member token is defined and the "leader", and it is present in the scene, it has precedence
        if (Config.globals.partyTokenModes.MEMBER === partyConfig.definition.partyTokenMode) {
            targetToken = canvas.tokens.ownedTokens.find(t => t.name === partyConfig.definition?.partyTokenName) ?? undefined;
        }
        if (targetToken) {
            Logger.debug(this.#crunchParty.name, `Using leading party member as the target: [${partyConfig.definition?.partyTokenName}]`, targetToken);
        }
        // Case 2: If member tokens are present in the scene, use one of them as the target
        else if (memberTokensToRemove.length > 0) {
            const memberTokensSelected = memberTokensToRemove
                .filter(t =>
                    canvas.tokens.controlled.map(tc => tc.name)
                        .find(tn => tn === t.name));
            if (memberTokensSelected.length === 1) {
                // 2a: If only one selected, use that one ...
                memberTokensSelected[0].control({releaseOthers: true});
                targetToken = canvas.tokens.controlled[0];
                Logger.debug(this.#crunchParty.name, `Using single selected member token as target: [${targetToken.name}]`, targetToken);
            } else {
                // 2b: ... otherwise pick one at random
                memberTokensToRemove.forEach(t => t.control({releaseOthers: false}));
                targetToken = canvas.tokens.controlled[0];
                Logger.debug(this.#crunchParty.name, `Using last selected token as target: [${targetToken.name}]`, targetToken);
            }
        }
        // Case 3: No members in scene, but Party token: This means that the party in this scene is in opposite state as according to config
        else {
            targetToken = canvas.tokens.ownedTokens.find(t => t.name === partyConfig.definition?.partyTokenName);
            Logger.debug(this.#crunchParty.name, `Trying to use already existing and crunched Party token as the target: [${targetToken?.name}]`, targetToken);
        }
        // If nothing was successful, abort
        if (!targetToken) {
            Logger.error(this.#crunchParty.name, false,
                `${Config.localize("errMsg.tokensMissingInScene")
                    .replace("{partyNo}", partyConfig.definition.partyNo)
                    .replace("{partyName}", partyConfig.definition.partyTokenName)}`);
            return;
        }

        // Select the target and try to set the view onto it
        await this.#panToTarget(targetToken, useHotPanIfAvailable);

        // Play audio and JB2A animation (if supported)
        await this.#playAnimation(Config.globals.states.CRUNCHED, targetToken);

        // Move all members towards target token (including aligning their elevation!)
        memberTokensToRemove = memberTokensToRemove.reverse(); // reverse() may make this visually a bit nicer
        for (const token of memberTokensToRemove) {
            tokenUpdates.push(
                this.#createTokenTeleportUpdate(
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
        const tokenCount = this.#countTokensByNames([partyConfig.definition.partyTokenName]);
        const partyTokenCount = tokenCount[partyConfig.definition.partyTokenName];

        // Replace already existing party token(s) if necessary
        if (partyTokenCount > 1) {
            if (this.#hasPartyToken(partyConfig)) {

                const tokenConflictResolution = await this.#promptForDuplicateReplaceOrKeep(partyTokenCount);
                Logger.debug(this.#crunchParty.name, `tokenConflictResolution: `, tokenConflictResolution);

                // Apply the chosen conflict resolution
                if (tokenConflictResolution.replace) {
                    for (const t of canvas.tokens.ownedTokens.filter(t => t.name === partyConfig.definition.partyTokenName)) {
                        Logger.debug(this.#crunchParty.name, `Deleting redundant party token: `, t);
                        await t.delete();
                    }
                } else if (tokenConflictResolution.keep) {
                    effectivePartyToken = canvas.tokens.ownedTokens.find(t => t.name === partyConfig.definition.partyTokenName);
                    partyConfigUpdates.partyToken = effectivePartyToken;
                    Logger.debug(this.#crunchParty.name, `effectivePartyToken reused from scene: `, effectivePartyToken);
                } else { // tokenConflictResolution.cancelled
                    return false;
                }
            }
        }

        // If no partyToken has been assigned until here, the default applies:
        // If one exists in the scene, reuse it. Otherwise, instantiate a new one from partyConfig
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
                    Logger.debug(this.#crunchParty.name, `effectivePartyToken created from partyConfig: `, effectivePartyToken);
                    Logger.debug(this.#crunchParty.name, `effectivePartyToken pos [x:${effectivePartyToken.document.x}|y:${effectivePartyToken.document.y}|e:${effectivePartyToken.document.elevation}] set to targetToken pos [x:${targetToken.document.x}|y:${targetToken.document.y}|e:${targetToken.document.elevation}]`);

                } else {
                    // Otherwise throw an error
                    Logger.error(this.#crunchParty.name, false, Config.localize("partyTokenMissingInConfig").replace("#tokenName", partyConfig.partyTokenName));
                    return;
                }
            }
        }

        // Reveal the party token
        tokenUpdates.push(
            this.#createTokenTeleportUpdate(
                effectivePartyToken,
                {
                    name: effectivePartyToken.document.name,
                    hidden: false
                }));

        // Apply all the updates
        for (const update of tokenUpdates) {
            const tokenDoc = canvas.scene.tokens.get(update._id);
            if (!tokenDoc) return;
            Logger.debug(this.#crunchParty.name, `Updating token [${update.name}] to [x:${update.x}|y:${update.y}|e:${update.elevation}|hidden:${update.hidden}]`);
            await tokenDoc.update(
                {
                    x: update.x,
                    y: update.y,
                    elevation: update.elevation,
                    hidden: update.hidden
                });
        }

        // Merge member tokens in the scene into stored list, then remove them from the scene
        if (memberTokensToRemove.length > 0) {
            partyConfigUpdates.memberTokens = partyConfig.memberTokens;
            // Merge all currently found tokens into the existing storage, replacing old versions
            memberTokensToRemove.forEach(
                memberTokenFromScene => {
                    if (partyConfig.definition.memberTokenNames.find(nameFromList => nameFromList === memberTokenFromScene.name)) {
                        partyConfigUpdates.memberTokens.splice(
                            partyConfigUpdates.memberTokens.indexOf(
                                partyConfigUpdates.memberTokens.find(t => t.name === mt.name)
                            ), 1, memberTokenFromScene)
                    }
                }
            );
            Logger.debug(this.#crunchParty.name, `New merged member token list to store: `, partyConfigUpdates.memberTokens);
            Logger.debug(this.#crunchParty.name, `Removing ${memberTokensToRemove.length} tokens from scene: `, memberTokensToRemove);
            for (const member of memberTokensToRemove) {
                await member.document.delete();
            }
        }

        partyConfigUpdates.lastKnownState = Config.globals.states.CRUNCHED;
        await this.#updatePartyConfig(partyNo, partyConfigUpdates);

        // Finally, make party token the active one
        await effectivePartyToken.control({releaseOthers: true});

        Logger.debug(this.#explodeParty.name, `CRUNCH action complete.`);
    }

    static async #explodeParty(partyConfig, useHotPanIfAvailable = true) {

        if (!this.#checkActionPreconditions(partyConfig)) {
            return;
        }

        // Apart from a regular preconditions above, the config also needs stored memberTokens
        if (!this.#hasMemberTokens(partyConfig)) {
            return;
        }

        // Check if we need to abort because of duplicate party tokens in the scene
        const partyTokenDuplicates = this.#countTokensByNames([partyConfig.definition.partyTokenName], 2);
        if (partyTokenDuplicates.length > 0) {
            Logger.error(this.#explodeParty.name, false,`${Config.localize('errMsg.notUniqueInScenePlural')}:<br/><br/>
                ${partyTokenDuplicates.map(c => c.name + ": " + c.count + "x").join("<br/>")}`);
            return;
        }

        const partyConfigUpdates = {};

        // Collect member tokens in scene, then check how to handle duplicates
        const memberTokensToRemove = [];
        const memberTokensToKeep = [];

        const memberTokenCounts = this.#countTokensByNames(partyConfig.definition.memberTokenNames);
        let applyToAll = false;
        let tokenConflictResolution;
        let cnt = 0;
        for (const memberCount of memberTokenCounts) {
            cnt++;
            if (memberCount.name === partyConfig.definition.partyTokenName && memberCount.count === 1) {
                // If the member is also the Party token and exists only once in the scene, that's absolutely fine
                continue;
            }
            Logger.debug(this.#explodeParty.name, `memberCount:`, memberCount);
            if (!tokenConflictResolution?.applyToAll) {
                tokenConflictResolution = await this.#promptForDuplicateReplaceOrKeep(memberCount, (cnt < memberTokenCounts.length));
            }
            const tokenFound = canvas.tokens.ownedTokens.find(t => t.name === memberCount.name);
            if (tokenConflictResolution.replace) {
                Logger.debug(this.#explodeParty.name, `Existing token [${memberCount.name}] flagged for REPLACE (by GM confirmation).`);
                memberTokensToRemove.push(tokenFound);
            }
            else if (tokenConflictResolution.keep){
                Logger.debug(this.#explodeParty.name, `Existing token [${memberCount.name}] flagged for KEEP (by GM confirmation).`);
                memberTokensToKeep.push(tokenFound);
            }
            // cancelled
            else {
                Logger.debug(this.#explodeParty.name, `Duplicate confirmation cancelled by the GM. This cancels the EXPLODE action.`);
                return;
            }
        }
        Logger.debug(this.#explodeParty.name, `memberTokensToRemove`, memberTokensToRemove);
        Logger.debug(this.#explodeParty.name, `memberTokensToKeep`, memberTokensToKeep);

        // Remove unnecessary tokens
        for (const token of memberTokensToRemove) {
            await token.document.delete();
        }

        // Identify target token
        // Case 1: Use the party token in the scene (if present)
        let targetToken;
        if (partyConfig.definition?.partyTokenName) {
            targetToken = canvas.tokens.ownedTokens.find(t => t.name === partyConfig.definition.partyTokenName);
        }
        if (targetToken) {
            Logger.debug(this.#explodeParty.name, `Using party token as the target: [${partyConfig.definition?.partyTokenName}]`, targetToken);
        }
        // Case 2: If there are tokens to keep (from above), use either of them
        else if (memberTokensToKeep.length > 0) {
            const keptTokensSelected = memberTokensToKeep
                .filter(t =>
                    canvas.tokens.controlled.map(tc => tc.name)
                        .find(tn => tn === t.name));
            if (keptTokensSelected.length === 1) {
                // 2a: If only one selected, use that one ...
                keptTokensSelected[0].control({releaseOthers: true});
                targetToken = canvas.tokens.controlled[0];
                Logger.debug(this.#explodeParty.name, `Using single selected member token as target: [${targetToken.name}]`, targetToken);
            } else {
                // 2b: ... otherwise pick one at random
                memberTokensToKeep.forEach(t => t.control({releaseOthers: false}));
                targetToken = canvas.tokens.controlled[0];
                Logger.debug(this.#explodeParty.name, `Using last selected token as target: [${targetToken.name}]`, targetToken);
            }
        }
        // If nothing was successful, abort
        if (!targetToken) {
            Logger.error(this.#crunchParty.name, false,
                `${Config.localize("errMsg.tokensMissingInScene")
                    .replace("{partyNo}", partyConfig.definition.partyNo)
                    .replace("{partyName}", partyConfig.definition.partyTokenName)}`);
            return;
        }

        // Select the target and try to set the view onto it
        await this.#panToTarget(targetToken, useHotPanIfAvailable);

        // Play audio and JB2A animation (if supported)
        await this.#playAnimation(Config.globals.states.EXPLODED, targetToken);

        // Move all existing members to keep to the target token (including aligning their elevation!)
        for (const existingToken of memberTokensToKeep) {
            tokenUpdates.document.update(
                {
                    x: targetToken.document.x,
                    y: targetToken.document.y,
                    elevation: targetToken.document.elevation,
                    hidden: false
                });
            Logger.debug(this.#explodeParty.name, `Moving existing token [${existingToken.name}] to target pos:`, existingToken);
        }

        // Everyone at home, grab a drink and show up at the Party center!
        // In other words: Create all the remaining tokens from partyConfig (hidden at the target position)
        for (const storedTokenData of partyConfig.memberTokens) {
            if (memberTokensToKeep.map(m => m.name).indexOf(storedTokenData.name) > -1) {
                continue;
            }
            storedTokenData.x = targetToken.document.x;
            storedTokenData.y = targetToken.document.y;
            storedTokenData.elevation = targetToken.document.elevation;
            storedTokenData.hidden = false;
            await canvas.scene.createEmbeddedDocuments("Token", [storedTokenData]);
            const newToken = canvas.tokens.ownedTokens.find(o => o.name === storedTokenData.name);
            memberTokensToKeep.push(newToken);
            Logger.debug(this.#explodeParty.name, `Created new token [${newToken.name}] from partyConfig at target pos:`, newToken);
        }

        // Update partyConfig by adding all involved tokens
        const partyToken = canvas.tokens.ownedTokens.find(o => o.name === partyConfig.definition.partyTokenName);
        if (partyToken) {
            partyConfigUpdates.partyToken = partyToken;
        }

        // Explode: Everyone, swarm out and take your positions!
        let tokenCounter = 0;
        let activeTokenAfter;
        for (const memberToken of memberTokensToKeep) {

            // Flag the first one as the active token for afterward
            if (!activeTokenAfter) {
                activeTokenAfter = memberToken;
            }

            //Set selection to current token.
            //Otherwise, movement by moveMany below won't have any effect
            memberToken.control({releaseOthers: true});

            // Position each token along an "outward spiral" around the origin (which is the party token)
            let movementPath = this.#getMovementPathToExplodePosition(tokenCounter++);
            Logger.debug(this.#explodeParty.name, `[${memberToken.name}]: movementPath =>`, movementPath);

            const tokenDoc = memberToken.document;
            if (!tokenDoc) return;

            const relative = movementPath;      // {x: dx, y: dy} from the matrix above
            const gridSize = canvas.grid.size;

            let targetX = tokenDoc.x + relative.x * gridSize;
            let targetY = tokenDoc.y + relative.y * gridSize;
            let targetE = targetToken.elevation;

            // Snap to nearest grid
            const point = {x: targetX, y: targetY, elevation: tokenDoc.elevation};
            Logger.debug(this.#explodeParty.name, `[${memberToken.name}]: point =>`, point);
            const snapped = canvas.grid.getSnappedPoint(point, {mode: CONST.GRID_SNAPPING_MODES.CENTER});
            Logger.debug(this.#explodeParty.name, `[${memberToken.name}]: snapped =>`, snapped);
            targetX = snapped.x;
            targetY = snapped.y;

            await tokenDoc.move(
                [{ x: targetX, y: targetY, elevation: targetE }],
                {
                    method: "api",
                    showRuler: false,
                    constrainOptions: {ignoreWalls: false},
                    animation: {duration: 400}
                }
            );
        }

        // Set control onto the innermost token
        activeTokenAfter.control({releaseOthers: true});

        // Finally, update the Party configuration
        partyConfigUpdates.memberTokens = memberTokensToKeep;
        partyConfigUpdates.lastKnownState = Config.globals.states.EXPLODED;
        await this.#updatePartyConfig(partyConfig.definition.partyNo, partyConfigUpdates);
        await partyToken.document.delete();

        Logger.debug(this.#explodeParty.name, `EXPLODE action complete.`);
    }

    static #checkActionPreconditions(partyConfig) {
        return canvas.ready && this.isValidDefinition(partyConfig);
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
        Logger.debug(this.#createTokenTeleportUpdate.name, `update: `, update);
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
        <div style="max-height: 650px; max-width: 1000px; overflow: auto">
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
            <hr>`;

        const partySelectionList = await this.#createPartyTable({
            radioButtons: true,
            allowToSelectEmpty: true,
            noscrolling: true,
            title: Config.localize('promptForPartyDefinition.partyNo.text')
        });
        content += partySelectionList.contentHTML;

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
                            this.#resolvePromptForPartyDefinition(
                                button.form.elements.tokenChoice.value,
                                button.form.elements.modeChoice.value,
                                button.form.elements.partyNo.value))
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
                        callback: () => resolve(this.toggleParty(partyNo))
                    },
                    {
                        action: "no",
                        label: Config.localize('promptForCrunchAfterGrouping.no'),
                        callback: () => resolve({cancelled: true})
                    }]
            }).render({force: true});
        });
    }

    static async #promptForDuplicateReplaceOrKeep(duplicateData, hasMore = false) {

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

        if (hasMore) {
            content += `
                    <label>
                        <input type="checkbox" name="applyToAll" checked 
                               alt="${Config.localize('applyToAll')}"
                               title="${Config.localize('applyToAll')}"/>
                               ${Config.localize('applyToAll')}</label><br/>`;
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
                            applyToAll: (hasMore && button.form.elements.applyToAll.checked)
                        })
                    },
                    {
                        action: "keep",
                        label: Config.localize('promptForDuplicateReplaceOrKeep.keep'),
                        default: true,
                        disabled: (duplicateData.count > 1),
                        callback: (event, button) => resolve({
                            keep: true,
                            applyToAll: (hasMore && button.form.elements.applyToAll.checked)
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
        Logger.debug(this.#resolvePromptForPartyDefinition.name, `User chosen value: `, result);
        return result;
    }

    static async #promptForPartySelection() {

        const tableData = await this.#createPartyTable({
            radioButtons: true,
            title: Config.localize('promptForPartySelection.tableTitle')
        });

        return new Promise(resolve => {
            new foundry.applications.api.DialogV2({
                window: { title: Config.localize('promptForPartySelection.windowTitle') },
                content: tableData.contentHTML,
                buttons: [
                    {
                        action: "select",
                        label: Config.localize('okButton'),
                        default: true,
                        callback: (event, button) => resolve({
                            partyNo: button.form.elements.partyNo.value
                        })
                    },
                    {
                        action: "cancel",
                        label: Config.localize('cancelButton'),
                        callback: () => resolve({cancelled: true})
                    }],
            }).render({force: true});
        });
    }

    static async #createPartyTable(tableConfig = {}) {

        const {divTemplate, tableTemplate, tableRowTemplate, imgTemplate, radioButtonTemplate} = this.#getPartyTableTemplates(tableConfig);
        const allConfigs = this.#getAllPartyConfigs();

        let divContentHTML = "";
        let tableContentHTML = "";
        let tableBodyHTML = "";
        let buttons = [];

        for (let i = 1; i <= Config.setting("maxNoOfParties"); i++) {

            const config = allConfigs[i];

            // Logger.debug(this.#promptForPartySelection.name, `config`, config);

            // Defaults (for any unused party slots)
            let radioButton = ""
            let partyNo = i;
            let partyName = Config.localize('empty').toUpperCase();
            let partyImg = "";
            let membersImgs = "";
            let partyState = Config.localize(`partyState.UNKNOWN`);

            // Party information
            if (config) {
                if (tableConfig.radioButtons) {
                    radioButton = await this.#renderPartyRadioButton(radioButtonTemplate, i);
                }

                partyName = config.definition.partyTokenName;
                const partyTokenImgPath = config.partyToken?.texture?.src;
                partyImg = (partyTokenImgPath !== undefined)
                    ? await this.#renderHTML(
                        imgTemplate,
                        {
                            imgPath: partyTokenImgPath,
                            alt: partyName,
                            title: partyName,
                            size: 70
                        })
                    : "";
                // Logger.debug(this.#promptForPartySelection.name, `Rendered partyImg`, partyImg);

                // Member information
                let membersNamesArr = [];
                let membersImgsArr = [];
                for (let name of config.definition.memberTokenNames) {
                    let memberNameFormatted = (name === partyName) ? "<strong>" + name + "</strong>" : name;
                    let size = (name === partyName) ? 60 : 50;
                    const memberImgPath = config.memberTokens?.find(t => t.name === name)?.texture?.src;
                    let memberImg = (memberImgPath !== undefined)
                        ? await this.#renderHTML(
                            imgTemplate,
                            {
                                imgPath: memberImgPath,
                                alt: name,
                                title: name,
                                size: size,
                                text: name
                            })
                        : "";

                    // Logger.debug(this.#promptForPartyDefinition.name, `Rendered memberImg`, memberImg);
                    membersNamesArr.push(memberNameFormatted);
                    membersImgsArr.push(memberImg);
                }
                membersImgs = membersImgsArr.join("");

                // Detect party state
                if (config.lastKnownState) {
                    partyState = Config.localize(`partyState.${config.lastKnownState}`);
                }

                // As requested: Add additional actions button for this party to the bottom bar
                if (tableConfig.actionButtons?.FIND) {
                    buttons.push(
                        {
                            action: `find${partyNo}`,
                            label: Config.localize('partyTable.findButton').replace('{partyNo}', partyNo),
                            callback: () => this.findParty(partyNo)
                        });
                }
                if (tableConfig.actionButtons?.DELETE) {
                    buttons.push(
                        {
                            action: `delete${partyNo}`,
                            label: Config.localize('partyTable.deleteButton').replace('{partyNo}', partyNo),
                            callback: () => this.deleteParty({
                                partyNo: partyNo,
                                partyName: partyName,
                                noOfMembers: membersNamesArr.length
                            })
                        });
                }
            }
            // If config is empty, it may still be requested to add a radioButton
            else if (tableConfig.radioButtons && tableConfig.allowToSelectEmpty) {
                radioButton = await this.#renderPartyRadioButton(radioButtonTemplate, i);
            }

            tableBodyHTML += await this.#renderHTML(
                tableRowTemplate,
                {
                    firstCellContent: radioButton,
                    partyNo: partyNo,
                    partyImg: partyImg,
                    partyName: partyName,
                    membersImgs: membersImgs,
                    partyState: partyState
                });
            // Logger.debug(this.#promptForPartySelection.name, `Rendered rowsHTML`, tableBodyHTML);
        }

        if (tableConfig.actionButtons) {
            buttons.push(
                {
                    action: "close",
                    label: Config.localize('closeButton'),
                    default: true
                })
        }

        // Finally, render the full table
        const tableRenderData = {
            tableTitle: tableConfig.title ?? "",
            partyHeaderText: Config.localize('labels.partyTokenName'),
            membersHeaderText: Config.localize('labels.memberTokenNames'),
            partyStateHeaderText: Config.localize('labels.partyState'),
            tableBodyHTML: tableBodyHTML
        };

        tableContentHTML += await this.#renderHTML(tableTemplate, tableRenderData);

        divContentHTML = await this.#renderHTML(divTemplate, {
            divContent: tableContentHTML
        });

        const returnData = {
            contentHTML: divContentHTML,
            buttons: buttons
        }
        Logger.debug(this.#promptForPartySelection.name, `Rendered tableData`, returnData);

        return returnData;
    }

    static async #renderPartyRadioButton(radioButtonTemplate, i) {
        let radioButton = await this.#renderHTML(radioButtonTemplate,
            {
                paramName: "partyNo",
                value: i,
                text: ""
            });
        if (i !== 1) radioButton = radioButton.replace(" checked", "");
        Logger.debug(this.#renderPartyRadioButton.name, `Rendered radioButton`, radioButton);
        return radioButton;
    }

    static #getPartyTableTemplates(tableConfig) {
        const divTemplate = (tableConfig.noscrolling)
            ? `${Config.globals.templatePath}/dialog-div-fixed.html`
            : `${Config.globals.templatePath}/dialog-div-scrollable.html`;
        const tableTemplate = `${Config.globals.templatePath}/party-list-table.html`;
        const tableRowTemplate = `${Config.globals.templatePath}/party-list-table-row.html`;
        const imgTemplate = `${Config.globals.templatePath}/token-img.html`;
        const radioButtonTemplate = `${Config.globals.templatePath}/radio-button.html`;

        const templates = {
            divTemplate,
            tableTemplate,
            tableRowTemplate,
            imgTemplate,
            radioButtonTemplate
        }
        Logger.debug(this.#getPartyTableTemplates.name, `templates`, templates);

        return templates;
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

        const tableData = await this.#createPartyTable({
            actionButtons: {
                FIND: true,
                DELETE: true,
                CLOSE: true
            }
        });

        return new Promise(resolve => {
            new foundry.applications.api.DialogV2({
                window: {title: Config.localize('settingsMenu.partyConfigSection')},
                content: tableData.contentHTML,
                buttons: tableData.buttons
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
        Logger.debug(this.#getAllPartyConfigs.name, `Reading all partyConfigs: `, partyConfigs);
        return (partyConfigs !== undefined && partyConfigs !== null) ? partyConfigs : {};
    }

    static #getPartyConfig(partyNo) {
        try {
            return foundry.utils.deepClone(Config.setting("partyConfigs")[partyNo]);
        } catch (e) {
            Logger.error(this.#getAllPartyConfigs.name, true, 'this.#getPartyConfig', e);
            ui.notifications.error(`[${Config?.globals?.modTitle ?? ""}] Can't read Party Configuration for Party #${partyNo}. Please check the logs`);
        }
    }

    static isValidDefinition(partyConfig) {
        if (partyConfig.definition === undefined) {
            Logger.error(this.isValidDefinition.name, false, 'this.isValidDefinition(partyConfig) - definition is empty.');
            return false;
        }
        if (partyConfig.definition.partyNo === undefined || isNaN(partyConfig.definition.partyNo) || partyConfig.definition.partyNo < 1 || partyConfig.definition.partyNo > Config.setting("maxNoOfParties")) {
            Logger.error(this.isValidDefinition.name, false, `this.#isValid(partyConfig) - definition does not contain a  valid partyNo (must be a number between 1 and ${Config.setting("maxNoOfParties")}): `, partyNo);
            return false;
        }
        if (partyConfig.definition.partyTokenName === undefined) {
            Logger.error(this.isValidDefinition.name, false, 'this.isValidDefinition(partyConfig) - definition.partyTokenName is missing or empty: ', definition.partyTokenName);
            return false;
        }
        const allowedModes = Object.values(Config.globals.partyTokenModes);
        if (partyConfig.definition.partyTokenMode === undefined || !allowedModes.find(m => m === partyConfig.definition.partyTokenMode)) {
            Logger.error(this.isValidDefinition.name, false, `this.#isValid(partyConfig) - definition.partyTokenMode is invalid (must be one of: ${allowedModes.join((", "))}) `, definition.partyTokenName);
            return false;
        }
        if (partyConfig.definition.memberTokenNames === undefined || partyConfig.definition.memberTokenNames.length === 0) {
            Logger.error(this.isValidDefinition.name, false, 'this.isValidDefinition(partyConfig) - definition.memberTokenNames is missing or an empty list: ', definition.memberTokenNames);
            return false;
        }

        // If you've come this far, consider yourself valid ;-)
        return true;
    }

    static #hasPartyToken(partyConfig) {
        if (partyConfig.partyToken === undefined
            || typeof partyConfig.partyToken !== "object") {
            Logger.error(this.#hasPartyToken.name, false, 'this.#hasPartyToken(partyConfig) - no partyToken in partyConfig: ', partyConfig);
            return false;
        }
        return true;
    }

    static #hasMemberTokens(partyConfig) {
        if (partyConfig.memberTokens === undefined
            || typeof partyConfig.memberTokens !== "object") {
            Logger.error(this.#hasMemberTokens.name, false, 'this.##hasMemberTokens(partyConfig) - no memberTokens in partyConfig: ', partyConfig);
            return false;
        }
        return true;
    }

    static async #playAnimation(requestedState, targetToken) {

        const animationPath = Config.setting(`animationFile${requestedState}`).trim();
        let audioPath = Config.setting(`playAudio${requestedState}`) ? Config.setting(`audioFile${requestedState}`).trim() : Config.NO_AUDIO_FILE;
        if (!audioPath) audioPath = Config.NO_AUDIO_FILE;
        Logger.debug(this.#playAnimation.name,
            `requestedState: ${requestedState}`,
            `animationPath: ${animationPath}`,
            `audioPath: ${audioPath}`,
            `Audio base dir (window.location.pathname): ${window.location.pathname}`);

        // If JB2A_DnD5e && AA are installed, play the animation
        if (animationPath && (
            optionalDependenciesAvailable.includes('JB2A_DnD5e')
            || optionalDependenciesAvailable.includes('jb2a_patreon'))
            && optionalDependenciesAvailable.includes('autoanimations')) {
            Logger.debug(this.#playAnimation.name, `animationPath: ${animationPath}`);

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
