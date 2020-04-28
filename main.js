// MODULES
  const path = require('path')
  const {app, BrowserWindow, ipcMain,Tray, Menu, MenuItem, dialog} = require('electron')

  app.allowRendererProcessReuse = true

  const fs = require('fs')
  const axios = require('axios')
  const isDev = require('electron-is-dev');
  var schedule = require('node-schedule');
  const colors = require('colors')
  const moment = require('moment')
  const {autoUpdater} = require('electron-updater')
// PATHS
  const icon = path.join(__dirname,'resources','img','iconsmallx.png')
  const iconWBubble = path.join(__dirname,'resources','img','iconsmall.png')
  var __userdata ;

if(isDev){
  // RELOAD ELECTRON ON RESOURCE CHANGE
  require('electron-reload')(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`),
    ignored:/userdata|resources[\/\\]img|main.js|node_modules|[\/\\]\./
  });
  autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml');
  // SET USERDATA PATH TO ./userdata
  __userdata = path.join(__dirname,'userdata')
}
else{
  // SET USERDATA PATH TO ./userdata (FOR BUILT APPLICATION)
  __userdata = path.join(app.getPath('documents'),'MRION')
  
}
// LOGGER
  // CHECK FOR LOGS FOLDER
  if(!fs.existsSync(__userdata)){
    console.log("USERDATA FOLDER NOT FOUND".bgRed.bold)
    fs.mkdirSync(__userdata)
    console.log("--> USERDATA FOLDER CREATED".blue.bold)
  }

  if(!fs.existsSync(path.join(__userdata,'logs'))){
    console.log("LOGS FOLDER NOT FOUND".bgRed.bold)
    fs.mkdirSync(path.join(__userdata,'logs'))
    console.log("--> LOGS FOLDER CREATED".blue.bold)
  }

  const DATESTAMP = moment().format('DD-MM-YYYY')
  const logger = require('electron-log')
  logger.transports.file.level = (isDev)? false:'info';
  logger.transports.file.resolvePath =()=>path.join(__userdata,'logs',`${DATESTAMP}.mrionlog`);
  logger.transports.file.format = '[{h}:{i}:{s} | {y}-{m}-{d} ] [{level}] >>> {text}'
  logger.transports.console.format = '{text}'
  var _console = {};
  Object.assign(_console,console)
  Object.assign(console,logger.functions)
  
  console.header = (header, args) => {
    logger.transports.console.level = false;
    let _pretty_header = ' ' +  header + ' '
    for(const arg of args)
      _pretty_header = _pretty_header[arg]
    console.log(header)
    _console.log(_pretty_header)
    logger.transports.console.level = true;
  }

  //DIFFERENTIATE INSTANCES
    console.header("------------------------------------------------------------------------",['bgBrightMagenta','bold','grey'])
    console.header(`  STARTING MRION APP...                                                 `,['bgBrightMagenta','bold','grey'])
    console.header(`  VERSION ${app.getVersion()}${' '.repeat(62-app.getVersion().length)}`,['bgBrightMagenta','bold','grey'])
    console.header("------------------------------------------------------------------------",['bgBrightMagenta','bold','grey'])
// SOURCES
  const {Mangakakalots} = require('./resources/source.js');

  let SOURCES = {
    mangakakalots:{
        obj: new Mangakakalots(),
        name: "Mangakakalots",
        key:'mangakakalots',
    }
  }

// CREATE FAV-CACHE FOLDER IF NOT EXIST
  if(!fs.existsSync(path.join(__userdata,'fav-cache')))
      fs.mkdirSync(path.join(__userdata,'fav-cache'))

// DOWNLOAD IMAGE FUNCTION FOR CACHING
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



// ASYNC SOURCE CHECKER
  var UPDATES;
  async function scheduleUpdater(){
    UPDATED = {}
    console.header("CHECKING FOR UPDATES:",['bgYellow','bold'])
    for(let [href,obj] of Object.entries(FAVORITES)){
      console.log('-> CHECKING: ' + href)
      UPDATED[href] = await SOURCES[obj.sourceKey].obj.checkUpdates(href,obj.title,obj.latestChapter)
    }
    UPDATES = UPDATED
    return UPDATED
  }

  // CREATE GLOBAL SCHEDULE
  var manga_scheduler; 
  function createMangaScheduler(){
    console.header("MANGA UPDATE SCHEDULE INITIALIZED",['bgBlue','bold'])
    CRON_TIMER = 
      '0 0 * * * *'
      // '*/20 * * * * *' // DEBUGGING
    manga_scheduler = schedule.scheduleJob(CRON_TIMER,updateFunction);
  }
  // RUN SCHEDULER ON START
  createMangaScheduler();

  // CREATE GLOBAL SCHEDULE
  var update_scheduler; 
  function createUpdateScheduler(){
    console.header("UPDATE SCHEDULE INITIALIZED",['bgBlue','bold'])
    CRON_TIMER = 
      '0 0 */5 * * *'
    manga_scheduler = schedule.scheduleJob(CRON_TIMER,checkForMRIONUpdate);
  }
  // RUN SCHEDULER ON START
  createUpdateScheduler();

  // UPDATE FUNCTION HANDLER
  function updateFunction(){
    scheduleUpdater().then((result)=>{
      let mangas = []

      for(let [href, obj] of Object.entries(result)){
        if(typeof obj === 'boolean') continue
        mangas.push(obj.title)
        console.log('-- UPDATING '+obj.title)
        knex.table('FAVORITES').where({href}).update({latestChapter:obj.text}).then(function(){
          FAVORITES[href].latestChapter = obj.text
        })
      }

      if(mangas.length<1) return
      if(TRAY_MODE) {
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
// DATABASE AND JSON
  var PATHS = {
    CONFIG: path.join(__userdata,"config.json"),
    CHAPTERDATA: path.join(__userdata,"chapterdata.json"),
    DB : path.join(__userdata,"data.db")
  } 
  
  // CHECK FOR CONFIG JSON
  if(!fs.existsSync(PATHS.CONFIG)){
    console.header("CONFIG NOT FOUND", ["bgRed","bold"])
    fs.writeFileSync(PATHS.CONFIG, JSON.stringify({notify:1,checkUpdate:1},null,2))
    console.header("--> CONFIG INITIALIZED", ["blue","bold"])
  }

  // CHECK FOR CHAPTERDATA
  if(!fs.existsSync(PATHS.CHAPTERDATA)){
    console.header("CHAPTERDATA NOT FOUND", ["bgRed","bold"])
    fs.writeFileSync(PATHS.CHAPTERDATA, JSON.stringify({},null,2))
    console.header("--> CHAPTERDATA INITIALIZED", ["blue","bold"])
  }

  // CHECK FOR DB
  if(!fs.existsSync(PATHS.DB)){ 
    console.header("DATABASE NOT FOUND", ["bgRed","bold"])
    fs.copyFileSync(path.join(__dirname,'resources','clean-data.db'), PATHS.DB);
    console.header("--> DATABAASE INITIALIZED", ["blue","bold"])
  }

  var knex = require("knex")({
    client: "sqlite3",
    connection:{
      filename: PATHS.DB
    },
    useNullAsDefault: true
  });
  var CONFIG = JSON.parse(fs.readFileSync(PATHS.CONFIG))
  var CHAPTERMARK  = JSON.parse(fs.readFileSync(PATHS.CHAPTERDATA))

  // LOAD FAVORITES FROM DB
  var FAVORITES = {}
  knex.table('FAVORITES').then(res=>{
    for(fav of res)
      FAVORITES[fav.href] = fav
  })

  // LOAD POSITIONS FROM DB
  var POSITIONS = {}
  knex.table('POSITIONS').then(res=>{
    for(row of res){
      let {id,...rest} = row
      POSITIONS[id] = rest
    }
  })


// EXPOSE TO RENDERER
  global.SOURCES = SOURCES
  global.CONFIG = CONFIG


// INITIALIZE MAIN WINDOW
  var mainWindow;
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
    //mainWindow.webContents.openDevTools({mode:'detach'})
    
    mainWindow.once('show',(evt)=>{

      if(CONFIG.chromePath) 
        for(let [key,{obj}] of Object.entries(SOURCES))
          obj._CHROME_PATH = CONFIG.chromePath
      else
        ipcMain.once('mainWindowReady',(evt)=>{
          mainWindow.webContents.send('chromeNotSet')
        })
    })
    mainWindow.on('show',(evt)=>{
      if(UPDATE_AVAILABLE)
        mainWindow.webContents.send('mrionu-available',UPDATE_AVAILABLE)
    })
    mainWindow.on('close',(evt)=>{
      app.quit()
    })
    mainWindow.show()
  }

// INITIALIZE READER WINDOW
  var readerWindow;
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


// INITIALIZE SYSTEM TRAY
  var tray;
  var TRAY_MODE = false;
  function createTray(){
    tray = new Tray(icon)    
    const contextMenu = Menu.buildFromTemplate([
      {label:'Maximize',type:'normal',click:showMainWindowFromTray},
      {label:'Quit MRION',role:'quit'}
    ]);

    MENU_ITEM_PAUSE_MANGA_SCHED = new MenuItem({label:'Pause Manga Updates', type:'checkbox',click:pauseMangaSchedulerItem})
    MENU_ITEM_PAUSE_UPD_SCHED = new MenuItem({label:'Pause Updates', checked:!CONFIG.checkUpdate,type:'checkbox',click:pauseUpdateSchedulerItem})

    contextMenu.insert(1,MENU_ITEM_PAUSE_MANGA_SCHED)
    contextMenu.insert(1,MENU_ITEM_PAUSE_UPD_SCHED)

    tray.setContextMenu(contextMenu)
    tray.setToolTip('MRION')
  
    TRAY_MODE = true;
  
    tray.on('double-click',(evt)=>{
      showMainWindowFromTray()
    })
    tray.on('balloon-click',(evt)=>{
      if(!TRAY_MODE) return
      showMainWindowFromTray()
    })
  }

// TRAY CLICK EVENTS
  function showMainWindowFromTray(){
    if(!mainWindow || mainWindow.isDestroyed())
      createMainWindow()
    else
      mainWindow.show()
    TRAY_MODE = false;
    tray.destroy()
  } 
    
  function pauseMangaSchedulerItem(){
    let STATUS = MENU_ITEM_PAUSE_MANGA_SCHED.checked
    if(STATUS){
      console.header('UPDATE SCHEDULE IS PAUSED ',['bgGreen','bold'])
      scheduler.cancel()
    }
    else
      createMangaScheduler()
  }
  function pauseUpdateSchedulerItem(){
    let STATUS = MENU_ITEM_PAUSE_UPD_SCHED.checked
    if(STATUS){
      console.header('UPDATE SCHEDULE IS PAUSED ',['bgGreen','bold'])
      scheduler.cancel()
    }
    else
      createMangaScheduler()
  }

// APP EVENT LISTENERS
  // CREATE TRAY/MAINWINDOW ON APP READY
    app.whenReady().then(function(){
      if(process.argv[2]=='tray'){
        createTray()
      }
      else {
          // createReaderWindow() 
          createMainWindow()
      }
    })
  // PREVENT APP QUIT ON ALL WINDOW CLOSED (SYSTEM TRAY)
    app.on('window-all-closed', function (e) {
      e.preventDefault()
    })

// IPC EVENT LISTENERS
  // HANDLE SVG REQUESTS
    ipcMain.on('requestSvg',(evt,filename)=>{
      fs.readFile(path.join(__dirname,'resources','img','svg',filename), 'utf8', (err,data)=>{
        if (err) throw err;
        evt.returnValue = data;
      })
    })
  // ELECTRON WINDOW EVENTS
    // CLOSE
      ipcMain.on('close-electron',(evt)=>{
        app.quit()
      })
    // MINIMIZE WINDOW
      ipcMain.on('min-electron',(evt)=>{
        window = mainWindow
        window.minimize()
      })
    // MAXIMIZE WINDOW
      ipcMain.on('max-electron',(evt)=>{
        window = mainWindow
        window.setFullScreen(!window.isFullScreen());
      })
    // MINIMIZE TO TRAY (DESTROYS MAIN WINDOW)
      ipcMain.on('min-toTray',(evt)=>{
        mainWindow.destroy()
        createTray()
      })
      ipcMain.on('restart-electron',(evt)=>{
        app.relaunch()
        app.exit()
      })
    // ON ERROR
      ipcMain.on('window-error',(evt,[msg,url,ln])=>{
        _console.log('<ERROR>:'.bgRed.bold)
        let hr = '--------------------------------------------------------------'
        console.error(`\n\t>>> ${url} at line ${ln}\n\t>>> ${hr}\n\t>>> \t${msg}\n\t>>> ${hr}`)
      })
  // FAVORITE EVENTS  
    // FAVORITES GETTER
      ipcMain.on('getFavorites',(evt)=>{
        evt.returnValue = FAVORITES
      })
    // ADD FAVORITE
      ipcMain.on('addFavorite',(evt,data)=>{
        data.cachedPath = 
          path.join(__userdata,'fav-cache',data.sourceKey,data.href.split('/').pop())
        console.log(data)
        knex.table('FAVORITES').insert(data).then(function(){
          FAVORITES[data.href] = data
          evt.sender.send('promise', true)
        })
        .catch(function(err){
          console.error(err)
          evt.sender.send('promise', err)
        })
      })
    // REMOVE FAVORITE WITH HREF
      ipcMain.on('removeFavorite',(evt,href)=>{
        knex.table('FAVORITES').where({href:href}).del().then(function(){
          if(FAVORITES[href].cachedPath)
            fs.rmdir(FAVORITES[href].cachedPath,{recursive:true}, (err)=>{if(err) throw err})
          delete FAVORITES[href]
          evt.sender.send('promise', true)
        })
        .catch(function(err){
          console.error(err)
          evt.sender.send('promise', err)
        })
      })
    // UPDATE FAVORITE CACHE
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
    // READ FAVORITE CACHE
      ipcMain.on('readFavCache',(evt,_path)=>{
        evt.returnValue = JSON.parse(fs.readFileSync(`${_path}/result.json`))
      })

  // CONFIGURATION EVENTS
    // CONFIG SETTER
      ipcMain.on('setConfig',(evt,args)=>{
        let [key,val] = args
        CONFIG[key] = val
        evt.returnValue = true
      })
    // CONFIG GETTER
      ipcMain.on('getConfig',(evt,key)=>{
        evt.returnValue = CONFIG[key]
      })
    // SAVE CONFIG
      ipcMain.on('saveConfig',(evt)=>{
        fs.writeFileSync(path.join(__userdata,'config.json'), JSON.stringify(CONFIG,null,2))
      })

  // UPDATES EVENTS
    // LOAD UPDATES ON MAINWINDOW START
      ipcMain.on('getUpdates',(evt)=>{
        evt.returnValue = UPDATES
      })
  
  // CHAPTER MARK EVENTS
    // CHAPTERMARK GETTER
      ipcMain.on('getCHAPTERMARK',(evt)=>evt.returnValue=CHAPTERMARK)
    // CHAPTER MARK SETTER
      ipcMain.on('syncCHAPTERMARK',(evt,data)=>{
        CHAPTERMARK = data

        // CLEAN CHAPTERMARK OF EMPTY HREFS
          for(let [href,value] of Object.entries(CHAPTERMARK))
            if(value.READ.length == 0 && value.MARKED.length == 0)
              delete CHAPTERMARK[href]
        fs.writeFileSync(path.join(__userdata,'chapterdata.json'), JSON.stringify(CHAPTERMARK,null,2))
      })
  
// READER EVENTS
    // RETRIEVE LAYOUT POSITIONS
    ipcMain.on('getLayoutPositions',(evt)=>{
      evt.returnValue = POSITIONS
    })

    // SET LAYOUT POSITIONS
    ipcMain.on('setLayoutPositions',(evt,data)=>{
      POSITIONS = data
      for(let[id,val] of Object.entries(data)){
        if(val.changed){
          val.changed = false;
          knex.table('POSITIONS').where({id:id}).update(val).then()
        }
      }
    })

    // SPAWN READER WINDOW WITH DATA [ RAW_CHAPTERS , SELECTED CHAPTER INDEX , MANGA OBJ : { MANGA HREF , SOURCE KEY } ]
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

    // SHOW READER ON READY
      ipcMain.on('show-reader',(evt)=>{
        if(!readerWindow.isDestroyed()){
          readerWindow.show()
          mainWindow.hide()
        }
      })

    // RETURN TO MAIN WINDOW
      ipcMain.on('showMainFromReader',(evt)=>{
        readerWindow.close()
      })

// CHROME FILE DIALOG
  ipcMain.on('spawnFileDialog',(evt)=>{
    let returnVal =
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

    if(!returnVal)
      evt.returnValue = false // TURN UNDEFINED TO FALSE
    else
      evt.returnValue = returnVal[0]
  })

// HUMANIZE BYTES
  function humanizeBytes(bytes){
    let units = ['B','KB','MB','GB']
    let unit;
    let value = bytes
    for(unit of units){
        if((value/1024)<1) break
        value/=1024
    }
    return value.toFixed(2) + " " + unit
  }

// AUTO UPDATER
  var UPDATE_AVAILABLE = false
  autoUpdater.autoDownload = false
  autoUpdater.logger = _console

  function checkForMRIONUpdate(){
    autoUpdater.checkForUpdates().catch((err)=>{
      console.header('FAILED CHECKING FOR UPDATES',['bgRed','bold'])
      if(mainWindow.isVisible())
        mainWindow.webContents.send('mrionu-failedToCheck')
    })
  }
  checkForMRIONUpdate();

  autoUpdater.on('update-available', (res) => {
    console.header('MRION UPDATE AVAILABLE',['bgYellow','black','bold'])
    res.files[0].size = humanizeBytes(res.files[0].size) 
    if(TRAY_MODE){
      tray.setImage(iconWBubble)
      if(CONFIG.notify)
        tray.displayBalloon({
          icon:icon,
          iconType:'custom',
          title:'MRION',
          content: `Version ${res.version} available! Size: ${res.files[0].size}`,
          largeIcon:true
        })
    }
    else if(mainWindow.isVisible())
      mainWindow.webContents.send('mrionu-available',res)
    else if(readerWindow.isVisible())
      readerWindow.webContents.send('mrionu-available',res)
    UPDATE_AVAILABLE = res;
  });
  autoUpdater.on('update-not-available', () => {
    UPDATE_AVAILABLE = false
  });
  
  autoUpdater.on('update-downloaded', () => {
    console.header('MRION UPDATE DOWNLOADED',['bgYellow','black','bold'])
    mainWindow.webContents.send('mrionu-downloaded');
  });

  autoUpdater.on('download-progress', (_obj) => {
    let obj = {}
    obj.speed = humanizeBytes(_obj.bytesPerSecond)
    obj.trans = humanizeBytes(_obj.transferred)
    obj.total = humanizeBytes(_obj.total)
    obj.percent = _obj.percent
    mainWindow.webContents.send('download-progress',obj)
  })

  ipcMain.on('downloadUpdate',(evt)=>{
    autoUpdater.downloadUpdate()
  })

  ipcMain.on('mrionu-getUpdateStatus',(evt)=>evt.returnValue=UPDATE_AVAILABLE)
  ipcMain.on('mrionu-installUpdates',(evt)=>{
    autoUpdater.quitAndInstall()
  })

  
// FOR DEBUG
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
