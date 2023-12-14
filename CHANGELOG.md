## 11.0.4
### 2023-??-?? - ???
- ???

## 11.0.3
### 2023-07-16 - Add missing (only recommended) dependency (Sequencer)
- If people are using my mod (as STRONGLY recommended) in combination with JB2A [Animated Assets](https://github.com/Jules-Bens-Aa/JB2A_DnD5e) and [Automated Animations](https://github.com/otigon/automated-jb2a-animations), then this won't work unless they're also using [Sequencer](https://github.com/fantasycalendar/FoundryVTT-Sequencer) by [fantasycalendar](https://github.com/fantasycalendar). Otherwise, my mod can't make use of the animations. Those three are commonly used together, but it may not be self-explaining.
  So even I (dull as I am) simply forgot to mention this in earlier versions. I added that missing recommended dependency now.
- Declared end of Foundry v10 backward-compatibility

## 11.0.2
### 2023-06-27 - Changelog & Readme optimization for Module Management+
- Refactored documentation so that it can be properly displayed & linked in-game by [Module Management+](https://github.com/mouse0270/module-credits),<br/>
  which is a veeeery helpful mod that I waaaaarmly recommend!


## 11.0.1
### 2023-06-05 - Compatibility info simplified
- Reduced verified compatibility to main version (11) of FoundryVTT (instead of specific patch version)<br/>
  This gets rid of unnecessary "incompatibility risk" flags with every new patch version.


## 11.0.0
### 2023-05-28 - Foundry 11 compatibility release
- Actually, nothing has changed, technically. It had already been compatible, and it is still backward-compatible with v10.<br/>
  <span style="color:green">
  From now on, major versions will always reflect the corresponding Foundry VTT major version<br/>
  (i.e. mod version 11.x.x => compatible with Foundry v11, and so on)
  </span><br/>
  Strictly speaking, this mod has already been compatible with v11 (and it is still backward-compatible with v10!), but I detected and fixed some weak points on the go:<br/>
  <li>
  <b>Bugfix: Improved handling of sound and animations and related mod dependencies</b><br/>
  For (optional) usage of animations, it doesn't suffice to use JB2A, but you also need to have the Automated Animations mod (see description further below).<br/>
  </li>
  <li>
  <b>Bugfix: Audio will now also play when JB2A and Automated Animations are <i>not</i> installed.</b><br/>
  For (optional) usage of animations, it doesn't suffice to use JB2A, but you also need to have the Automated Animations mod (see description further below).<br/>
  </li>
  <li>Various minor readme corrections</li>


## 1.1.0
### 2023-03-05 - First official release - Going out into the world!