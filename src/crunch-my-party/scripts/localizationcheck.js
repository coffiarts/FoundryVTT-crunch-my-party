import {Logger} from './logger.js';
import {Config} from './config.js';

export class LocalizationCheck {

    static init() {
        window.LocalizationCheck = LocalizationCheck;
    }

    static #compareKeys1 = [];
    static #compareKeys2 = [];
    static #comparisonCounter = 0;
    static #comparisonLanguages = []
    static fileError;

    static run(lang1 = "en", lang2 = "de") {
        const filePath1 = `${Config.globals.langPath}/${lang1}.json`;
        const filePath2 = `${Config.globals.langPath}/${lang2}.json`;
        Logger.debug(this.#listKeys.name, `Comparing localizations from '${filePath1}' and ${filePath2}`);
        this.#reset(lang1, lang2);
        this.#readTextFile(
            lang1,
            filePath1,
            this.#parseLocalizaton,
            this.#compareKeys1);
        this.#readTextFile(
            lang2,
            filePath2,
            this.#parseLocalizaton,
            this.#compareKeys2);
    }

    static #reset(lang1, lang2) {
        this.#comparisonLanguages = [lang1, lang2];
        this.fileError = undefined;
    }

    static #listKeys(lang = "en") {
        const filePath = `${Config.globals.langPath}/${lang}.json`;
        Logger.debug(this.#listKeys.name, `Checking localization from '${filePath}'`);
        this.#readTextFile(
            lang,
            filePath,
            this.#parseLocalizaton);
    }

    static #readTextFile(lang, file, callback, outArray = []) {
        try {
            var rawFile = new XMLHttpRequest();
            rawFile.overrideMimeType("application/json");
            rawFile.open("GET", file, true);
            rawFile.onreadystatechange = function () {
                if (rawFile.readyState === 4 && rawFile.status === 200) {
                    callback(rawFile.responseText, lang, outArray);
                }
            }
            rawFile.send(null);
        } catch (e) {
            LocalizationCheck.fileError = e.message;
            Logger.error(LocalizationCheck.#parseLocalizaton.name, false, LocalizationCheck.fileError);
        }
    }

    static #parseLocalizaton(text, lang, outArray = []) {
        if (LocalizationCheck.fileError) {
            return;
        }
        var langObj = JSON.parse(text);
        // Logger.debug(LocalizationCheck.#parseLocalizaton.name, `lang infos read (langFileObj['${Config.globals.modID}']):`, langObj[Config.globals.modID]);
        outArray = LocalizationCheck.#iterate(langObj[Config.globals.modID], outArray);
        outArray.sort((a, b) => a.localeCompare(b));
        Logger.info(`Keys from ${lang.toUpperCase()}: To identify unused keys, run a code search for the following RegExp:\n["'\\\`]${outArray.join("[\"'\\\`]\n[\"'\\\`]")}["'\\\`]`);
        LocalizationCheck.#evaluateComparison();

    }

    static #evaluateComparison() {
        if (LocalizationCheck.fileError) {
            return;
        }
        if (++this.#comparisonCounter < 2) return; // wait for both sides to complete
        const missingInLang1 = this.#compareKeys2.filter(k => this.#compareKeys1.indexOf(k) === -1);
        const missingInLang2 = this.#compareKeys1.filter(k => this.#compareKeys2.indexOf(k) === -1);
        if (missingInLang1.length === 0 && missingInLang2.length === 0) {
            Logger.infoGreen(`CONGRATULATIONS - Keys for '${this.#comparisonLanguages[0].toUpperCase()}' and '${this.#comparisonLanguages[1].toUpperCase()}' are identical!`);
            return;
        } else if (missingInLang2.length > 0) {
            Logger.error(LocalizationCheck.#evaluateComparison.name, false,
                `MISMATCH FOUND: Keys from '${this.#comparisonLanguages[0].toUpperCase()}' missing in '${this.#comparisonLanguages[1].toUpperCase()}'\n`, missingInLang2.join("\n"));
        }
        if (missingInLang1.length > 0) {
            Logger.error(LocalizationCheck.#evaluateComparison.name, false,
                `MISMATCH FOUND: Keys from '${this.#comparisonLanguages[1].toUpperCase()}' missing in '${this.#comparisonLanguages[0].toUpperCase()}'\n`, missingInLang1.join("\n"));
        }
    }

    static #iterate(langObj, results, path = "") {
        for (const nodeName in langObj) {
            if (nodeName === "setting") {
                continue;
            }
            if (typeof langObj[nodeName] === "object") {
                results = LocalizationCheck.#iterate(langObj[nodeName], results, nodeName + ".");
            }
            results.push(`${path + nodeName}`);
        }
        return results;
    }
}