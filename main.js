const {app, BrowserWindow, ipcMain,Tray} = require('electron')
const path = require('path')
const fs = require('fs')
const icon = path.join(__dirname,'resources','img','ico.png')
require('electron-reload')(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`),
  ignored:/userdata|resources[\/\\]img|main.js|node_modules|[\/\\]\./
});

const {Mangakakalots,KissManga} = require('./resources/source.js');

let SOURCES = {
  mangakakalots:{
      source: new Mangakakalots('https://mangakakalots.com/'),
      name: "Mangakakalots",
      sourceId:0,
      key:'mangakakalots',
  },
  manganelo:{
      source: true,
      name: "MangaNelo",
      sourceId:1,
      key:'manganelo',

  },
  kissmanga:{
      source:new KissManga('https://kissmanga.in/'),
      name:"KissManga",
      sourceId:2,
      key:'kissmanga',

  },
  merakiscans:{
      source: true,
      name: "Meraki Scans",
      sourceId:3,
      key:'merakiscans',

  },
}

console.log(process.argv)
var trayMode = false;
var UPDATES;
var knex = require("knex")({
  client: "sqlite3",
  connection:{
    filename: "./userdata/data.db"
  }
});
var CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname,'userdata','config.json')))
var FAVORITES = {}

knex.table('FAVORITES').then(res=>{
  for(fav of res)
    FAVORITES[fav.href] = fav
})

global.SOURCES = SOURCES // EXPOSE TO RENDERER
global.CONFIG = CONFIG

var mainWindow,tray;

async function scheduleUpdater(){
  UPDATED = {}
  for(let [href,obj] of Object.entries(FAVORITES))
    UPDATED[href] = await SOURCES[obj.sourceKey].source.checkHrefForUpdates(href,obj.latestChap)
  UPDATES = UPDATED
  return UPDATED
}
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
  evt.returnValue = FAVORITES
})
ipcMain.on('addFavorite',(evt,data)=>{
  knex.table('FAVORITES').insert(data).then()
  FAVORITES[data.href] = data
})
ipcMain.on('removeFavorite',(evt,href)=>{
  knex.table('FAVORITES').where({href:href}).del().then()
  delete FAVORITES[href]
})
ipcMain.on('setConfig',(evt,args)=>{
  let [key,val] = args
  CONFIG[key] = val
  evt.returnValue = true
})
ipcMain.on('getConfig',(evt,key)=>{
  evt.returnValue = CONFIG[key]
})
ipcMain.on('settingsUpdated',(evt)=>{
  fs.writeFileSync(path.join(__dirname,'userdata','config.json'), JSON.stringify(CONFIG,null,2))
})
ipcMain.on('getUpdates',(evt)=>{
  evt.returnValue = UPDATES
})

ipcMain.on('runUpdater',(evt)=>{
  scheduleUpdater().then((result)=>{
    for(let [href, obj] of Object.entries(result)){
      if(typeof obj === 'boolean') continue
      if(trayMode) console.log("UPDATE ON TRAY")
      if(mainWindow.isVisible()) {
        mainWindow.webContents.send('favoritesUpdate')
        return
      }
    }
  })
})
ipcMain.on('updateLatestChap',(evt,data)=>{
  knex.table('FAVORITES').where({href:data.href}).update({latestChap:data.text}).then(()=>{
    FAVORITES[data.href].latestChap = data.text
  })
})