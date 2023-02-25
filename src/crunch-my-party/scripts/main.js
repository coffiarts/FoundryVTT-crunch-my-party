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
        alert(`Module '${Config.data.modTitle}' says: '${ready2play ? `I am alive!` : `I am NOT ready - something went wrong:(`}'` );
    }

    static Actions = Object.freeze({
        CRUNCH: Symbol("CRUNCH"),
        EXPLODE: Symbol("EXPLODE")
    });

    /**
     * Public method for usage in macros: Toggle existing party between CRUNCH and EXPLODE
     * @param partyNo
     */
    static toggleParty(partyNo) {
        if (!partyNo)
            partyNo = this.#promptForPartyNo('groupTokens');

        Logger.info(`Toggling party #${partyNo} ...`);

        try {

            // ==================================================================================================
            // Step 1 - Parse & validate party definitions from module settings
            // ==================================================================================================
            let namesFromSettings = this.#collectNamesFromSettings(partyNo);
            Logger.debug(namesFromSettings);

            // ==================================================================================================
            // Step 2 - Update user prefs in module settings with the now cleaned lists
            // ==================================================================================================
            Config.modifySetting(`memberTokenNames${partyNo}`, namesFromSettings.memberTokenNames.join(`, `))
            Config.modifySetting(`partyTokenName${partyNo}`, namesFromSettings.partyTokenName)

            // ==================================================================================================
            // Step 3 - gather and validate all the involved tokens from current scene
            // ==================================================================================================
            let involvedTokens = this.#collectInvolvedTokens(namesFromSettings, partyNo);
            Logger.debug(involvedTokens);

            // ==================================================================================================
            // Step 4 - auto-determine the required action (CRUNCH or EXPLODE?)
            // ==================================================================================================
            let requiredAction = this.#determineRequiredAction(involvedTokens, partyNo);
            Logger.debug(`required action: ${requiredAction.toString()}`);

            // ==================================================================================================
            // Step 5 - auto-determine target token (depending on requiredAction), and focus it
            // ==================================================================================================
            let targetToken = this.#getTarget(requiredAction, involvedTokens, partyNo);
            Logger.debug(`target token: [${targetToken.name}]`);
            canvas.tokens.releaseAll();
            if (optionalDependenciesAvailable.includes('hot-pan')) {
                HotPan.switchOn(true); // true means: silentMode (no UI message)
            }
            targetToken.control({releaseOthers: true})
            canvas.animatePan(targetToken.getCenter(targetToken.x, targetToken.y));
            if (optionalDependenciesAvailable.includes('hot-pan')) {
                setTimeout(function(){
                    HotPan.switchBack(true); // true means: silentMode (no UI message)
                }, 1000);
            }

            // ==================================================================================================
            // Step 6 - And finallyyyyyyy.... just DO IT!!
            // ==================================================================================================
            switch (requiredAction) {
                case this.Actions.CRUNCH:
                    Logger.info(`Crunching party ${partyNo} ...`);
                    this.#crunchParty(involvedTokens, targetToken, partyNo);
                    break;
                case this.Actions.EXPLODE:
                    Logger.info(`Exploding party ${partyNo} ...`);
                    this.#explodeParty(involvedTokens, targetToken, partyNo);
            }

        } catch (e) {
            Logger.error(false, e); // This will also print an error msg to the screen
            return;
        }

        Logger.info(`... Toggling of party #${partyNo} complete.`);
    }

    /**
     * Public method for usage in macros: Assign selected scene tokens to a party
     * @param partyNo
     */
    static groupParty(partyNo) {
        // TODO
        if (!partyNo)
            partyNo = this.#promptForPartyNo('groupTokens');
        Logger.debug(`partyNo: ${partyNo}`);
    }

    /**
     * Public method for usage in macros: Select all member tokens of a given party in the scene
     * @param partyNo
     */
    static findParty(partyNo) {
        // TODO
        if (!partyNo)
            partyNo = this.#promptForPartyNo('groupTokens');

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

        // Check 3: Is max number of 25 members per party exceeded?
        // For anyone interested: The max number is a hard limit (thus hard-coded)!
        // It is due to the problem of having to calculate "outward spiraling" spawn positions
        // around the party token on EXPLODE.
        // See #calculateClockwiseSpiralingGridCellOffset() for details, if you're really into such brain-busting math stuff - as I am NOT :-D
        if (memberTokenNames.length > 25) {
            throw new Error(
                // Error: groupAndMembersIntersect => Names must not exist both as member and as group.
                Config.localize('errMsg.tooManyMemberTokens') + ` (${memberTokenNames.length})!<br/>` +
                Config.localize('errMsg.maxNumberOfMemberTokens') + `<br/>` +
                "<br/>" +
                Config.localize(`setting.memberTokenNames${partyNo}.name`) + ": <strong>[ " + memberTokenNamesSetting + " ]</strong>"
            );
        }

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

        return (isPartyVisible) ? this.Actions.EXPLODE : this.Actions.CRUNCH;
    }

    /**
     *
     * @param requiredAction
     * @param involvedTokens@param partyNo
     */
    static #getTarget(requiredAction, involvedTokens) {
        if (requiredAction === this.Actions.CRUNCH) {

            // Release any currently active tokens
            canvas.tokens.releaseAll();

            // select all the member tokens, and use the first one as the target
            involvedTokens.memberTokens.forEach(t => t.control({ releaseOthers: false }));
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
    static #crunchParty(involvedTokens, targetToken, partyNo) {

        // Everybody now, gather at the target!!
        involvedTokens.memberTokens
            .forEach(function(t) {
                t.document.update({ x: targetToken.document.x, y: targetToken.document.y },{animate: false}); // {animate: false} is the key to preventing tokens to "float" across the scene, revealing any hidden secrets ;-)
            });

        // Do the same for the party token
        involvedTokens.partyToken.document.update({ x: targetToken.document.x, y: targetToken.document.y },{animate: false});

        // Show party token
        involvedTokens.partyToken.document.update({hidden: false});

        // Hide member tokens, and move them to a far-away corner of the map
        involvedTokens.memberTokens
            .forEach(function(t) {
                t.document.update(
                        { hidden: true });
                t.document.update(
                        { x: 0, y: 0 },
                        { animate: false });
            });

        // Set new focus on group token, then we're done here!
        involvedTokens.partyToken.control({ releaseOthers: true });
    }

    /**
     *
     * @param involvedTokens
     * @param targetToken - Here this is always the party token itself, providing the anchor point for the member tokens
     * @param partyNo
     */
    static #explodeParty(involvedTokens, targetToken, partyNo) {

        // Release any currently active tokens
        canvas.tokens.releaseAll();

        // Everybody now, swarm out!!
        let counter = 0;
        involvedTokens.memberTokens
            .forEach(function(t) {
                // position each token in an outward spiral around the origin (which is the party token)
                let gridCellOffset = PartyCruncher.#calculateClockwiseSpiralingGridCellOffset(counter++);
                Logger.debug(`[${t.name}]: gridCellOffset => ${gridCellOffset.x}, ${gridCellOffset.y}`);
                let nextposition = {
                    x: targetToken.document.x + gridCellOffset.x * canvas.grid.size,
                    y: targetToken.document.y + gridCellOffset.y * canvas.grid.size
                }
                Logger.debug(`[${t.name}]: gridCellOffset => ${nextposition.x}, ${nextposition.y}`);
                t.document.update(
                        {
                            // take your position
                            x: nextposition.x,
                            y: nextposition.y
                        },
                        {
                            // And do NOT animate... AAAAArRGGGH!
                            // Otherwise, tokens will be "floating" across the scene, revealing any hidden secrets ;-)
                            animate: false
                        });
                t.document.update(
                        {
                            // show youselves
                            hidden: false
                        });

                // select every member
                t.control({ releaseOthers: false });
            });

        // Hide the party token and move it to a far-away corner of the map
        involvedTokens.partyToken.document.update(
            { hidden: true } );
        involvedTokens.partyToken.document.update(
            { x: 0, y: 0 },
            { animate: false });
    }

    /**
     * Calculates clockwise "outwads-spiraling" offsets in grid cell coordinates, relative to a given origin in the center (0, 0).
     * Normally, we'd need some brains here (for a change). Reals experts (which I am NOT one of them), would do
     * this with fancy "spiraling matrix maths", like this crazy stuff here:
     * https://stackoverflow.com/questions/3706219/algorithm-for-iterating-over-an-outward-spiral-on-a-discrete-2d-grid-from-the-or
     * As I just don't get that (and as I am tooo lazy anyway).
     * In addition, I don't want a real spiral, bit rather a custom pattern.
     * So I'll just do it the hard-coded way, fixing the maximum of 25 positions available in hard-coded arrays! :)
     * @param counter
     */
    static #calculateClockwiseSpiralingGridCellOffset(counter) {
        let xOffsets =
            [
                0, // this is the origin
                0, 1, 0, -1, 1, 1, -1, -1, // this is the inner "ring" of 8 positions
                -1, 0, 1, 2, 2, 2, 2, 2, 1, 0, -1, -2, -2, -2, -2, -2 // the outer "ring" with additional 16 positions
            ];
        let yOffsets =
            [
                0, // this is the origin
                -1, 0, 1, 0, -1, 1, 1, -1,  // this is the inner "ring" of 8 positions
                -2, -2, -2, -2, -1, 0, 1, 2, 2, 2, 2, 2, 1, 0, -1, -2 // the outer "ring" with additional 16 positions
            ];

        return {
            x: xOffsets[counter],
            y: yOffsets[counter]
        }
    }

    static #promptForPartyNo() {
        return new Dialog({
            // TODO localize
            title: 'Which party do you want to assign?',
            content: `
                <form>
                  <div class="form-group">
                    <label>Input text</label>
                    <input type='text' name='partyNo'/>
                  </div>
                </form>`,
            buttons: {
                yes: {
                    icon: "<i class='fas fa-check'></i>",
                    label: `OK`
                }
            },
            default: 'yes',
            close: html => {
                let result = html.find('input[name=\'inputField\']');
                if (result.val() !== '') {
                    let chatData = {
                        user: game.user._id,
                        speaker: ChatMessage.getSpeaker(),
                        content: result.val()
                    };
                    ChatMessage.create(chatData, {});
                }
            }
        }).render(true);
    }
}
