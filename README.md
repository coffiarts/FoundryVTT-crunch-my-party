# Crunch My Party! for Foundry VTT
<table style="border:0">
  <tr>
    <td><img src="src/crunch-my-party/artwork/cmp-logo.png" alt="Hot Pan & Zoom! Logo"/></td>
    <td>
        <p style="color:red"><strong>This is still an absolute alpha development - handle with care!</strong></p>
        <p style="color:#da6502">
          Easily collapse arbitrary groups of scene tokens (representing parties) into an easy-to-use single "party token", and vice versa. Manage up to 5 separate parties with up to 25 members each!
        </p>
        <p style="font-style: italic; font-weight: bold">
          "Once there were three little goblins ...<br/>
            ... eager to form a PARTY!<br/>
            So here's their story."
    </p>
    </td>
  </tr>
</table>

## Video demo on youtube
[crunch-my-party Demo](https://youtu.be/crunch-my-party)

[<img src="src/crunch-my-party/artwork/cmp-video-thumb.png" alt="crunch-my-party - Video demo on youtube" width="600"/>](https://youtu.be/crunch-my-party)

- [What does it do ...](#what-does-it-do-)
- [Known restrictions](#known-restrictions)
- [Changelog](#changelog)
- [Recommended modules in combination with this one](#recommended-modules-in-combination-with-this-one)
- [Adjustable module settings (i.e. game settings)](#adjustable-module-settings--ie-game-settings-)
- [Control it by macro!](#control-it-by-macro-)
- [Compatibility and Dependencies](#compatibility-and-dependencies)
- [Upcoming features](#upcoming-features)
- [Credits](#credits)

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>

## What does it do ...
[TODO]

## Known restrictions
- Token names may not (currently) have ***commas*** (comma is used as delimiter for the token names list stored in user prefs). If many people should comply about it, I'll try to make the delimiter char configurable (see [Upcoming features](#upcoming-features))
- Always wait for any crunch/explode actions to finish, before selecting and/or moving any other tokens in the scene. If you do so, it's probably not a big issue, but it could lead to unexpected interference among token's movement and position.
- The "EXPLODE" animation of large groups appears somewhat slow. That is known and by design. I had to build in a 200 msec timeout between every two tokens, to improve stability (no better solution found yet).

## Changelog
<table style="border:0">
    <tr>
        <th colspan="3" style="text-align: left">Latest Version</th>
    </tr>
    <tr>
        <td>xxx</td>
        <td>YYYY-MM-DD</td>
        <td>
            <ul>
                <li><b>Change topic:</b><br/>
                    Description</li>
            </ul>
        </td>
    </tr>
</table>

<details><summary>Click to see older versions</summary>
<table>
    <tr>
        <th>Release</th>
        <th>Date</th>
        <th>Changes</th>
    </tr>
    <tr>
        <td>xyz</td>
        <td>YYYY-MM-DD</td>
        <td>Description</td>
    </tr>
</table>
</details>

## Recommended modules in combination with this one
- [Hot Pan & Zoom!](https://github.com/coffiarts/FoundryVTT-hot-pan) by coffiarts: Keeps your players' canvas position and zoom in sync with your GM screen, especially usefull when toggling and finding groups 
- [Jules&Ben's Animated Assets (JB2A)](https://github.com/Jules-Bens-Aa/JB2A_DnD5e) by Jules & Ben: Allows autoplaying of animations on toggling

Presence of these modules is optional! If installed, ***Crunch my Party!*** will automatically detect and handle them. Just lean back and enjoy.

## Adjustable module settings (i.e. game settings)
This screenshot shows the default values.

<img src="src/crunch-my-party/artwork/cmp-settings.png" alt="crunch-my-party settings"/>

## Control it by macro!
Use the exposed `class MyModuleMacroAPI` - just like this, it's a no-brainer:

<img src="src/crunch-my-party/artwork/cmp-macro-toggle.png" alt="crunch-my-party macro example"/>

Some more variants:

    // Toggle specifically on and off (pretty obvious)
    MyModuleMacroAPI.someFunction();

## Compatibility and Dependencies
- Tested with Foundry VTT 10 in world system "dsa5" / "tde5" (The Dark Eye). But I consider it system-agnostic.
- No hard dependencies, but some warmly recommended **optional* 3rd-party modules are listed further above (see there to understand why I recommend them).

## Upcoming features
Things I am **considering** to do in the future (given proper demand for it - feedback welcome!):

- `small`: support commas in token names (by making the delimiter character configurable via user prefs)
- `small` to `?`: find a robust solution for the token movement on EXPLODE, which is currently still potentially unreliable (stacking tokens onto each other erratically). If you're eager to contribute, feel free to have a look at the related [discord discussion](https://discord.com/channels/170995199584108546/722559135371231352/1080590427012485211).   

Feel free to follow the ["dev" branch on GitHub](https://github.com/coffiarts/FoundryVTT-crunch-my-party/tree/dev) to stay tuned: [https://github.com/coffiarts/FoundryVTT-crunch-my-party/tree/dev](https://github.com/coffiarts/FoundryVTT-crunch-my-party/tree/dev)

## Credits
- [Jules & Ben](https://www.patreon.com/JB2A) for their magnificient [Animated Assets](https://github.com/Jules-Bens-Aa/JB2A_DnD5e) module (see [Recommended modules](#recommended-modules-in-combination-with-this-one))
- [Navadaux](https://freesound.org/people/Navadaux/) for the "explode" sound provided on [freesound.org](https://freesound.org/people/Navadaux/sounds/547172/), licensed under [CCO 1.0 license](http://creativecommons.org/publicdomain/zero/1.0/) 
- [Glaneur de sons](https://freesound.org/people/Glaneur%20de%20sons/) for the "crunch" sound providedon [freesound.org](https://freesound.org/people/Glaneur%20de%20sons/sounds/420616/), licensed under [CC BY 3.0 license](https://creativecommons.org/licenses/by/3.0/)
- Video background music: ***"Marty Gots a Plan"*** by the incredible, unbelievable, most-famous, soo-much-beloved [Kevin MacLeod (incompetech.com)](https://incompetech.com/music/royalty-free/music.html)
  Licensed under [CC BY 4.0 License](http://creativecommons.org/licenses/by/4.0/)
