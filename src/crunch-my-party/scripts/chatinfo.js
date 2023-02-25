import {Logger} from './logger.js';
import {Config} from './config.js'

export class ChatInfo {
    static contentCardHTML = `
    <div class="div-styled" style= "padding: 5px;">
        <div style="text-align: justify; color: #000000; padding: 10px; background-color: #CCD0CC; border: 2px solid #FFFFFF; border-radius: 15px;">
            <p style="text-align: center;">
                <a href="${Config.data.modlink}">
                    <img src="modules/crunch-my-party/artwork/cmp-logo.png" alt="${Config.data.modTitle} - Logo" style="border:0"/>
                </a>
            </p>
            <hr><div>
                <h2 style="text-align: justify">chatInfoContent.title</h2>
            </div>
            <hr>
            <div>
                <p style="text-align: justify; font-style: italic; font-weight: lighter">chatInfoContent.text1</p>
                <p/>
                <p style="text-align: justify; font-style: normal; font-weight: lighter">chatInfoContent.text2</p>
                <p/>
                <p style="text-align: justify; font-style: normal; font-weight: lighter">chatInfoContent.text3:</p> 
                <p style="text-align: center; font-style: normal; font-weight: lighter"><a href="${Config.data.modlink}">${Config.data.modlink}</a></p>
            </div>
            <hr>
            <div class="div-styled" style="font-style: italic; font-weight: lighter">
                <p style="text-align: justify;">chatInfoContent.footer</p>
            </div>

        </div>
    </div>`;

    static init() {
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
                        user: game.user.id ?? game.user._id,
                        speaker: ChatMessage.getSpeaker(),
                        content: ChatInfo.contentCardHTML
                            .replace('chatInfoContent.title', Config.localize('chatInfoContent.title'))
                            .replace('chatInfoContent.text1', Config.localize('chatInfoContent.text1'))
                            .replace('chatInfoContent.text2', Config.localize('chatInfoContent.text2'))
                            .replace('chatInfoContent.text3', Config.localize('chatInfoContent.text3'))
                            .replace('chatInfoContent.footer', Config.localize('chatInfoContent.footer'))
                        ,
                    }, {});
                    Logger.debug("Chat message created");

                    await Config.modifySetting('hideChatInfo', true);
                }
            }
        })

    }

}
