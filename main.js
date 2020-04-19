const {app, BrowserWindow, ipcMain,Tray, Menu} = require('electron')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const icon = path.join(__dirname,'resources','img','iconsmallx.png')

const iconWBubble = path.join(__dirname,'resources','img','iconsmall.png')

require('electron-reload')(__dirname, {
  electron: require(`${__dirname}/node_modules/electron`),
  ignored:/userdata|resources[\/\\]img|main.js|node_modules|[\/\\]\./
});

const {Mangakakalots} = require('./resources/source.js');

let SOURCES = {
  mangakakalots:{
      obj: new Mangakakalots('https://mangakakalots.com/'),
      name: "Mangakakalots",
      key:'mangakakalots',
  }
}

//https://stackoverflow.com/questions/12740659/downloading-images-with-node-js

const downloadImage = (url, image_path) =>
  axios({
    url,
    responseType: 'stream',
  }).then(
    response =>
      new Promise((resolve, reject) => {
        // GET EXT 
        response.data
          .pipe(fs.createWriteStream(image_path))
          .on('finish', () => resolve())
          .on('error', e => reject(e));
      }),
  );


console.log(process.argv)
var trayMode = false;
var UPDATES;
var knex = require("knex")({
  client: "sqlite3",
  connection:{
    filename: "./userdata/data.db"
  }
});
var CONFIG = JSON.parse(fs.readFileSync("./userdata/config.json"))
var CHAPTERMARK  = JSON.parse(fs.readFileSync("./userdata/chapterdata.json"))
var FAVORITES = {}
var POSITIONS = {
  chapterNum:{}
}

knex.table('FAVORITES').then(res=>{
  for(fav of res)
    FAVORITES[fav.href] = fav
})
knex.table('POSITIONS').then(res=>{
  for(row of res){
    let {id,...rest} = row
    POSITIONS[id] = rest
  }
  console.log(POSITIONS)
})

global.SOURCES = SOURCES // EXPOSE TO RENDERER
global.CONFIG = CONFIG


var mainWindow,tray;

async function scheduleUpdater(){
  UPDATED = {}
  for(let [href,obj] of Object.entries(FAVORITES)){
    UPDATED[href] = await SOURCES[obj.sourceKey].source.checkHrefForUpdates(href,obj.title,obj.latestChap)
  }
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
function createReaderWindow(){
  readerWindow = new BrowserWindow({
    width: 800,
    height:900,
    frame:false,
    resizable:false,
    webPreferences: {
      nodeIntegration: true
    }
  })
  readerWindow.loadFile('reader.html')
  readerWindow.webContents.openDevTools({mode:'detach'})
}
function showMainWindowFromTray(){
  createMainWindow()
  trayMode = false;
  tray.destroy()
}
function createTray(){
  tray = new Tray(icon)

  
  const contextMenu = Menu.buildFromTemplate([
    {label:'Maximize',type:'normal',click:showMainWindowFromTray},
    {label:'Start Updater',type:'normal',click:updateFunction},
    {label:'Quit MRION',role:'quit'}
  ]);

  tray.setContextMenu(contextMenu)
  tray.setToolTip('MRION')

  trayMode = true;

  
  tray.on('double-click',(evt)=>{
    showMainWindowFromTray()
  })
  tray.on('balloon-click',(evt)=>{
    if(!trayMode) return
    showMainWindowFromTray()
  })
}
function updateFunction(){
  scheduleUpdater().then((result)=>{
    let mangas = []
    for(let [href, obj] of Object.entries(result)){
      if(typeof obj === 'boolean') continue
      mangas.push(obj.title)
      console.log('UPDATE '+obj.title)
      if(!trayMode) {
        mainWindow.webContents.send('favoritesUpdate')
        return
      }
    }
    if(trayMode) {
      console.log('tray bubble')
      tray.setImage(iconWBubble)
      if(CONFIG.notify)tray.displayBalloon({
        icon:icon,
        iconType:'custom',
        title:'MRION',
        content: `${mangas.length} manga${(mangas.length>1)?'s':''} updated!`,
        largeIcon:true
      })
    }
  })
}

app.whenReady().then(function(){
  if(process.argv[2]=='tray'){
    createTray()
  }
  else createReaderWindow() //createMainWindow()
})

app.on('window-all-closed', function (e) {
  e.preventDefault()
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

ipcMain.on('min-toTray',(evt)=>{
  mainWindow.destroy()
  createTray()
})
ipcMain.on('getFavorites',(evt)=>{
  evt.returnValue = FAVORITES
})
ipcMain.on('addFavorite',(evt,data)=>{
  data.cachedPath = 
    `./userdata/fav-cache/${data.sourceKey}/${data.href.split('/').pop()}`

  knex.table('FAVORITES').insert(data).then(function(){
    FAVORITES[data.href] = data
    evt.sender.send('promise', true)
  })
  .catch(function(err){
    console.log('ERROR: ' + err)
    evt.sender.send('promise', err)
  })
})
ipcMain.on('removeFavorite',(evt,href)=>{
  knex.table('FAVORITES').where({href:href}).del().then(function(){
    if(FAVORITES[href].cachedPath)
      fs.rmdir(FAVORITES[href].cachedPath,{recursive:true}, (err)=>{if(err) throw err})
    delete FAVORITES[href]
    evt.sender.send('promise', true)
  })
  .catch(function(err){
    evt.sender.send('promise', err)
  })
})

ipcMain.on('updateFavCache',(evt,data)=>{
  let [result,href,sourceKey] = data
  let name = href.split('/').pop()
  console.log('UPDATING CACHE FOR: ' + name)
  let path = `./userdata/fav-cache/${sourceKey}/${name}`
  let image_ext = '.' + result.image.split('.').pop()

  if(!fs.existsSync(`./userdata/fav-cache/${sourceKey}`))
    fs.mkdirSync(`./userdata/fav-cache/${sourceKey}`)
  if(!fs.existsSync(path))
    fs.mkdirSync(path)
  downloadImage(result.image,`${path}/image` + image_ext).then(()=>{
    result.image = `${path}/image` + image_ext
    fs.writeFileSync(`${path}/result.json`, JSON.stringify(result,null,2))
  })
})
ipcMain.on('readFavCache',(evt,path)=>{
  evt.returnValue = JSON.parse(fs.readFileSync(`${path}/result.json`))
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
  fs.writeFileSync('./userdata/config.json', JSON.stringify(CONFIG,null,2))
})
ipcMain.on('getUpdates',(evt)=>{
  evt.returnValue = UPDATES
})

ipcMain.on('runUpdater',(evt)=>{
  updateFunction()
})
ipcMain.on('updateLatestChap',(evt,data)=>{
  knex.table('FAVORITES').where({href:data.href}).update({latestChap:data.text}).then(()=>{
    FAVORITES[data.href].latestChap = data.text
    UPDATES[data.href] = false;
  })
})
ipcMain.on('getLayoutPositions',(evt)=>{
  evt.returnValue = POSITIONS
})
ipcMain.on('setLayoutPositions',(evt,data)=>{
  POSITIONS = data
  for(let[id,val] of Object.entries(data)){
    if(val.changed){
      console.log("UPDATED "+id)
      val.changed = false;
      knex.table('POSITIONS').where({id:id}).update(val).then()
    }
  }
})
ipcMain.on('getCHAPTERMARK',(evt)=>evt.returnValue=CHAPTERMARK)
ipcMain.on('syncCHAPTERMARK',(evt,data)=>{
  CHAPTERMARK = data

  // CLEAN CHAPTERMARK OF EMPTY HREFS
    for(let [href,value] of Object.entries(CHAPTERMARK))
      if(value.READ.length == 0 && value.MARKED.length == 0)
        delete CHAPTERMARK[href]
  fs.writeFileSync(path.join(__dirname,'userdata','chapterdata.json'), JSON.stringify(CHAPTERMARK,null,2))
})

ipcMain.on('min-toTray',(evt)=>{
  mainWindow.destroy()
  createTray()
})
