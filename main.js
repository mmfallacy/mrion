const path = require('path')
const {app, BrowserWindow, ipcMain,Tray, Menu, MenuItem, dialog} = require('electron')
const fs = require('fs')
const axios = require('axios')
const icon = path.join(__dirname,'resources','img','iconsmallx.png')
const isDev = require('electron-is-dev');
var schedule = require('node-schedule');
const iconWBubble = path.join(__dirname,'resources','img','iconsmall.png')
var __userdata ;

if(isDev){
  require('electron-reload')(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`),
    ignored:/userdata|resources[\/\\]img|main.js|node_modules|[\/\\]\./
  });
  __userdata = path.join(__dirname,'userdata')
}
else{
  __userdata = path.join(__dirname,'/../../userdata')
}
const {Mangakakalots} = require('./resources/source.js');

let SOURCES = {
  mangakakalots:{
      obj: new Mangakakalots(),
      name: "Mangakakalots",
      key:'mangakakalots',
  }
}

if(!fs.existsSync(path.join(__userdata,'fav-cache')))
    fs.mkdirSync(path.join(__userdata,'fav-cache'))

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


var trayMode = false;
var UPDATES;
var knex = require("knex")({
  client: "sqlite3",
  connection:{
    filename: "./userdata/data.db"
  }
});

console.log(__userdata)

var CONFIG = JSON.parse(fs.readFileSync(path.join(__userdata,"config.json")))
var CHAPTERMARK  = JSON.parse(fs.readFileSync(path.join(__userdata,"chapterdata.json")))
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
})

global.SOURCES = SOURCES // EXPOSE TO RENDERER
global.CONFIG = CONFIG



var mainWindow,tray,readerWindow;
async function scheduleUpdater(){
  UPDATED = {}
  console.log('TIME NOW', new Date().toString())
  for(let [href,obj] of Object.entries(FAVORITES)){
    console.log('-> CHECKING: ' + href)
    UPDATED[href] = await SOURCES[obj.sourceKey].obj.checkUpdates(href,obj.title,obj.latestChapter)
  }
  UPDATES = UPDATED
  return UPDATED
}
function createMainWindow () {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    frame:false,
    show:false,
    resizable:false,
    webPreferences: {
      nodeIntegration: true
    }
  })
  mainWindow.loadFile('index.html')
  // mainWindow.webContents.openDevTools({mode:'detach'})

  
  mainWindow.once('show',(evt)=>{
    console.log('CHROME PATH: ')
    console.log(CONFIG.chromePath)
    if(CONFIG.chromePath) 
      for(let [key,{obj}] of Object.entries(SOURCES))
        obj._CHROME_PATH = CONFIG.chromePath
    else
      ipcMain.once('mainWindowReady',(evt)=>{
        mainWindow.webContents.send('chromeNotSet')
      })
  })

  mainWindow.on('close',(evt)=>{
    app.quit()
  })
  mainWindow.show()
}
function createReaderWindow(){
  readerWindow = new BrowserWindow({
    width: 800,
    height:900,
    frame:false,
    resizable:false,
    fullscreen:true,
    show:false,
    webPreferences: {
      nodeIntegration: true
    }
  })
  readerWindow.loadFile('reader.html')

  readerWindow.on('close',(evt)=>{
    mainWindow.show()
  })
  // readerWindow.webContents.openDevTools({mode:'detach'})
}
function showMainWindowFromTray(){
  if(mainWindow.isDestroyed())
    createMainWindow()
  else
     mainWindow.show()
  trayMode = false;
  tray.destroy()
}

const pauseSchedulerMenuItem = 
  new MenuItem({label:'Pause Scheduler', type:'checkbox',click:pauseSchedulerItem})
function pauseSchedulerItem(){
  let STATUS = pauseSchedulerMenuItem.checked
  if(STATUS){
    console.log("PAUSED SCHEDULER")
    scheduler.cancel()
  }
  else
    createScheduler()
}

function createTray(){
  tray = new Tray(icon)

  
  const contextMenu = Menu.buildFromTemplate([
    {label:'Maximize',type:'normal',click:showMainWindowFromTray},
    {label:'Quit MRION',role:'quit'}
  ]);
  contextMenu.insert(1,pauseSchedulerMenuItem)

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

var scheduler; 

function createScheduler(){
  console.log("CREATED SCHEDULE")
  CRON_TIMER = 
    '0 0 * * * *'
    // '*/20 * * * * *' // DEBUGGING
  scheduler = schedule.scheduleJob(CRON_TIMER,updateFunction);
}

createScheduler();

function updateFunction(){
  scheduleUpdater().then((result)=>{
    let mangas = []
    for(let [href, obj] of Object.entries(result)){
      if(typeof obj === 'boolean') continue
      mangas.push(obj.title)
      console.log('UPDATE '+obj.title)
      knex.table('FAVORITES').where({href}).update({latestChapter:obj.text}).then(function(){
        FAVORITES[href].latestChapter = obj.text
        console.log('-> UPDATED DATABASE')
      })
    }
    if(mangas.length<1) return
    if(trayMode) {
      tray.setImage(iconWBubble)
      if(CONFIG.notify)
        tray.displayBalloon({
          icon:icon,
          iconType:'custom',
          title:'MRION',
          content: `${mangas.length} manga${(mangas.length>1)?'s':''} updated!`,
          largeIcon:true
        })
    }
    else {
      mainWindow.webContents.send('favoritesUpdate',UPDATES)
      mainWindow.webContents.send('spawnInfoOnUpdates', mangas.length)
    }
  })
}

app.whenReady().then(function(){
  if(process.argv[2]=='tray'){
    createTray()
  }
  else 
      // createReaderWindow() 
      createMainWindow()
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
    path.join(__userdata,'fav-cache',data.sourceKey,data.href.split('/').pop())
  console.log(data)
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
  let _path = path.join(__userdata,'fav-cache',sourceKey,name)
  let image_ext = '.' + result.image.split('.').pop()

  if(!fs.existsSync(path.join(__userdata,'fav-cache',sourceKey)))
    fs.mkdirSync(path.join(__userdata,'fav-cache',sourceKey))
  if(!fs.existsSync(_path))
    fs.mkdirSync(_path)
  downloadImage(result.image,`${_path}/image` + image_ext).then(()=>{
    result.image = `${_path}/image` + image_ext
    fs.writeFileSync(`${_path}/result.json`, JSON.stringify(result,null,2))
  })
})
ipcMain.on('readFavCache',(evt,_path)=>{
  evt.returnValue = JSON.parse(fs.readFileSync(`${_path}/result.json`))
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
  fs.writeFileSync(path.join(__userdata,'config.json'), JSON.stringify(CONFIG,null,2))
})
ipcMain.on('getUpdates',(evt)=>{
  evt.returnValue = UPDATES
})

ipcMain.on('runUpdater',(evt)=>{
  updateFunction()
})

ipcMain.on('getLayoutPositions',(evt)=>{
  evt.returnValue = POSITIONS
})
ipcMain.on('setLayoutPositions',(evt,data)=>{
  POSITIONS = data
  for(let[id,val] of Object.entries(data)){
    if(val.changed){
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
  fs.writeFileSync(path.join(__userdata,'chapterdata.json'), JSON.stringify(CHAPTERMARK,null,2))
})

ipcMain.on('spawnReaderWindow',(evt,data)=>{
  console.log('Initializing reader window')
  createReaderWindow()
  readerWindow.once('ready-to-show',()=>{
    ipcMain.once('retrieveChapterData',(evt)=>{
      evt.returnValue = data
    })
    evt.sender.send('readerInitialized')
  })
})
ipcMain.on('show-reader',(evt)=>{
  if(!readerWindow.isDestroyed()){
    readerWindow.show()
    mainWindow.hide()
  }
})
ipcMain.on('showMainFromReader',(evt)=>{
  readerWindow.close()
})
ipcMain.on('spawnFileDialog',(evt)=>{
  let [_path] =
    dialog.showOpenDialogSync(mainWindow,
      {
        title: 'Set Chrome Path',
        defaultPath: "C:\\Program Files (x86)\\Google\\Chrome\\Application",
        buttonLabel: "Set Path",
        filters: [
          { name: 'Executable', extensions: ['exe'] },
        ],
        properties: ["openFile","dontAddToRecent"],
        message:"Set chrome executable file path as dependency"
      })
  evt.returnValue = _path
})


// ipcMain.on('retrieveChapterData',(evt)=>{
//   evt.returnValue = [
//     [
//       {
//           text:"Chapter 1",
//           date:"Aug 25,19",
//           href:"https://mangakakalots.com/chapter/baka_to_test_to_shokanjuu_dya/chapter_1"
//       },
//       {
//           text:"Chapter 2",
//           date:"Aug 25,19",
//           href:"https://mangakakalots.com/chapter/baka_to_test_to_shokanjuu_dya/chapter_2"
//       },
//       {
//           text:"Chapter 3",
//           date:"Aug 25,19",
//           href:"https://mangakakalots.com/chapter/baka_to_test_to_shokanjuu_dya/chapter_3"
//       }
//   ],
//   2,
//   {
//     sourceKey:SOURCES.mangakakalots.key,
//     href:'https://mangakakalots.com/manga/baka_to_test_to_shokanjuu_dya'
//   }
//   ]
// })
