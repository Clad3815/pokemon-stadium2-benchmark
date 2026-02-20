const { windowManager } = require('node-window-manager');
const robot = require('robotjs');

/**
 * Finds and activates a window by executable name and title, then simulates a key press.
 * @param {string} exeName - Executable name to search for (e.g. "Project64.exe")
 * @param {string} windowTitlePrefix - Window title prefix to search for (e.g. "Pokemon")
 * @param {string} keyToPress - Key to simulate (e.g. "f2")
 * @param {Function} callback - Callback function called when operation is complete (err, result)
 */
function focusWindowAndPressKey(exeName, windowTitlePrefix, keyToPress, callback) {
  try {
    const windows = windowManager.getWindows();
    
    let targetWindow = null;
    let matchingWindows = [];
    
    for (const window of windows) {
      const path = window.path || '';
      
      if (path.toLowerCase().includes(exeName.toLowerCase())) {
        const title = window.getTitle();
        
        matchingWindows.push({ window, title, path });
        console.log(`Window found: "${title}" (Path: ${path})`);
        
        if (title && title.startsWith(windowTitlePrefix)) {
          targetWindow = window;
          console.log(`Matching window found: "${title}"`);
          break;
        }
      }
    }
    
    if (matchingWindows.length === 0) {
      const error = `No window found for executable "${exeName}".`;
      console.log(error);
      if (callback) callback(new Error(error), null);
      return;
    }
    
    if (!targetWindow) {
      const error = `${matchingWindows.length} windows found for "${exeName}" but none starts with "${windowTitlePrefix}".`;
      console.log(error);
      if (callback) callback(new Error(error), null);
      return;
    }
    
    // Bring the window to the foreground
    targetWindow.bringToTop();
    const activatedTitle = targetWindow.getTitle();
    console.log(`Window "${activatedTitle}" activated.`);
    
    // Wait briefly to ensure the window is active, then simulate the key press
    setTimeout(() => {
      robot.keyTap(keyToPress);
      console.log(`Key "${keyToPress}" simulated.`);
      if (callback) callback(null, { 
        success: true, 
        windowTitle: activatedTitle, 
        keyPressed: keyToPress 
      });
    }, 1000);
    
  } catch (error) {
    console.error('Error:', error);
    if (callback) callback(error, null);
  }
}

/**
 * Promise version of focusWindowAndPressKey.
 */
function focusWindowAndPressKeyPromise(exeName, windowTitlePrefix, keyToPress) {
  return new Promise((resolve, reject) => {
    focusWindowAndPressKey(exeName, windowTitlePrefix, keyToPress, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

// Usage example with callback
// focusWindowAndPressKey('Project64.exe', 'Pokemon', 'f2', (err, result) => {
//   if (err) {
//     console.error('Error:', err.message);
//   } else {
//     console.log('Operation successful:', result);
//   }
// });

// Usage example with Promises
// (async () => {
//   try {
//     const result = await focusWindowAndPressKeyPromise('Project64.exe', 'Pokemon', 'f2');
//     console.log('Operation successful:', result);
//   } catch (error) {
//     console.error('Error:', error.message);
//   }
// })();

// Export functions
module.exports = {
  focusWindowAndPressKey,
  focusWindowAndPressKeyPromise
};
