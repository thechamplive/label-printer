import { app, BrowserWindow } from 'electron'
import path from 'path';
import Store from 'electron-store';
import { ipcMain } from 'electron';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

let mainWindow;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV !== "production"


let win;

function createWindow() {
    win = new BrowserWindow({
        width: isDev ? 1000 : 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
        }
    })


    if (isDev) {
        win.loadURL('http://localhost:5174');
        win.webContents.openDevTools();
    } else {
        console.log("running in production mode")
        win.loadFile(path.join(__dirname, 'builder/index.html'))
        autoUpdater.checkForUpdates();
    }

    // // Set up auto-updater
    // initializeAutoUpdater(win);
}

app.whenReady().then(() => {
    createWindow()
  
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});


const store = new Store(); // Persistent storage for the printer selection

// Default label settings
const defaultLabelSettings = {
    width: "100mm", // Label width
    height: "50mm", // Label height
    fontSize: "12px", // Default font size
    margin: "10px", // Default margin
};

store.set("labelSettings", defaultLabelSettings);

// IPC to get label settings
ipcMain.handle("get-label-settings", async () => {
    return store.get("labelSettings");
});

// IPC to save label settings
ipcMain.handle("save-label-settings", async (event, settings) => {
    const updatedSettings = {
        ...defaultLabelSettings,
        ...settings, // Merge with new settings
    };
    store.set("labelSettings", updatedSettings);
    return updatedSettings;
});

// Fetch saved printer
ipcMain.handle("get-saved-printer", async () => {
    return store.get("printerName");
});

// Save printer
ipcMain.handle("save-printer", async (event, printerName) => {
    store.set("printerName", printerName);
});

ipcMain.handle("clear-saved-printer", async () => {
    store.delete("printerName");
});

ipcMain.handle("get-available-printers", async () => {
    console.log('get-available-printers');
    if (!win || !win.webContents) {
        throw new Error("BrowserWindow is not initialized properly.");
    }
    const printers = win.webContents.getPrintersAsync();
    console.log('Available printers:', printers);
    return printers;
});

const generateHtml = (name, barcode, svg) => {
    const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Print Label</title>
<style>
@page {
  size: 300px 500px;
  margin: 0;
}

html, body {
  margin: 0;
  padding: 0;
  width: 150px; 
  height: 250px;
  display: flex;
  justify-content: left; /* Center content horizontally */
  align-items: left; /* Center content vertically */
}

.label {
  width: 30px; /* 50mm converted to pixels */
  height: 90px; /* 90mm converted to pixels */
  display: flex;
  flex-direction: column;
  justify-content: left; /* Vertically centers the content */
  align-items: left; /* Horizontally centers the content */
  text-align: left;
  background-color: #fff;
  box-sizing: border-box;
  padding: 0; /* Removed excessive padding */
}

.name {
  font-size: 68px; /* Adjusted for better fit (18px x 3.78) */
  font-weight: bold;
  margin-bottom: 20px; /* Adjusted margin for spacing */
}

@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .label {
    page-break-inside: avoid;
  }
}
</style>

  </head>
  <body>
    <div class="label">
      <div class="name">${name}</div>
      <div class="barcode">${barcode}</div>
    </div>
  </body>
  </html>
`;
}

ipcMain.handle("print-labels", async (event, labels) => {
    console.log("Received labels:", labels); // Debugging line to check the incoming data

    const printerName = store.get("printerName");
    if (!printerName) {
        console.log("No printer selected.");
        throw new Error("No printer selected.");
    }

    const options = {
        silent: false,
        deviceName: printerName,
    };


    for (const { name, barcode, svg } of labels) {
        console.log("Printing label:", name, barcode, svg); // Debugging line to check the incoming data

        const printWindow = new BrowserWindow({ show: false }); // Hidden print window

        const html = generateHtml(name, barcode, svg);

        // Load the HTML content into the print window
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

        new Promise((resolve, reject) => {
            printWindow.webContents.once("did-finish-load", () => {
                printWindow.webContents.print(options, (success, errorType) => {
                    if (!success) {
                        console.error(`Print failed: ${errorType}`);
                        reject(errorType);
                        console.log("Print failed")
                    } else {
                        console.log("Print succeeded")
                    }
                    printWindow.close();
                    resolve();
                })
            });
        });
    }
});