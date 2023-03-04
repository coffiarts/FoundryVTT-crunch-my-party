# Crunch My Party! for Foundry VTT
<table style="border:0">
  <tr>
    <td><img src="src/crunch-my-party/artwork/cmp-logo.png" alt="Hot Pan & Zoom! Logo"/></td>
    <td>
        <p style="color:#da6502">
          *The* perfect utility for the game master handling multiple tokens as one party. Easily collapse arbitrary groups of scene tokens (representing parties) into an easy-to-use single "party token", and vice versa. Manage up to 5 separate parties with up to 25 members each!
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
[Crunch My Party! - Video Demo](https://youtu.be/ix66vZ8A0OI)

[<img src="src/crunch-my-party/artwork/cmp-video-thumb.png" alt="crunch-my-party - Video demo on youtube" width="600"/>](https://youtu.be/ix66vZ8A0OI)

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
*The* perfect utility for the game master handling multiple tokens as one party.

Are you a game master who frequently needs to control a whole bunch of scene actors at once?
- Maybe you like remote controlling your players' tokens while they're travelling through a dungeon in between encounters?
- Or you need to handle larger groups of foes?

Then you might know the tediousness of having to micromanage all those tokens... aaaargh! It simply ends up in stressful slapstick, breaking your game flow.

This module of mine is meant as a comfortable solution to it:
Easily collapse arbitrary groups of scene tokens (representing parties) into an easy-to-use single "party token", and vice versa. Manage up to 5 separate parties with up to 25 members each!

## So how does it work ...
At first, before experimenting by yourself, please have a look at the [Video demo on youtube](https://youtu.be/ix66vZ8A0OI)

The main steps, briefly explained:

### GROUP - Define a new party
1. Create a custom token representing your party in "crunched" state
2. Add that party token to the scene and disable it (remember its name in correct spelling)
3. Select any tokens in the scene that should join your party
4. Run the related "Group Party #x" macro (see section [Control it by macro!](#control-it-by-macro-)
5. Enter the name of the party token from step 1.

=> You're done. Your party is defined! HURRAY!!

### TOGGLE - Collapse (crunch) and disassemble (explode) a party
1. Run the related "Toggle Party #x" macro (see section [Control it by macro!](#control-it-by-macro-)

=> That's it. Your party should automatically switch between "crunched" and "exploded" state.

### FIND - Jump to an already defined party in the scene
1. Run the related "Find Party #x" macro (see section [Control it by macro!](#control-it-by-macro-)

=> That's it. Your canvas view moves automatically to the scene location of that party and automatically selects its tokens (be it in crunched or exploded state).

Note what it does in the background:

- On "Crunch", all member tokens are automatically disabled and moved (invisibly) to the top left corner of the scene. Instead, the "party token" is retrieved from there, moved to the current position and rendered visible.
- On "Explode", vice versa, the party token is automatically disabled and moved (invisibly) to the top left corner of the scene. Accordingly, the "member tokens" are retrieved from there, moved to the current position and rendered visible.

Easy, isn't it?

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
        <td>Pre-Release 1.1.0</td>
        <td>2023-03-05</td>
        <td>
            <b>First official release - Going out into the world!</b>
        </td>
    </tr>
</table>

<!--details><summary>Click to see older versions</summary>
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
</details-->

## Recommended modules in combination with this one
- [Hot Pan & Zoom!](https://github.com/coffiarts/FoundryVTT-hot-pan) by coffiarts: Keeps your players' canvas position and zoom in sync with your GM screen, especially useful when toggling and finding groups 
- [Jules&Ben's Animated Assets (JB2A)](https://github.com/Jules-Bens-Aa/JB2A_DnD5e) by Jules & Ben: Allows autoplaying of animations on toggling

Presence of these modules is optional! If installed, ***Crunch my Party!*** will automatically detect and handle them. Just lean back and enjoy.

## Adjustable module settings (i.e. game settings)

<img src="src/crunch-my-party/artwork/cmp-settings.png" alt="crunch-my-party settings"/>

## Control it by macro!
Use the exposed `class PartyCruncher` - just like this, it's a no-brainer:

    PartyCruncher.group(<partyNumber); // Assigns the selected list of tokens to another party tokens identified by a name you type in
    PartyCruncher.toogle(<partyNumber); // toggles the specified party between a single "party token" (crunched) and separate "member tokens" (explode)
    PartyCruncher.find(<partyNumber); // autoselect the specified party in the scene, moving focus and canvas you to it

The module comes already bundled with a predefined set of 5 macros per action (for up to 5 configurable parties of tokens), recognizeable by there icons:
<p>
<img src="src/crunch-my-party/artwork/cmp-macro-toggle-1.png" alt="Macro: Toggle Party #1" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-toggle-2.png" alt="Macro: Toggle Party #2" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-toggle-3.png" alt="Macro: Toggle Party #3" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-toggle-4.png" alt="Macro: Toggle Party #4" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-toggle-5.png" alt="Macro: Toggle Party #5" width="100"/>
</p>
<p>
<img src="src/crunch-my-party/artwork/cmp-macro-group-1.png" alt="Macro: Group Party #1" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-group-2.png" alt="Macro: Group Party #2" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-group-3.png" alt="Macro: Group Party #3" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-group-4.png" alt="Macro: Group Party #4" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-group-5.png" alt="Macro: Group Party #5" width="100"/>
</p>
<p>
<img src="src/crunch-my-party/artwork/cmp-macro-find-1.png" alt="Macro: Find Party #1" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-find-2.png" alt="Macro: Find Party #2" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-find-3.png" alt="Macro: Find Party #3" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-find-4.png" alt="Macro: Find Party #4" width="100"/>
<img src="src/crunch-my-party/artwork/cmp-macro-find-5.png" alt="Macro: Find Party #5" width="100"/>
</p>


## Compatibility and Dependencies
- Tested with Foundry VTT 10 in world system "dsa5" / "tde5" (The Dark Eye). But I consider it system-agnostic.
- No hard dependencies, but some warmly recommended *optional* 3rd-party modules are listed further above (see there to understand why I recommend them).

## Upcoming features
Things I am *considering* to do in the future (given proper demand for it - feedback welcome!):

- `small`: support commas in token names (i.e. making the delimiter character configurable via user prefs)
- `small` to `?`: find a robust solution for the token movement on EXPLODE, which is currently still potentially unreliable (tokens stacking onto each other erratically). If you're eager to contribute, feel free to have a look at the related [discord discussion](https://discord.com/channels/170995199584108546/722559135371231352/1080590427012485211).   

Feel free to follow the ["dev" branch on GitHub](https://github.com/coffiarts/FoundryVTT-crunch-my-party/tree/dev) to stay tuned: [https://github.com/coffiarts/FoundryVTT-crunch-my-party/tree/dev](https://github.com/coffiarts/FoundryVTT-crunch-my-party/tree/dev)

## Credits
- [Jules & Ben](https://www.patreon.com/JB2A) for their magnificient [Animated Assets](https://github.com/Jules-Bens-Aa/JB2A_DnD5e) module (see [Recommended modules](#recommended-modules-in-combination-with-this-one))
- [Navadaux](https://freesound.org/people/Navadaux/) for the "explode" sound provided via [freesound.org](https://freesound.org/people/Navadaux/sounds/547172/), released under [CCO 1.0 license](http://creativecommons.org/publicdomain/zero/1.0/) 
- [Glaneur de sons](https://freesound.org/people/Glaneur%20de%20sons/) for the "crunch" sound provided via [freesound.org](https://freesound.org/people/Glaneur%20de%20sons/sounds/420616/), released under [CC BY 3.0 license](https://creativecommons.org/licenses/by/3.0/)
- Video background music: ***"Marty Gots a Plan"***, ***"Circus of Freaks"*** and ***"Sneaky Snitch"*** by the incredible, unbelievable, most-famous, soo-much-beloved [Kevin MacLeod (incompetech.com)](https://incompetech.com/music/royalty-free/music.html), released under [CC BY 4.0 License](http://creativecommons.org/licenses/by/4.0/)
