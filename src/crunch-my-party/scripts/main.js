import {Logger} from './logger.js';
import {Config} from './config.js'
import {ChatInfo} from "./chatinfo.js";

const DEPENDENCIES = {
    MODULE: Config,
    logger: Logger,
    chatinfo: ChatInfo
}

/*
  Global initializer:
  First of all, we need to initialize a lot of stuff in correct order:
 */
(async () => {
        console.log("<module-name> | Initializing Module");

        await allPrerequisitesReady();

        Logger.info("Ready to play!");
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
        });
    });
}

async function initDependencies() {
    Object.values(DEPENDENCIES).forEach(function (cl) {
        cl.init(); // includes loading each module's settings
        Logger.debug("Dependency loaded:", cl.name);
    });
}

/*
Public class for accessing this module through macro code
 */
export class MyModuleMacroAPI {
}
