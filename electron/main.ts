import {app, BrowserWindow, dialog, ipcMain} from 'electron'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import fs from "fs"
import SaveFileArgs from "../src/Interfaces/SaveFileArgs.ts";

createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
        },
    })

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(createWindow)

ipcMain.handle('save-file', async (event, {data}: { data: SaveFileArgs }) => {
    try {
        // 打开保存文件对话框
        let targetFilePath: string = "";
        if (data.displayChoosePathDialog) {
            const {filePath, canceled} = await dialog.showSaveDialog({
                title: 'Save File',
                defaultPath: app.getPath('documents'),
                filters: data.filters || [{name: 'All Files', extensions: ['*']}],
            });

            // if user canceled the save operation, return directly
            if (canceled) {
                return {success: false, message: 'User canceled the save operation.'};
            }

            targetFilePath = filePath
        } else {
            if (data.defaultPath === undefined) {
                return {success: false, message: 'No default path provided.'};
            }
            targetFilePath = data.defaultPath
        }
        const dir = path.dirname(targetFilePath);

        // check if the directory exists, if not, create it
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }

        // write data to the specified file
        fs.writeFileSync(targetFilePath, data.content, 'utf-8');

        return {success: true, path: targetFilePath};
    } catch (error: unknown) {
        console.error('Error saving file:', error, event);
        return {success: false, error: error};
    }
});

ipcMain.handle('read-file', async (event, filePath: string) => {
    try {
        // 读取文件内容
        const fileContent = fs.readFileSync(filePath, 'utf-8');

        return {success: true, data: fileContent};
    } catch (error) {
        console.error('Error reading JSON file:', error, event);
        return {success: false, error: error};
    }
});

// 获取指定路径下的所有文件
function getFilesInDirectory(dirPath: string, recursive = false): string[] {
    try {
        const files = fs.readdirSync(dirPath, {withFileTypes: true});
        const allFiles = [];

        for (const file of files) {
            const fullPath = path.join(dirPath, file.name);

            if (file.isDirectory()) {
                // 如果是文件夹，且需要递归，则进入文件夹
                if (recursive) {
                    const subFiles = getFilesInDirectory(fullPath, recursive);
                    allFiles.push(...subFiles);
                }
            } else {
                // 如果是文件，则添加到结果
                allFiles.push(fullPath);
            }
        }

        return allFiles;
    } catch (error) {
        console.error('Error reading directory:', error);
        return [];
    }
}

// 主进程接口：处理渲染进程请求
ipcMain.handle('get-files-in-directory', async (event, {dirPath, recursive = false}) => {
    try {
        const files = getFilesInDirectory(dirPath, recursive);
        return {success: true, files};
    } catch (error) {
        console.error('Error reading directory:', error, event);
        return {success: false, error: error};
    }
});