import {Logger} from './logger.js';
import {Config} from './config.js'
import {ChatInfo} from "./chatinfo.js";

const SUBMODULES = {
    MODULE: Config,
    logger: Logger,
    chatinfo: ChatInfo
};

const optionalDependencies = ['hot-pan', 'JB2A_DnD5e'];
let optionalDependenciesAvailable = [];

let ready2play;

/**
 * Global initializer block:
 * First of all, we need to initialize a lot of stuff in correct order:
 */
(async () => {
        console.log("Crunch My Party! | Initializing Module ...");

        await allPrerequisitesReady();

        ready2play = true;
        Logger.infoGreen(`Ready to play! Version: ${game.modules.get(Config.data.modID).version}`);
        Logger.info(Config.data.modDescription);
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
            resolve(initDependencies());
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

async function scanForOptionalDependencies() {
    for (let modID of optionalDependencies) {
        if (game.modules.get(modID)?.active) {
            Logger.info(`Optional 3rd-party mod [${modID}] is installed - HURRAY!`);
            optionalDependenciesAvailable.push(modID);
        } else {
            Logger.info(`Optional 3rd-party mod [${modID}] is NOT installed.`);
        }
    }
    Logger.debug(optionalDependenciesAvailable);
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
        alert(`Module '${Config.data.modTitle}' says: '${ready2play ? `I am alive!` : `I am NOT ready - something went wrong:(`}'`);
    }

    static #isBusy;

    static isBusy() {
        return this.#isBusy;
    }

    static setBusy(isBusy) {
        this.#isBusy = isBusy;
        Logger.debug((isBusy) ? "BUSY!" : "NOT BUSY")
    }

    static #instances = [null, null, null];

    static #getInstance(partNo) {
        if (this.#instances[partNo] == null) {
            this.#instances[partNo] = new PartyCruncher();
        }
        return this.#instances[partNo];
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

        Logger.info(`TOGGLE - partyNo: #${partyNo}, useHotPan: ${useHotPanIfAvailable} ...`);

        const instance = PartyCruncher.#getInstance(partyNo);

        try {

            PartyCruncher.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate party definitions from module settings
            // ==================================================================================================
            // grab raw input values from user prefs
            let validatedNames = instance.#collectValidatedTokenNamesFromModuleSettings(partyNo);
            Logger.debug(validatedNames);

            // ==================================================================================================
            // Step 2 - Update user prefs in module settings with the now cleaned lists
            // ==================================================================================================
            PartyCruncher.#updateSettings(partyNo, validatedNames);

            // ==================================================================================================
            // Step 3 - gather and validate all the involved tokens from current scene
            // ==================================================================================================
            let involvedTokens = instance.#collectInvolvedTokens(validatedNames, partyNo);
            Logger.debug(involvedTokens);

            // ==================================================================================================
            // Step 4 - auto-determine the required action (CRUNCH or EXPLODE?)
            // ==================================================================================================
            let requiredAction = instance.#determineRequiredAction(involvedTokens, partyNo);
            Logger.debug(`required action: ${requiredAction.toString()}`);

            // ==================================================================================================
            // Step 5 - auto-determine target token (depending on requiredAction), and focus on it
            // ==================================================================================================
            let targetToken = instance.#getTarget(requiredAction, involvedTokens, partyNo);
            Logger.debug(`target token: [${targetToken.name}]`);
            canvas.tokens.releaseAll();
            if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
                Logger.debug(`switching HotPan ON (useHotPan: ${useHotPanIfAvailable})`);
                HotPan.switchOn(true); // true means: silentMode (no UI message)
            }
            targetToken.control({releaseOthers: true})
            canvas.animatePan(targetToken.getCenter(targetToken.x, targetToken.y));
            if (useHotPanIfAvailable && optionalDependenciesAvailable.includes('hot-pan')) {
                setTimeout(function () {
                    Logger.debug(`switching HotPan BACK (useHotPan: ${useHotPanIfAvailable})`);
                    HotPan.switchBack(true); // true means: silentMode (no UI message)
                }, 1000);
            }

            // ==================================================================================================
            // Step 6 - And finallyyyyyyy.... just DO IT!!
            // ==================================================================================================
            switch (requiredAction) {
                case PartyCruncher.Actions.CRUNCH:
                    Logger.info(`Crunching party ${partyNo} ...`);
                    await instance.#crunchParty(involvedTokens, targetToken, partyNo);
                    break;
                case PartyCruncher.Actions.EXPLODE:
                    Logger.info(`Exploding party ${partyNo} ...`);
                    await instance.#explodeParty(involvedTokens, targetToken, partyNo);
            }

        } catch (e) {
            Logger.error(false, e); // This will also print an error msg to the screen
            return;
        } finally {
            PartyCruncher.setBusy(false);
        }

        Logger.info(`... Toggling of party #${partyNo} complete.`);
        PartyCruncher.setBusy(false);
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

        Logger.debug(`GROUP - partyNo: ${partyNo} ...`);

        // Force activation of the Token Layer in the UI
        // The following steps require token selection, which won't work with any other layer active
        canvas.tokens.activate();

        const instance = PartyCruncher.#getInstance(partyNo);

        try {

            PartyCruncher.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate current token selection
            // ==================================================================================================
            // grab names from all currently selected tokens
            let namesFromSelection = instance.#collectNamesFromTokenSelection();
            // ask the GM for the name of the party token to use
            let partyTokenNameInput = await PartyCruncher.#promptForPartyTokenName(partyNo);
            if (partyTokenNameInput.cancelled) {
                return;
            } else {
                namesFromSelection.partyTokenNames = [partyTokenNameInput];
                Logger.debug(`namesFromSelection for grouping party #${partyNo}:`, namesFromSelection);
            }
            let validatedNames = instance.#validateNames(partyNo, namesFromSelection);

            // ==================================================================================================
            // Step 2 - Update user prefs in module settings with detected names lists
            // ==================================================================================================
            PartyCruncher.#updateSettings(partyNo, validatedNames);

            // ==================================================================================================
            // Step 3 - Confirm in UI that group assignment was successful
            // ==================================================================================================
            let msg =
                `${Config.localize('groupingConfirmation')
                    .replace('{partyNo}', partyNo)
                    .replace('{partyTokenName}', validatedNames.partyTokenName)}:</br>` +
                `<ul><li>` +
                validatedNames.memberTokenNames.join(`</li><li>`) +
                `</li></ul>`;
            ui.notifications.info(msg);
            Logger.info(msg);

        } catch (e) {
            Logger.error(false, e); // This will also print an error msg to the screen
            return;
        } finally {
            PartyCruncher.setBusy(false);
        }

        Logger.info(`... Grouping of party #${partyNo} complete.`);
        PartyCruncher.setBusy(false);
    }

    /**
     * Public method for usage in macros: Select all member tokens of a given party in the scene.
     * The new target token depends on whether party is crunched or exploded (auto-detected).
     * @param partyNo
     * @param useHotPanIfAvailable - toggles "Hot Pan & Zoom!", if it is available (autofocussing players' scene views onto the party)*/
    static findParty(partyNo, useHotPanIfAvailable = true) {

        if (PartyCruncher.isBusy()) {
            Logger.warn(false, Config.localize("errMsg.pleaseWaitStillBusy"));
            return;
        }

        Logger.debug(`FIND - partyNo: ${partyNo}, useHotPan: ${useHotPanIfAvailable} ...`);

        const instance = PartyCruncher.#getInstance(partyNo);

        try {

            PartyCruncher.setBusy(true);

            // ==================================================================================================
            // Step 1 - Parse & validate party definitions from module settings
            // ==================================================================================================
            // grab raw input values from user prefs
            let validatedNames = instance.#collectValidatedTokenNamesFromModuleSettings(partyNo);
            Logger.debug(validatedNames);

            // ==================================================================================================
            // Step 2 - gather and validate all the involved tokens from current scene
            // ==================================================================================================
            let involvedTokens = instance.#collectInvolvedTokens(validatedNames, partyNo);
            Logger.debug(involvedTokens);

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
            PartyCruncher.setBusy(false);
        }

        Logger.debug(`FINDing of party #${partyNo} complete.`);
        PartyCruncher.setBusy(false);
    }

    #collectValidatedTokenNamesFromModuleSettings(partyNo) {
        let memberTokenNamesString = Config.setting(`memberTokenNames${partyNo}`);
        let partyTokenNameString = Config.setting(`partyTokenName${partyNo}`);
        let namesFromSettings = this.#collectNamesFromStrings(partyNo, memberTokenNamesString, partyTokenNameString);
        return this.#validateNames(partyNo, namesFromSettings);
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
            .map(name => name.trim().toLowerCase())
            .filter(name => name.length > 0); // ignore empty strings resulting from input like ",," or ", ,"
        let partyTokenNames = partyTokenNameString
            .split(",")
            .map(name => name.trim().toLowerCase())
            .filter(name => name.length > 0); // ignore empty strings resulting from input like ",," oder ", ,"

        Logger.debug(memberTokenNames);
        Logger.debug(partyTokenNames);

        return {
            memberTokenNames: memberTokenNames,
            partyTokenNames: partyTokenNames
        };
    }

    #collectNamesFromTokenSelection() {
        let tokenNamesFound = Array.from(canvas.tokens.controlled.map(t => t.name.toLowerCase()));
        if (tokenNamesFound.length < 2) {
            // TODO localize
            throw new Error(
                Config.localize('errMsg.invalidNumberOfMemberTokens'));
        }
        return {
            memberTokenNames: tokenNamesFound,
            partyTokenName: null // Still unassigned. Will be set by user input prompt
        };
    }

    /**
     * Validate given list of token names from module settings.
     * Throw meaningful UI errors if anything isn't valid.
     * @param partyNo
     * @param names
     * @returns {{partyTokenName: *, memberTokenNames: (*|any[])}}
     */
    #validateNames(partyNo = 1, names) {

        Logger.debug(names);
        let errMsg = "";

        // Check 1: Do we have enough tokens? Do we have not too many tokens?
        if (
            !names.memberTokenNames || names.memberTokenNames.length === 0 || names.memberTokenNames[0] === "" ||
            !names.partyTokenNames || names.partyTokenNames.length !== 1 || names.partyTokenNames[0] === "") {
            errMsg =
                // Error: invalidTokenCount => Names do not represent exactly ONE group and MORE THAN ONE members.
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "- " + Config.localize(`setting.memberTokenNames${partyNo}.name`) + ": <strong>[ " + names.memberTokenNames + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName${partyNo}.name`) + ": <strong>[ " + names.partyTokenNames + " ]</strong><br/>" +
                "<br/>" +
                "<strong>" + Config.localize(`errMsg.invalidTokenCount`) + "</strong>";
        }

        if (errMsg) {
            throw new Error(errMsg);
        }

        // Check 2: Are there intersecting names between members list and party?
        const membersIncludeParty = names.partyTokenNames.some(element => {
            return names.memberTokenNames.includes(element);
        });
        const partyIncludesMembers = names.memberTokenNames.some(element => {
            return names.partyTokenNames.includes(element);
        });
        if (membersIncludeParty || partyIncludesMembers) {
            errMsg =
                // Error: groupAndMembersIntersect => Names must not exist both as member and as group.
                Config.localize('errMsg.pleaseCheckYourTokenSelection') + ":<br/>" +
                "<br/>" +
                "- " + Config.localize(`setting.memberTokenNames${partyNo}.name`) + ": <strong>[ " + names.memberTokenNames + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName${partyNo}.name`) + ": <strong>[ " + names.partyTokenNames + " ]</strong><br/>" +
                "<br/>" +
                "<strong>" + Config.localize(`errMsg.groupAndMembersIntersect`) + "</strong>";
        }

        if (errMsg) {
            throw new Error(errMsg);
        }

        // Remove duplicates
        names.memberTokenNames = [...new Set(names.memberTokenNames)];
        let partyTokenName = names.partyTokenNames[0]; // there CAN be only one by now, so we can safely reduce it to its first & only member

        // Check 3: Is max number of 25 members per party exceeded?
        // For anyone interested: The max number is a hard limit (thus hard-coded)!
        // It is due to the problem of having to calculate "outward spiraling" spawn positions
        // around the party token on EXPLODE.
        // See #getMovementPathToExplodePosition() for details, if you're really into such brain-busting math stuff - as I am NOT :-D
        if (names.memberTokenNames.length > 25) {
            throw new Error(
                // Error: groupAndMembersIntersect => Names must not exist both as member and as group.
                Config.localize('errMsg.tooManyMemberTokens') + ` (${names.memberTokenNames.length})!<br/>` +
                Config.localize('errMsg.invalidNumberOfMemberTokens') + `<br/>` +
                "<br/>" +
                Config.localize(`setting.memberTokenNames${partyNo}.name`) + ": <strong>[ " + names.memberTokenNames + " ]</strong>"
            );
        }

        // Check 4: Does any of the member tokens exist more than once in the scene?
        // This is only for checking at this time. It will throw an error if some tokens are NOT unique, so we just can ignore the returned values for now
        this.#collectTokensByNamesIfUnique(names.memberTokenNames);
        this.#collectTokensByNamesIfUnique([names.partyTokenName])[0];

        return {
            memberTokenNames: names.memberTokenNames,
            partyTokenName: partyTokenName
        };
    }

    /**
     * Stores token group configurations, passed as parameters, as game settings
     * @param partyNo
     * @param namesAsCommaSeparatedStrings memberTokenNames and partyTokenName values
     */
    static #updateSettings(partyNo, namesAsCommaSeparatedStrings) {
        Config.modifySetting(`memberTokenNames${partyNo}`, namesAsCommaSeparatedStrings.memberTokenNames.join(`, `))
        Config.modifySetting(`partyTokenName${partyNo}`, namesAsCommaSeparatedStrings.partyTokenName)
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
            .map(name => name.toUpperCase())
            .filter(name => !memberTokens
                .map(t => t.name.toUpperCase())
                .includes((name)));
        if (!partyToken) {
            missingTokens.push(names.partyTokenName.toUpperCase());
        }
        if (missingTokens.length > 0) {
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
     * Searches the current scene for all token names given in names, and creates an array from them.
     * Throws an error if multiple tokens with the same name are found.
     * @param names
     * @returns tokensFound {*[]}
     */
    #collectTokensByNamesIfUnique(names) {

        let tokensFound = [];
        let errMsg = "";

        for (let token of canvas.tokens.ownedTokens) {

            Logger.debug(`Checking if scene token is in list: [${token.name}] ...`);

            if (names.includes(token.name.toLowerCase())) {

                // Hurray, we've found a  token from the list!
                if (tokensFound.filter(t => t.name === token.name).length === 0) { // not yet registered
                    tokensFound.push(token);
                    Logger.debug(`Hurray! Found token from the list: [${token.name}]!`);
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

        let noOfMembersVisible = involvedTokens.memberTokens.filter(t => !t.document.hidden);
        let isPartyVisible = (!involvedTokens.partyToken.document.hidden);

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
                "- " + Config.localize(`setting.memberTokenNames${partyNo}.name`) + ": <strong>[ " + Config.setting(`memberTokenNames${partyNo}`) + " ]</strong><br/>" +
                "- " + Config.localize(`setting.partyTokenName${partyNo}.name`) + ": <strong>[ " + Config.setting(`partyTokenName${partyNo}`) + " ]</strong>";
            throw new Error(errMsg);
        }

        return (isPartyVisible) ? PartyCruncher.Actions.EXPLODE : PartyCruncher.Actions.CRUNCH;
    }

    /**
     *
     * @param requiredAction
     * @param involvedTokens@param partyNo
     */
    #getTarget(requiredAction, involvedTokens) {
        if (requiredAction === PartyCruncher.Actions.CRUNCH) {

            if (canvas.tokens.controlled.length === 1 && involvedTokens.memberTokens.includes(canvas.tokens.controlled[0])) {
                // If only one of the members is selected, use it as the target
                // That way the GM can decide where to place the party token
                return canvas.tokens.controlled[0];
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

    /**
     * Do it: Crunch my party NOW!
     * @param involvedTokens
     * @param targetToken - Here this is the one member selected, providing the new position of the party token
     * @param partyNo
     */
    async #crunchParty(involvedTokens, targetToken, partyNo) {

        // Release any currently active tokens
        canvas.tokens.releaseAll();

        // If JB2A_DnD5e is installed, play the animation
        if (optionalDependenciesAvailable.includes('JB2A_DnD5e')) {
            let animationPath = Config.setting('animation4Crunch');
            let audioPath = Config.setting('playAudio4Crunch') ? Config.setting('audioFile4Crunch').trim() : Config.NO_AUDIO_FILE;
            if (animationPath) {
                Logger.debug(`playing CRUNCH animation from JB2A_DnD5e: ${animationPath}`);
                new Sequence()
                    .effect()
                    .file(animationPath)
                    .atLocation(targetToken)
                    .scaleToObject(4)
                    .randomRotation()
                    .sound().file(audioPath)
                    .play();
            }
        }

        // Everybody now, gather at the target!!
        // Note that we're reversing the order temporarily, because this is visually much nicer (especially with large groups).
        // It processes outer tokens first and inner ones last.
        for (const t of involvedTokens.memberTokens.reverse()) {
            // Teleport to the origin - and wait for it to complete before proceeding!
            // Otherwise, our tokens would end up anywhere random on the way!
            this.#teleportToken(t, targetToken.position);
        }

        // Do the same for the party token (still invisible)
        await this.#teleportToken(involvedTokens.partyToken, targetToken.position);

        // Reveal the party token
        involvedTokens.partyToken.document.update({hidden: false});

        // Hide member tokens, and move them once again, this time to a far-away corner of the map
        for (const t of involvedTokens.memberTokens) {
            t.document.update(
                {hidden: true});
            await this.#teleportToken(t, {_x:0, _y:0});
        }
        // Don't forget to set back memberToken order
        involvedTokens.memberTokens.reverse();

        // Set new focus on group token, then we're done here!
        involvedTokens.partyToken.control({releaseOthers: true});
    }

    /**
     *
     * @param involvedTokens
     * @param targetToken - Here this is always the party token itself, providing the anchor point for the member tokens
     * @param partyNo
     */
    async #explodeParty(involvedTokens, targetToken, partyNo) {

        if (!canvas.ready) return false;

        // Force activation of the Token Layer in the UI
        // Otherwise, the moveMany() calls further below won't work
        canvas.tokens.activate();

        const tokenLayer = canvas.activeLayer;
        if (!(tokenLayer instanceof TokenLayer)) return false;

        // Release any currently active tokens
        canvas.tokens.releaseAll();

        // If JB2A_DnD5e is installed, play the animation
        if (optionalDependenciesAvailable.includes('JB2A_DnD5e')) {
            let animationPath = Config.setting('animation4Explode');
            let audioPath = Config.setting('playAudio4Explode') ? Config.setting('audioFile4Explode').trim() : Config.NO_AUDIO_FILE;
            if (animationPath) {
                Logger.debug(`playing EXPLODE animation from JB2A_DnD5e: ${animationPath}`);
                new Sequence()
                    .effect()
                    .file(animationPath)
                    .atLocation(targetToken)
                    .scaleToObject(4)
                    .randomRotation()
                    .sound().file(audioPath)
                    .play();
            }
        }

        // Everybody now, swarm out!!
        let tokenCounter = 0;

        for (const memberToken of involvedTokens.memberTokens) {

            // Teleport to the partyToken's current position (=origin) - and wait for it to complete!
            // Otherwise, our tokens would end up anywhere random on their way!
            await this.#teleportToken(memberToken, targetToken.position);

            // Hide the party token
            involvedTokens.partyToken.document.update({hidden: true});

            // Now show yourself!
            memberToken.document.update({hidden: false});

            // Set selection onto the token.
            // Otherwise, movement by moveMany below won't have any effect
            memberToken.control({releaseOthers: true});

            // Position each token along an "outward spiral" around the origin (which is the party token)
            let movementPath = PartyCruncher.#getMovementPathToExplodePosition(tokenCounter++);
            Logger.debug(`[${memberToken.name}]: movementPath =>`, movementPath);

            // Detect directions of this token's movement
            let xdir = (movementPath.x >= 0) ? 1 : -1;
            let ydir = (movementPath.y >= 0) ? 1 : -1;
            Logger.debug('xdir, ydir', xdir, ydir);

            let safetyCount = 0;

            for (let x = 0; x !== movementPath.x && safetyCount++ < 10; x += xdir) {
                // take one step along movementPath.x
                await this.#pushTokenByOneStep(tokenLayer, xdir, 0, memberToken);
                await Config.sleep(200);
            }
            for (let y = 0; y !== movementPath.y && safetyCount++ < 10; y += ydir) {
                // take one step along movementPath.y
                await this.#pushTokenByOneStep(tokenLayer, 0, ydir, memberToken);
                await Config.sleep(200);
            }
        }

        // Now we need to loop over all members once more to select them all
        // If we had done this within the first loop, together with the moving, the tokens movements
        // would interfere with each others cumulatively.
        for (const memberToken of involvedTokens.memberTokens) {
            memberToken.control({releaseOthers: false});
        }

        // Hide the party token
        involvedTokens.partyToken.document.update({hidden: true});

        // Finally, move the party token to a far-away corner of the map
        await this.#teleportToken(involvedTokens.partyToken, {_x:0, _y:0});
    }

    async #teleportToken(token, targetPosition) {
        return new Promise( resolve => {
            resolve(
                token.document.update(
                {
                    // take your position
                    x: targetPosition._x,
                    y: targetPosition._y
                },
                {
                    // And do NOT animate... AAAAArRGGGH!
                    // Otherwise, tokens will be "floating" across the scene, revealing any hidden secrets ;-)
                    animate: false
                })
            );
        });
    }

    /**
     *
     * @param tokenLayer
     * @param x
     * @param y
     * @param token
     * @returns {Promise<unknown>}
     */
    async #pushTokenByOneStep(tokenLayer, x, y, token) {
        return new Promise( resolve => {
            Logger.debug('tokenLayer, x, y, token.name', tokenLayer, x, y, token.name);
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

    static async #promptForPartyTokenName(partyNo) {
        return new Promise(resolve => {
            const data = {
                title: Config.localize('promptForPartyTokenNameTitle'),
                content: `
                <form>
                  <div>
                    <legend>${Config.localize('promptForPartyTokenNameText')}</legend>
                    <input type='text' name='partyTokenName' value="${(Config.setting(`partyTokenName${partyNo}`))}"/>
                  </div>
                </form>`,
                buttons: {
                    submit: {
                        icon: "<i class='fas fa-check'></i>",
                        label: Config.localize('saveButton'),
                        callback: html => resolve(
                            PartyCruncher.#resolvePromptForPartyTokenName(
                                html[0].querySelector('form')))
                    },
                    cancel: {
                        icon: "<i class='fas fa-cancel'></i>",
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

    static #resolvePromptForPartyTokenName(form) {
        Logger.debug('form', form);
        let result = form.partyTokenName.value.toLowerCase();
        Logger.debug(`partyTokenName from prompt input: ${result}`);
        return result;
    }
}
