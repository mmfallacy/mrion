const {app, BrowserWindow, ipcMain,Tray} = require('electron')
const path = require('path')
const fs = require('fs')
const icon = path.join(__dirname,'resources','img','ico.png')
require('electron-reload')(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`),
  ignored:/resources[\/\\]img|main.js|node_modules|[\/\\]\./
});

console.log(process.argv)

var mainWindow,tray;
function createMainWindow () {
  mainWindow = new BrowserWindow({
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
app.whenReady().then(function(){
  if(process.argv[2]=='tray'){
    console.log('tray opened')
    tray = new Tray(icon)
  }
  else createMainWindow()
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
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
  window = mainWindow //BrowserWindow.fromId(evt.frameId)
  window.minimize()
})
ipcMain.on('max-electron',(evt)=>{
  console.log(evt.frameId)
  window = mainWindow//BrowserWindow.fromId(evt.frameId)
  window.setFullScreen(!window.isFullScreen());
})