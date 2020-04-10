const {app, BrowserWindow, ipcMain,Tray} = require('electron')
const path = require('path')
const fs = require('fs')
const icon = path.join(__dirname,'resources','img','ico.png')
require('electron-reload')(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`),
  ignored:/userdata|resources[\/\\]img|main.js|node_modules|[\/\\]\./
});

console.log(process.argv)

var knex = require("knex")({
  client: "sqlite3",
  connection:{
    filename: "./userdata/data.db"
  }
});
var CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname,'userdata','config.json')))

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
  window = mainWindow//BrowserWindow.fromId(evt.frameId)
  window.setFullScreen(!window.isFullScreen());
})
ipcMain.on('getFavorites',(evt)=>{
  knex.table('FAVORITES').then(res=>{
    evt.returnValue = res
  })
})
ipcMain.on('addFavorite',(evt,data)=>{
  knex.table('FAVORITES').insert(data).then()
})
ipcMain.on('removeFavorite',(evt,href)=>{
  knex.table('FAVORITES').where({href:href}).del().then()
})
ipcMain.on('setConfig',(evt,args)=>{
  let [key,val] = args
  CONFIG[key] = val
  evt.returnValue = true
})
ipcMain.on('getConfig',(evt,key)=>{
  console.log(key)
  evt.returnValue = CONFIG[key]
})
ipcMain.on('settingsUpdated',(evt)=>{
  fs.writeFileSync(path.join(__dirname,'userdata','config.json'), JSON.stringify(CONFIG,null,2))
})
ipcMain.on('getConfigObj',evt=>evt.returnValue=CONFIG)