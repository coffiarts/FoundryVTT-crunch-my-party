import {Logger} from './logger.js';
import {Config} from './config.js'

export class ChatInfo {
    static contentCardHTML = `
    <div class="div-styled" style= "padding: 5px;">
        <div style="color: #000000; padding: 10px; background-color: #CCD0CC; border: 2px solid #FFFFFF; border-radius: 15px;">
            <p style="text-align: center;">
                <a href="${Config.globals.modlink}">
                    <img src="modules/${Config.globals.modID}/artwork/${Config.globals.modID}-logo.png" alt="${Config.globals.modTitle} - Logo" style="border:0"/>
                </a>
                <br/>
                Version: chatInfoContent.version [<a href="modules/${Config.globals.modID}/CHANGELOG.MD/">Changelog</a>]
            </p>
            <hr><div>
                <h2 style="text-align: center">chatInfoContent.title</h2>
            </div>
            <hr>
            <div>
                <p style="font-style: italic; font-weight: lighter">chatInfoContent.text1</p>
                <p/>
                <p style="font-style: normal; font-weight: lighter">chatInfoContent.text2</p>
                <p/>
                <p style="font-style: normal; font-weight: lighter">chatInfoContent.text3:</p> 
                <p style="text-align: center; font-style: normal; font-weight: lighter"><a href="${Config.globals.modlink}">${Config.globals.modlink}</a></p>
            </div>
            <hr>
            <div class="div-styled" style="font-style: italic; font-weight: lighter">
                <p>chatInfoContent.footer</p>
            </div>

        </div>
    </div>`;

    static init() {
        // create separator and title at the beginning of this settings section
        Hooks.on('renderSettingsConfig', (app, html) => {
            const inputEl = html.querySelector(`#settings-config-${Config.globals.modID.replace(/\./g, "\\.")}\\.hideChatInfo`);
            const formGroup = inputEl?.closest(".form-group");
            formGroup?.insertAdjacentHTML("beforebegin", `<div><h4 style="margin-top: 0; border-bottom: 1px solid #888; padding-bottom: 4px; margin-bottom: 6px;">Chat Info</h4></div>`);
        });

        // Register game settings relevant to this class specifically (all globally relevant settings are maintained by class Config)
        const settingsData = {
            hideChatInfo: {
                scope: 'world', config: true, type: Boolean, default: false,
            }
        };
        Config.registerSettings(settingsData);

        Hooks.once('ready', async function () {
            if (game.user.isGM) {
                if (Config.setting('hideChatInfo') === false) {
                    // Create Chat Message
                    await ChatMessage.create({
                        whisper:ChatMessage.getWhisperRecipients("GM"),
                        user: game.user.id ?? game.user._id,
                        speaker: ChatMessage.getSpeaker({alias: Config.globals.modTitle}),
                        content: ChatInfo.contentCardHTML
                            .replace('chatInfoContent.title', Config.localize('chatInfoContent.title'))
                            .replace('chatInfoContent.text1', Config.localize('chatInfoContent.text1'))
                            .replace('chatInfoContent.text2', Config.localize('chatInfoContent.text2'))
                            .replace('chatInfoContent.text3', Config.localize('chatInfoContent.text3'))
                            .replace('chatInfoContent.footer', Config.localize('chatInfoContent.footer'))
                            .replace('chatInfoContent.version', Config.setting('modVersion'))
                        ,
                    }, {});
                    Logger.debug("(ChatInfo.init) Chat message created");

                    await Config.modifySetting('hideChatInfo', true);
                }
            }
        })

    }

}
