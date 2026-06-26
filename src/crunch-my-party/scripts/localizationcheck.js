import {Logger} from './logger.js';
import {Config} from './config.js';

export class LocalizationCheck {

    static init() {
        window.LocalizationCheck = LocalizationCheck;
    }

    static check(lang) {
        const filePath = `${Config.globals.langPath}/${lang}.json`;
        Logger.debug(this.check.name, `Checking localization from '${filePath}'`);
        this.#readTextFile(
            filePath,
            this.#parseLocalizaton);
    }

    static #readTextFile(file, callback) {
        var rawFile = new XMLHttpRequest();
        rawFile.overrideMimeType("application/json");
        rawFile.open("GET", file, true);
        rawFile.onreadystatechange = function() {
            if (rawFile.readyState === 4 && rawFile.status === 200) {
                callback(rawFile.responseText);
            }
        }
        rawFile.send(null);
    }

    static #parseLocalizaton(text) {
        var langObj = JSON.parse(text);
        Logger.debug(LocalizationCheck.#parseLocalizaton.name, `lang infos read (langFileObj['${Config.globals.modID}']):`, langObj[Config.globals.modID]);
        let results = [];
        results = LocalizationCheck.#iterate(langObj[Config.globals.modID], results);
        results.sort((a, b) => a.localeCompare(b));
        Logger.debug(LocalizationCheck.#parseLocalizaton.name, "\n"+results.join("\n"));
    }

    static #iterate(langObj, results, path = "") {
        for (const nodeName in langObj) {
            if (nodeName === "setting") {
                continue;
            }
            if (typeof langObj[nodeName] === "object") {
                results = LocalizationCheck.#iterate(langObj[nodeName], results, nodeName + ".");
            }
            results.push(`["'\\\`]${path + nodeName}["'\\\`]`);
        }
        return results;
    }
}