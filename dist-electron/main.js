import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "fs";
createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(createWindow);
ipcMain.handle("save-file", async (event, { data }) => {
  try {
    let targetFilePath = "";
    if (data.displayChoosePathDialog) {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: "Save File",
        defaultPath: app.getPath("documents"),
        filters: data.filters || [{ name: "All Files", extensions: ["*"] }]
      });
      if (canceled) {
        return { success: false, message: "User canceled the save operation." };
      }
      targetFilePath = filePath;
    } else {
      if (data.defaultPath === void 0) {
        return { success: false, message: "No default path provided." };
      }
      targetFilePath = data.defaultPath;
    }
    const dir = path.dirname(targetFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(targetFilePath, data.content, "utf-8");
    return { success: true, path: targetFilePath };
  } catch (error) {
    console.error("Error saving file:", error, event);
    return { success: false, error };
  }
});
ipcMain.handle("read-file", async (event, filePath) => {
  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    return { success: true, data: fileContent };
  } catch (error) {
    console.error("Error reading JSON file:", error, event);
    return { success: false, error };
  }
});
function getFilesInDirectory(dirPath, recursive = false) {
  try {
    const files = fs.readdirSync(dirPath, { withFileTypes: true });
    const allFiles = [];
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        if (recursive) {
          const subFiles = getFilesInDirectory(fullPath, recursive);
          allFiles.push(...subFiles);
        }
      } else {
        allFiles.push(fullPath);
      }
    }
    return allFiles;
  } catch (error) {
    console.error("Error reading directory:", error);
    return [];
  }
}
ipcMain.handle("get-files-in-directory", async (event, { dirPath, recursive = false }) => {
  try {
    const files = getFilesInDirectory(dirPath, recursive);
    return { success: true, files };
  } catch (error) {
    console.error("Error reading directory:", error, event);
    return { success: false, error };
  }
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
