const { contextBridge, ipcRenderer } = require('electron');

// Expose specific methods or data to the renderer process
contextBridge.exposeInMainWorld('api', {
    sendMessage: (channel, data) => {
        const validChannels = ['message']; // List allowed channels
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    onMessage: (channel, callback) => {
        const validChannels = ['message']; // List allowed channels
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
    },

    getSavedPrinter: () => ipcRenderer.invoke("get-saved-printer"),
    clearSavedPrinter: () => ipcRenderer.invoke("clear-saved-printer"),
    savePrinter: (printerName) => ipcRenderer.invoke("save-printer", printerName),
    getAvailablePrinters: () => ipcRenderer.invoke("get-available-printers"),
    printLabels: (labels) => {
        console.log("printing labels", labels)
        ipcRenderer.invoke("print-labels", labels)
    },
    getSavedLabelSettings: () => ipcRenderer.invoke("get-label-settings"),
    saveLabelSettings: (settings) => ipcRenderer.invoke("save-label-settings", settings),

});
