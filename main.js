// MODULES
  const path = require('path')
  const {app, BrowserWindow, ipcMain,Tray, Menu, MenuItem, dialog} = require('electron')

  app.allowRendererProcessReuse = true

  const fs = require('fs')
  const axios = require('axios')
  const isDev = require('electron-is-dev');
  var schedule = require('node-schedule');
  const colors = require('colors')

  const {autoUpdater} = require('electron-updater')
// PATHS
  const icon = path.join(__dirname,'resources','img','iconsmallx.png')
  const iconWBubble = path.join(__dirname,'resources','img','iconsmall.png')
  var __userdata ;

if(isDev){
  // RELOAD ELECTRON ON RESOURCE CHANGE
  require('electron-reload')(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`),
    ignored:/userdata|resources[\/\\]img|logs|main.js|node_modules|[\/\\]\./
  });

  // SET USERDATA PATH TO ./userdata
  __userdata = path.join(__dirname,'userdata')
}
else{
  // SET USERDATA PATH TO ./userdata (FOR BUILT APPLICATION)
  __userdata = path.join(__dirname,'/../../userdata')
}
// LOGGER
if(!fs.existsSync(path.join(__userdata,'..','logs')))
      fs.mkdirSync(path.join(__userdata,'..','logs'))
  const DATESTAMP = new Date()
  const logger = require('electron-log')
  logger.transports.file.level = 'info';
  logger.transports.file.resolvePath =()=>path.join(__userdata,'..','logs',`${DATESTAMP.toDateString()}.mrionlog`);
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
    console.header("  STARTING MRION APP...                                                 ",['bgBrightMagenta','bold','grey'])
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
  var scheduler; 
  function createScheduler(){
    console.header("UPDATE SCHEDULE INITIALIZED",['bgBlue','bold'])
    CRON_TIMER = 
      '0 0 * * * *'
      // '*/20 * * * * *' // DEBUGGING
    scheduler = schedule.scheduleJob(CRON_TIMER,updateFunction);
  }
  // RUN SCHEDULER ON START
  createScheduler();


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

  var knex = require("knex")({
    client: "sqlite3",
    connection:{
      filename: "./userdata/data.db"
    },
    useNullAsDefault: true
  });
  var CONFIG = JSON.parse(fs.readFileSync(path.join(__userdata,"config.json")))
  var CHAPTERMARK  = JSON.parse(fs.readFileSync(path.join(__userdata,"chapterdata.json")))

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
    mainWindow.webContents.openDevTools({mode:'detach'})
    
    mainWindow.once('show',(evt)=>{
      autoUpdater.checkForUpdatesAndNotify();
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

    MENU_ITEM_PAUSE_SCHED = new MenuItem({label:'Pause Scheduler', type:'checkbox',click:pauseSchedulerItem})
    contextMenu.insert(1,MENU_ITEM_PAUSE_SCHED)
  
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
    if(mainWindow.isDestroyed())
      createMainWindow()
    else
      mainWindow.show()
    TRAY_MODE = false;
    tray.destroy()
  } 
    
  function pauseSchedulerItem(){
    let STATUS = pauseSchedulerMenuItem.checked
    if(STATUS){
      console.header('UPDATE SCHEDULE IS PAUSED ',['bgGreen','bold'])
      scheduler.cancel()
    }
    else
      createScheduler()
  }


// APP EVENT LISTENERS
  // CREATE TRAY/MAINWINDOW ON APP READY
    app.whenReady().then(function(){
      if(process.argv[2]=='tray'){
        createTray()
      }
      else 
          // createReaderWindow() 
          createMainWindow()
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

// AUTO UPDATER EVENTS
  autoUpdater.on('mrionu-available', () => {
    console.header('MRION UPDATE AVAILABLE',['bgYellow','bold'])
    mainWindow.webContents.send('update_available');
  });
  autoUpdater.on('mrionu-downloaded', () => {
    console.header('MRION UPDATE DOWNLOADED',['bgYellow','bold'])
    mainWindow.webContents.send('update_downloaded');
  });


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
