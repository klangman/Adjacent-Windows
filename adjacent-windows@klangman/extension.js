/*
 * extension.js
 * Copyright (C) 2024 Kevin Langman <klangman@gmail.com>
 *
 * Adjacent-Windows is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adjacent-Windows is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

const Settings = imports.ui.settings;
const SignalManager = imports.misc.signalManager;
const Main = imports.ui.main;
const Lang = imports.lang;

const Direction = {
  Left: 0,
  Right: 1,
  Up: 2,
  Down: 3
}

const Activate = {
   HighestZ: 0,
   Closest: 1
}

function isAbove(a, b) {
   // user_time is the last time the window was interacted with, so the window with the greater user_time is closer to the forground
   if (a.user_time > b.user_time) return true;
   return false;
}

class AdjacentWindows {
   constructor(metaData){
      this.meta = metaData;
   }

   enable() {
      this.settings = new Settings.ExtensionSettings(this, this.meta.uuid);
      this.signalManager = new SignalManager.SignalManager(null);
      this.signalManager.connect(this.settings, "changed::left-key", this.updateHotkeys, this);
      this.signalManager.connect(this.settings, "changed::right-key", this.updateHotkeys, this);
      this.signalManager.connect(this.settings, "changed::up-key", this.updateHotkeys, this);
      this.signalManager.connect(this.settings, "changed::down-key", this.updateHotkeys, this);
      this.registerHotkeys();
   }

   disable() {
      this.removeHotkeys();
      this.signalManager.disconnectAllSignals();
   }

   updateHotkeys() {
      this.removeHotkeys();
      this.registerHotkeys();
   }

   getHotkeySequence(name) {
      let str = this.settings.getValue(name);
      if (str && str.length>0 && str != "::") {
         return str;
      }
      return null;
   }

   registerHotkeys() {
      this.leftCombo = this.getHotkeySequence("left-key");
      if (this.leftCombo) {
         Main.keybindingManager.addHotKey("adjacent-left", this.leftCombo, Lang.bind(this, function() {this.performHotkey(Direction.Left)} ));
      }
      this.rightCombo = this.getHotkeySequence("right-key");
      if (this.rightCombo) {
         Main.keybindingManager.addHotKey("adjacent-right" , this.rightCombo, Lang.bind(this, function() {this.performHotkey(Direction.Right)} ));
      }
      this.upCombo = this.getHotkeySequence("up-key");
      if (this.upCombo) {
         Main.keybindingManager.addHotKey("adjacent-up" , this.upCombo, Lang.bind(this, function() {this.performHotkey(Direction.Up)} ));
      }
      this.downCombo = this.getHotkeySequence("down-key");
      if (this.downCombo) {
         Main.keybindingManager.addHotKey("adjacent-down" , this.downCombo, Lang.bind(this, function() {this.performHotkey(Direction.Down)} ));
      }
   }

   removeHotkeys() {
      if (this.leftCombo) {
         Main.keybindingManager.removeHotKey("adjust-left");
         this.leftCombo = null;
      }
      if (this.rightCombo) {
         Main.keybindingManager.removeHotKey("adjust-right");
         this.rightCombo = null;
      }
      if (this.upCombo) {
         Main.keybindingManager.removeHotKey("adjust-up");
         this.upCombo = null;
      }
      if (this.downCombo) {
         Main.keybindingManager.removeHotKey("adjust-down");
         this.downCombo = null;
      }
   }

   performHotkey(direction) {
      let bestWindow = null;
      let bestRec = null;
      let focusedWindow = global.display.get_focus_window();
      let focusedMonitor = focusedWindow.get_monitor();
      if (window) {
         let focusedRec = focusedWindow.get_frame_rect();
         let currentWs = global.screen.get_active_workspace_index();
         let ws = global.screen.get_workspace_by_index(currentWs);
         let windows = ws.list_windows();
         let allowMinimized = this.settings.getValue("include-minimized");
         let allowOtherMon  = this.settings.getValue("include-other-monitors");
         let useClosest     = (this.settings.getValue("next-focus") === Activate.Closest)
         for (let i = 0; i < windows.length; i++) {
            let metaWindow = windows[i];
            if (metaWindow != focusedWindow && Main.isInteresting(metaWindow) &&
               (allowMinimized || !metaWindow.minimized) &&
               (allowOtherMon || focusedMonitor == metaWindow.get_monitor()))
            {
               let rec = metaWindow.get_frame_rect();
               if (direction == Direction.Left) {
                  if (rec.x < focusedRec.x && (!bestWindow || (useClosest && rec.x > bestRec.x) || (!useClosest && isAbove(metaWindow, bestWindow)))) {
                     bestWindow = metaWindow;
                     bestRec = rec;
                  }
               } else if (direction == Direction.Right) {
                  if (rec.x+rec.width > focusedRec.x+focusedRec.width && (!bestWindow || (useClosest && rec.x+rec.width < bestRec.x+bestRec.width) || (!useClosest && isAbove(metaWindow, bestWindow)))) {
                     bestWindow = metaWindow;
                     bestRec = rec;
                  }
               } else if (direction == Direction.Up) {
                  if (rec.y < focusedRec.y && (!bestWindow || (useClosest && rec.y > bestRec.y) || (!useClosest && isAbove(metaWindow, bestWindow)))) {
                     bestWindow = metaWindow;
                     bestRec = rec;
                  }
               } else if (direction == Direction.Down) {
                  if (rec.y+rec.height > focusedRec.y+focusedRec.height && (!bestWindow || (useClosest && rec.y+rec.height < bestRec.y+bestRec.height) || (!useClosest && isAbove(metaWindow, bestWindow)))) {
                     bestWindow = metaWindow;
                     bestRec = rec;
                  }
               }
            }
         }
         if (bestWindow) {
            Main.activateWindow(bestWindow);
         }
      }
   }
}

let extension = null;
function enable() {
	extension.enable();
}

function disable() {
	extension.disable();
	extension = null;
}

function init(metadata) {
	if(!extension) {
		extension = new AdjacentWindows(metadata);
	}
}