const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')
const fs = require('fs')
require('electron-reload')(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`),
  ignored:/resources[\/\\]img|main.js|node_modules|[\/\\]\./
});
function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    frame:false,
    resizable:false,
    webPreferences: {
      nodeIntegration: true
    }
  })
  mainWindow.loadFile('index.html')
  mainWindow.webContents.openDevTools({mode:'detach'})
}
app.whenReady().then(createWindow)

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.on('requestSvg',(evt,filename)=>{
  fs.readFile(path.join(__dirname,'resources','img','svg',filename), 'utf8', (err,data)=>{
    if (err) throw err;
    evt.returnValue = data;
  })
})
ipcMain.on('close-electron',(evt)=>{
  app.quit()
})
ipcMain.on('min-electron',(evt)=>{
  console.log(evt.frameId)
  BrowserWindow.fromId(evt.frameId).minimize()
})
ipcMain.on('max-electron',(evt)=>{
  console.log(evt.frameId)
  window = BrowserWindow.fromId(evt.frameId)
  window.setFullScreen(!window.isFullScreen());
})
ipcMain.on('kissMangaSearch',(evt,url)=>{
  let tempWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname,'resources','enableJquery.js')
    }
  })
  tempWindow.loadURL(url)
  tempWindow.webContents.openDevTools({mode:'detach'})

});