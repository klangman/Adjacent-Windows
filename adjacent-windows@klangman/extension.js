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
   Closest: 0,
   HighestZ: 1,
   VisibleCorner: 2
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
      let focusedWindow = global.display.get_focus_window();
      if (!focusedWindow || !Main.isInteresting(focusedWindow)) {
         return;
      }
      let focusedMonitor = focusedWindow.get_monitor();
      let focusedRec = focusedWindow.get_frame_rect();
      let currentWs = global.screen.get_active_workspace_index();
      let ws = global.screen.get_workspace_by_index(currentWs);
      let windows = ws.list_windows();
      if (windows.length > 1) {
         let nextFocusType = this.settings.getValue("next-focus");
         let newWindow;
         if (nextFocusType === Activate.VisibleCorner) {
            newWindow = this.getClosestVisibleWindows(focusedWindow, focusedMonitor, focusedRec, windows, direction);
         } else if (nextFocusType === Activate.HighestZ){
            newWindow = this.getHighestZOrderWindow(focusedWindow, focusedMonitor, focusedRec, windows, direction);
         } else if (nextFocusType === Activate.Closest){
            newWindow = this.getClosestWindow(focusedWindow, focusedMonitor, focusedRec, windows, direction);
         }
         if (newWindow) {
            Main.activateWindow(newWindow);
         }
      }
      return;
   }

   // Find the window that is closes to the focused window in the direction requested
   getClosestWindow(focusedWindow, focusedMonitor, focusedRec, windowList, direction) {
      let bestWindow = null;
      let bestRec = null;
      let allowMinimized = this.settings.getValue("include-minimized");
      let allowOtherMon  = this.settings.getValue("include-other-monitors");
      for (let i = 0; i < windowList.length; i++) {
         let metaWindow = windowList[i];
         if (metaWindow != focusedWindow && Main.isInteresting(metaWindow) &&
            (allowMinimized || !metaWindow.minimized) &&
            (allowOtherMon || focusedMonitor == metaWindow.get_monitor()))
         {
            let rec = metaWindow.get_frame_rect();
            if (direction == Direction.Left) {
               if (rec.x < focusedRec.x && (!bestWindow || rec.x > bestRec.x)) {
                  bestWindow = metaWindow;
                  bestRec = rec;
               }
            } else if (direction == Direction.Right) {
               if (rec.x > focusedRec.x && (!bestWindow || rec.x < bestRec.x)) {
                  bestWindow = metaWindow;
                  bestRec = rec;
               }
            } else if (direction == Direction.Up) {
               if (rec.y < focusedRec.y && (!bestWindow || rec.y > bestRec.y)) {
                  bestWindow = metaWindow;
                  bestRec = rec;
               }
            } else if (direction == Direction.Down) {
               if (rec.y > focusedRec.y && (!bestWindow || rec.y < bestRec.y)) {
                  bestWindow = metaWindow;
                  bestRec = rec;
               }
            }
         }
      }
      return bestWindow;
   }

   // Return the window that has the highest z-order and is in the direction requested from the focused window
   getHighestZOrderWindow(focusedWindow, focusedMonitor, focusedRec, windowList, direction) {
      let bestWindow = null;
      let allowOtherMon  = this.settings.getValue("include-other-monitors");
      for (let i = 0; i < windowList.length; i++) {
         let metaWindow = windowList[i];
         if (metaWindow != focusedWindow && Main.isInteresting(metaWindow) && !metaWindow.minimized &&
            (allowOtherMon || focusedMonitor == metaWindow.get_monitor()))
         {
            let rec = metaWindow.get_frame_rect();
            if (direction == Direction.Left) {
               if (rec.x < focusedRec.x && (!bestWindow || isAbove(metaWindow, bestWindow))) {
                  bestWindow = metaWindow;
               }
            } else if (direction == Direction.Right) {
               if (rec.x > focusedRec.x && (!bestWindow || isAbove(metaWindow, bestWindow))) {
                  bestWindow = metaWindow;
               }
            } else if (direction == Direction.Up) {
               if (rec.y < focusedRec.y && (!bestWindow || isAbove(metaWindow, bestWindow))) {
                  bestWindow = metaWindow;
               }
            } else if (direction == Direction.Down) {
               if (rec.y > focusedRec.y && (!bestWindow || isAbove(metaWindow, bestWindow))) {
                  bestWindow = metaWindow;
               }
            }
         }
      }
      return bestWindow;
   }

   // Look for all windows that have some corner of their window in the direction of the direction parameter.
   // Sort the candidate list by z-order (descending user_time)
   // Return the window closes to the current window that still has a corner visible
   getClosestVisibleWindows(focusedWindow, focusedMonitor, focusedRec, windowList, direction) {
      let candidateList = [];
      let windowVisibilityList = [];
      let allowOtherMon  = this.settings.getValue("include-other-monitors");

      // Sort the list of windows in z-order (most recently focused is first in the list).
      windowList.sort(function(a, b) {return b.user_time - a.user_time;});
      // Create list of candidate windows and calculate which corners are visible
      for (let i=0 ; i<windowList.length ; i++) {
         let metaWindow = windowList[i];
         let rec = metaWindow.get_frame_rect();
         let y = windowVisibilityList.push({window: metaWindow, rec: rec, cornerVisibility: null}) - 1;
         windowVisibilityList[y].cornerVisibility = this.getCornerVisibility( windowVisibilityList[y], windowVisibilityList );
         if (metaWindow != focusedWindow && Main.isInteresting(metaWindow) && !metaWindow.minimized &&
            (allowOtherMon || focusedMonitor == metaWindow.get_monitor()))
         {
            if (direction == Direction.Left) {
               if (rec.x < focusedRec.x) {
                  candidateList.push(windowVisibilityList[y]);
               }
            } else if (direction == Direction.Right) {
               if (rec.x > focusedRec.x && rec.x+rec.width > focusedRec.x+focusedRec.width) {
                  candidateList.push(windowVisibilityList[y]);
               }
            } else if (direction == Direction.Up) {
               if (rec.y < focusedRec.y) {
                  candidateList.push(windowVisibilityList[y]);
               }
            } else if (direction == Direction.Down) {
               if (rec.y > focusedRec.y && rec.y+rec.height > focusedRec.y+focusedRec.height) {
                  candidateList.push(windowVisibilityList[y]);
               }
            }
         }
      }
      if (candidateList.length > 1) {
         // Find the closest window that has one relevant corner visible (i.e. if direction is left, then one left corner must be visible)
         let bestWindow = candidateList[0];
         for (let i=1 ; i < candidateList.length ; i++) {
            let candidate = candidateList[i];
            if (direction == Direction.Left) {
               if (candidate.rec.x > bestWindow.rec.x && (candidate.cornerVisibility.topLeft || candidate.cornerVisibility.bottomLeft)) {
                  bestWindow = candidate;
               }
            } else if (direction == Direction.Right) {
               if (candidate.rec.x < bestWindow.rec.x && (candidate.cornerVisibility.topRight || candidate.cornerVisibility.bottomRight)) {
                  bestWindow = candidate;
               }
            } else if (direction == Direction.Up) {
               if (candidate.rec.y > bestWindow.rec.y && (candidate.cornerVisibility.topLeft || candidate.cornerVisibility.topRight)) {
                  bestWindow = candidate;
               }
            } else if (direction == Direction.Down) {
               if (candidate.rec.y < bestWindow.rec.y && (candidate.cornerVisibility.bottomLeft || candidate.cornerVisibility.bottomRight)) {
                  bestWindow = candidate;
               }
            }
         }
         return bestWindow.window;
      } else if (candidateList.length == 1){
         return candidateList[0].window;
      }
      return null;
   }

   // Calculate the visibility of window corners.
   // Assumes the windowList is in z-order with focused window at index 0
   // Returns an object with the visibility of the four corners
   getCornerVisibility(window, windowList) {
      let cornerVisibility = {topLeft: true, topRight: true, bottomLeft: true, bottomRight: true};
      if (window !== windowList[0]) {
         let x = window.rec.x;
         let y = window.rec.y;
         let x2 = window.rec.x+window.rec.width;
         let y2 = window.rec.y+window.rec.height;
         for (let i = 0 ; windowList[i] != window ; i++) {
            let cx = windowList[i].rec.x;
            let cy = windowList[i].rec.y;
            let cx2 = windowList[i].rec.x+windowList[i].rec.width;
            let cy2 = windowList[i].rec.y+windowList[i].rec.height;
            if (cx <= x && cx2 >= x && cy <= y && cy2 >= y) {
               cornerVisibility.topLeft = false;
            }
            if (cx <= x2 && cx2 >= x2 && cy <= y && cy2 >= y) {
                  cornerVisibility.topRight = false;
            }
            if (cx <= x && cx2 >= x && cy <= y2 && cy2 >= y2) {
               cornerVisibility.bottomLeft = false;
            }
            if (cx <= x2 && cx2 >= x2 && cy <= y2 && cy2 >= y2) {
               cornerVisibility.bottomRight = false;
            }
         }
      }
      return cornerVisibility;
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