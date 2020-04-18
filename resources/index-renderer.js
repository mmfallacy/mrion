const {ipcRenderer:main, remote} = require('electron');
window.$ = require('jquery')
const {Mangakakalots} = require('./resources/source.js');

// | SOURCES 
    let SOURCES = {
        mangakakalots:{
            obj: new Mangakakalots('https://mangakakalots.com/'),
            name: "Mangakakalots",
            key:'mangakakalots',
        }
    }
    var MRION = {
        internalSource:0,
        get CURRENT_SOURCE(){
            return this.internalSource
        },
        set CURRENT_SOURCE(obj){
            this.internalSource = obj;
            this.sourceListener(obj)
        },
        sourceListener: (newObj)=>{
            $(".content").filter('#search, #home, #genrelist')
                .find('.overlay')
                    .fadeOut(function(){
                        $(this).parent()
                            .removeClass('no-source')
                    })
            $(".content#search #searchClear").click()
        }
    }

// CHAPTER MARK
    let CHAPTERMARK = main.sendSync('getCHAPTERMARK')

// FAVORITES
    let FAVORITES = main.sendSync('getFavorites')
// | SIDEBAR
    $('.side-bar').children('button').each(function(){
        $(this).prepend($(main.sendSync('requestSvg',`${this.id}.svg`)))
    });
    $('.side-bar button.navlink').click(function(){
        $('button.navlink')
            .removeClass('active')
            .filter(`#${this.id}`)
            .addClass('active')

        $('.content')
            .fadeOut()
            .filter(`#${this.id}`)
            .fadeIn()
        // ** ACTIVATE SOURCE SELECT ON CERTAIN CONTENT ELEMENTS ONLY
        if(['search','home','genrelist'].includes(this.id))
            $('.source-select').slideDown().css('display','flex')
        else 
        $('.source-select').slideUp()
    })

// | TITLEBAR
    $('.title-bar button').click(function(){
        if(this.id=='close-electron')
            showModal('closePrompt')
        else
            main.send(this.id)
    })

// | MODALS
    function showModal(id){
        $('.modal-content')
            .hide()
            .filter(`#${id}`)
            .show()
        $('.modal-bg').fadeIn()
    }
    $('.modal-content #closeModal')
        .click(()=>$('.modal-bg').fadeOut())

// | SOURCE SELECT{
    $('.source-select #changeSource')
        .click(()=>showModal('changeSource'))
    // ** ADD OPTIONS TO MODAL
        for(let [key,value] of Object.entries(SOURCES))
            $('.modal-content#changeSource .source-list')
                .append(`<button class="source" id="${key}">${value.name}</button>`)
    // ** CLICK HANDLER
        $('.modal-content#changeSource .source-list')
            .on('click','.source',function(){
                changeSourceTo(this.id)
                $(this).parent().find('.source')
                    .removeClass('active')
                $(this).addClass('active')
                $('.modal-bg').fadeOut()
            })
        function changeSourceTo(key){
            MRION.CURRENT_SOURCE = SOURCES[key]
            $('.source-select')
                .find('.selected')
                    .hide()
                    .html(MRION.CURRENT_SOURCE.name)
                    .fadeIn()
                    .end()
        }

// | Search Content
    bindSTTToSelector($('.content#search'))
    $('.content#search .searchBar')
        .find('#searchInput')
            .keydown(function(e){
                switch(e.which){
                    case 13:
                        $(this).siblings('#searchSubmit')
                            .click()
                    break;
                    case 46:
                        $(this).siblings('#searchClear')
                            .click()
                    break;
                }
            }).end()
        .find('#searchSubmit')
            .click(function(){
                let keywords = $(this).siblings('#searchInput').val()
                console.log(keywords)
                $searchResults = $('.content#search').find('.searchResults')
                $searchResults
                    .addClass('loading')
                    .find('.loading-wrapper')
                        .fadeIn(function(){
                            $(this).parent()
                                .find('#keywords')
                                .hide()
                                .html(keywords)
                                .fadeIn()
                        })
                
                MRION.CURRENT_SOURCE.obj.searchSourceFor(keywords)
                    .then(function(result){
                        // REMOVE LOADER
                        console.table(result)
                        $searchResults
                            .find('.loading-wrapper')
                                .fadeOut(function(){
                                    $(this).parent()
                                        .removeClass('loading')
                                }).end()
                            .find('.manga-wrapper#search')
                                .empty()
                        for(manga of result)
                            $searchResults.find('.manga-wrapper#search')
                                .append(deserializeMangaObj(manga))
                    })
                    .catch(function(err){
                        $searchResults
                            .find('.loading-wrapper')
                                .fadeOut(function(){
                                    $(this).parent()
                                        .removeClass('loading')
                                }).end()
                            .find('.manga-wrapper#search')
                                .empty()
                        spawnErrorPopup(err)
                    })
            }).end()
        .find('#searchClear')
            .click(function(){
                $(this).siblings('#searchInput').val('')
                $('.content#search').find('.searchResults')
                    .find('#keywords')
                        .fadeOut(function(){
                            $(this)
                                .html('')
                        }).end()
                    .find('.manga-wrapper#search').children()
                        .fadeOut(function(){
                            $(this).remove()
                        })
            })

// | ScrollToTop Event
    function bindSTTToSelector($selector){
        $selector
        .scroll(function(){
            if($(this).scrollTop()>$(this).height())
                $selector.find('#scrollToTop').fadeIn()
            else 
                $selector.find('#scrollToTop').fadeOut()
        })
        $selector.find('#scrollToTop')
            .click(function(){
                $selector.stop().animate({scrollTop:0}, 500, 'swing');
            })
    }

// MANGA OBJECT TEMPLATE
    const mangaTemplate = $(`
        <div class="manga">
            <img onerror="this.src='./resources/img/manga-placeholder.png'">
            <div id="rating">
                <span class="ri-star-line"></span>
                <span class="ri-star-line"></span>
                <span class="ri-star-line"></span>
                <span class="ri-star-line"></span>
                <span class="ri-star-line"></span>
            </div>
            <div class="manga-info">
                <span id="latestChap">CHAP</span>
                <span class="label">Latest Chapter:</span>
                <hr>
                <span id='title'>TITLE</span>
            </div>
            <div class="bubble"></div>
        </div>
        `)
// DESERIALIZATION OF MANGA OBJECT (OBJ->NODE)
    function deserializeMangaObj(obj){
        let $manga = mangaTemplate.clone()
        $manga.find('#title')
            .html(obj.title)
            
        $manga.find('img')
            .prop('src',obj.cachedImage || obj.image)

        if(obj.cachedPath){
            $manga.data('cached', true)
            $manga.data('cachedPath', obj.cachedPath)
        }
        else 
            $manga.data('cached', false)

        if(!obj.latestChap)
            $manga.find('#latestChap, #latestChap+.label')
                .hide()
        else
            $manga.find('#latestChap')
                .html(obj.latestChap)

        if(obj.rating==-1) 
            $manga.find('#rating').hide()
        else
            $manga.find('#rating span').each(function(i){
                if(obj.rating-i>.75) $(this).attr('class','ri-star-fill')
                else if(obj.rating-i>.25) $(this).attr('class','ri-star-half-line')
            })

        $manga
            .data('rating', obj.rating)
            .data('href', obj.href)
            .data('source', SOURCES[obj.sourceKey])
            .data('isFavorite', false)
        return $manga
    }
// SERIALIZATION OF MANGA OBJ (NODE -> OBJ)
    function serializeMangaNode($node){
        let obj = {}
        obj.title = $node.find('#title').html()
            
        obj.image = $node.find('img').prop('src')

        obj.latestChap = $node.find('#latestChap').html()
        
        obj.rating = $node.data('rating')

        obj.href = $node.data('href')

        obj.sourceKey = $node.data('source').key

        return obj
    }
// SERIALIZATION OF SELECT MANGA
    function populateSelectManga(result,href,source,isFavorite,mangaObj){
        let $selectManga = $('.selectedManga')
        var chapterTemplate = $(`
                <div class="chapter">
                    <span class="ri-eye-fill" id="ch-eye"></span>
                    <span class="ri-markup-fill" id="ch-mark"></span>
                    <span class="text"></span>
                    <span class='date'></span>
                </div>
                `)
            result.info.genres.map(function(value){
                $selectManga.find('#genres')
                    .append(`<span class='genre'>${value}</span>`)
            })
            var hasCHAPDATA = false;
            if(Object.keys(CHAPTERMARK).includes(href)){
                var {READ,MARKED} = CHAPTERMARK[href]
                hasCHAPDATA = true;
            }
            result.chapters.map(function(obj, i){
                let $chapter = chapterTemplate.clone()
                $chapter
                    .data('href', obj.href)
                    .data('index', i)
                    .find('.text')
                        .html(obj.text)
                        .end()
                    .find('.date')
                        .html(obj.date)
                        .end()

                $selectManga.find('#chapter-list')
                    .append($chapter)

                if(!hasCHAPDATA) return

                if(MARKED.includes(i)) $chapter.addClass('marked')
                if(READ.includes(i)) $chapter.addClass('read')
            })
            $selectManga
                .data('href',href)
                .data('source-group',source.key)
                .data('mangaObj', mangaObj)
                .data('result',result)
                .find('#title')
                    .html(result.title)
                    .end()
                .find('.img-wrapper img')
                    .prop('src', result.image)
                    .end()
                .find('#toggleFavorite')
                    .addClass((isFavorite)?'active':'')
                    .removeClass('tempDisabled')
                    .end()
                .find('#status .text')
                    .html(result.info.status)
                    .end()
                .find('#chapters .text')
                    .html(result.chapters.length)
                    .end()
                .find('#chapter-list')
                    .data('href', href)
                    .scrollTop(0)
                    .end()
                .find('#altTitle')
                    .html(result.altTitles.join(', '))
                    .end()
                .find('#authors')
                    .html(result.info.author.join(', '))
                    .end()
                .find('#rating')
                    .html(result.info.rating)
                    .end()
                .find('#description')
                    .html(result.description)
                    .end()
    }
// MANGA SELECT HANDLER
    //* Height of desc set
    function reflowSMHeight(){
        let $parent = $('.selectedManga .main-container')
        let heightTaken = $parent.children('.header-wrapper').height()
        
        $parent.find('.desc-wrapper, .cl-wrapper')
            .height($parent.height() - heightTaken)
    }
    $('.selectedManga #smBack').click(function(){
        let $selectManga = $(this).parent()
        $selectManga
            .fadeOut(function(){
                $(this)
                    .find('.cl-wrapper .header')
                        .click()
                        .end()
                    .removeClass('cached')
                    .removeData('href')
                    .removeData('source-group')
                    .removeData('mangaObj')
                    .find('#genres')
                        .empty()
                        .end()
                    .find('#toggleFavorite')
                        .removeClass('active')
                        .end()
                    .find('#chapter-list')
                        .empty()
                        .end()
                        .find('#title')
                        .html("TITLE")
                        .end()
                    .find('.img-wrapper img')
                        .prop('src', './resources/img/manga-placeholder.png')
                        .end()
                    .find('#status .text')
                        .html('STATUS')
                        .end()
                    .find('#chapters .text')
                        .html("CHAP")
                        .end()
                    .find('#altTitle')
                        .html("ALT TITLE")
                        .end()
                    .find('#authors')
                        .html("AUTHOR")
                        .end()
                    .find('#rating')
                        .html("RATE")
                        .end()
                    .find('#description')
                        .html(`
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                        `)
                        .end()
                    .addClass('loading')
            })
    })
    $('.selectedManga .desc-wrapper .header').click(function(){
        $(this).parent()
            .fadeOut(function(){
                $(this).siblings('.cl-wrapper')
                    .fadeIn()
            })
    })
    $('.selectedManga .cl-wrapper .header').click(function(){
        $(this).parent()
            .fadeOut(function(){
                $(this).siblings('.desc-wrapper')
                    .fadeIn()
            })
    })
    $('.selectedManga #chapter-list').on('click', '.chapter', function(){
        let $parent = $(this).parent()
        let index = $(this).data('index')
        let href = $(this).parent().data('href')
        if($parent.hasClass('readToggle')||$parent.hasClass('markToggle')){
            let tclass = ($parent.hasClass('readToggle'))?'read':'marked'
            if($(this).hasClass(tclass)){
                $(this).removeClass(tclass)
                CHAPTERMARK[href][tclass.toUpperCase()] = CHAPTERMARK[href][tclass.toUpperCase()].filter(el=>el!==index)
            }
            else{
                $(this).addClass(tclass)
                if(!Object.keys(CHAPTERMARK).includes(href)) CHAPTERMARK[href] = {READ:[],MARKED:[]}
                CHAPTERMARK[href][tclass.toUpperCase()].push(index)
            }
            return
        }
        else{
            // TOGGLE READ ON FIRST TIME READ
            if(!Object.keys(CHAPTERMARK).includes(href)) CHAPTERMARK[href] = {READ:[],MARKED:[]}
            if(!CHAPTERMARK[href].READ.includes(index)){
                CHAPTERMARK[href].READ.push(index)
                $(this).addClass('read')
                main.send('syncCHAPTERMARK', CHAPTERMARK)
            }
            console.log('chapter clicked')
        }
    })
    // FAVORITE
        $('.selectedManga .button-wrapper #toggleFavorite').click(function(){
            let STATUS = $(this).hasClass('active')
            let href = $('.selectedManga').data('href')
            let SGID = $('.selectedManga').data('source-group')
            let mangaObj = $('.selectedManga').data('mangaObj')
            let cachedResult = $('.selectedManga').data('result')
            let $this = $(this)
            if($this.hasClass('tempDisabled')) {
                spawnErrorPopup('Please do not spam the Favorite button.', 'warning')
                return;
            }
            $this.addClass('tempDisabled')
            console.log('test')
            setTimeout(()=>$this.removeClass('tempDisabled'),2000)
            if(STATUS){
                
                main.send('removeFavorite',href)
                main.once('promise', (event,resolved)=>{
                    if(resolved){
                        $('.content#favorites').find(`.source-group#${SGID}`)
                            .find('.manga').filter(function(){return $(this).data('href')===href})
                                .remove()
                        $(this).removeClass('active')
                    }
                    else{
                        console.log('error')
                        spawnErrorPopup(resolved)
                    }
                })
            }
            else{
                main.send('addFavorite',[mangaObj,cachedResult])
                main.once('promise', (event,resolved)=>{
                    if(resolved){
                        let $manga = deserializeMangaObj(mangaObj)
                        $manga.data('isFavorite',true)
                        $('.content#favorites').find(`.source-group#${SGID}`)
                            .find('.manga-wrapper')
                                .append($manga)
                        $(this).addClass('active')
                    }
                    else{
                        spawnErrorPopup(resolved)
                    }
                })
            }
        });
        $('.selectedManga .button-wrapper button:not(#toggleFavorite)').click(function(){
            let tclass = (this.id==='toggleRead')?'readToggle':'markToggle';
            if($(this).hasClass('active')){
                // DISABLE BUTTON
                $('.selectedManga #smBack')
                    .prop('disabled',false)

                $(this).siblings().not('#toggleFavorite')
                    .prop('disabled',false)
                $(this).removeClass('active')
                $('.selectedManga').find('#chapter-list')
                    .removeClass(tclass)
                main.send('syncCHAPTERMARK', CHAPTERMARK)
            }
            else{
                $('.selectedManga #smBack')
                    .prop('disabled',true)
                $(this).siblings().not('#toggleFavorite').prop('disabled',true)
                $(this).addClass('active')
                $('.selectedManga').find('#chapter-list')
                    .addClass(tclass)
            }
        });
    $('html').on('click','.manga-wrapper .manga',
        function(){
            let href = $(this).data('href')
            let source = $(this).data('source')
            let isFavorite = $(this).data('isFavorite')
            let $selectManga = $('.selectedManga')
            let mangaObj = serializeMangaNode($(this))
            let $this = $(this)
            $selectManga
                .addClass('loading')
                .find('.loading-wrapper')
                    .fadeIn(function(){
                        $selectManga
                            .fadeIn()
                            .css('display','flex')
                        source.obj.scanMangaHref(href)
                            .then(function(result){
                                console.log('FRESH')
                                if($this.data('cached'))
                                    main.send('updateFavCache',[result,$this.data('cachedPath')])
                                populateSelectManga(result,href,source,isFavorite,mangaObj)
                                reflowSMHeight()
                                $selectManga
                                    .find('.loading-wrapper')
                                        .fadeOut(function(){
                                            $(this).parent()
                                                .removeClass('loading')
                                        })
                            })
                            .catch(function(err){
                                if($this.data('cached')){
                                    console.log('CACHED')
                                    spawnErrorPopup('Using Cached Mode due to '+err, 'warning')
                                    $selectManga.addClass('cached')
                                    let result = main.sendSync('readFavCache',$this.data('cachedPath'))
                                    result.image = $this.find('img').prop('src')
                                    populateSelectManga(result,href,source,isFavorite,mangaObj)
                                    reflowSMHeight()
                                    $selectManga
                                        .find('.loading-wrapper')
                                            .fadeOut(function(){
                                                $(this).parent()
                                                    .removeClass('loading')
                                            })
                                    return
                                }
                                $selectManga.find('#smBack').click()
                                spawnErrorPopup(err)
                            })
                    });
        });
// FAVORITES HANDLER
    // APPEND CURRENT SOURCES AS SG
    (function appendSourcesSG(){
        let SGTemplate = $(`
            <div class="source-group">
                <div class="header">
                    <h3></h3>
                    <hr>
                </div>
                <div class="manga-wrapper">
                </div>
                </div>
            </div>
        `)
        for(const [key,value] of Object.entries(SOURCES)){
            let $SG = SGTemplate.clone()
            $SG
                .attr('id', key)
                .find('.header h3')
                    .html(value.name)
            $('.content#favorites')
                .append($SG)
        }
    })();
    // APPEND CURRENT FAVORITES TO SG
    (function appendFavoritesToSG(){
        for(const [href,obj] of Object.entries(FAVORITES)){
            let $manga = deserializeMangaObj(obj)
            $manga.data('isFavorite', true)
            $('.content#favorites').find(`.source-group#${obj.sourceKey}`).find('.manga-wrapper')
                .append($manga)
        }
    })();
    // SOURCE-GROUP HANDLER
        $('.content#favorites').on('click','.source-group .header',function(){
            let $this = $(this).parent()
            if($this.hasClass('expand')){
                $this
                    .height(45)
                    .removeClass('expand')
            }
            else{
                $this
                    .height($this.find('.manga-wrapper').height() + 55)
                    .addClass('expand')
            }
        })

// SPAWN ERROR POPUP
    function spawnErrorPopup(msg,type){
        let id = type || 'error'
        let $popup = $(`.popup#${id}`)
        $popup
            .find('#msg')
                .html(msg)
                .end()
            .fadeIn()
            .css('display','flex')
        
        setTimeout(function(){
            $popup
                .fadeOut(function(){
                    $(this).find('#msg')
                        .html('')
                })
        },5000)
    }
$('.navlink#favorites').click()


// const Menu = remote.require('electron').Menu
// const MenuItem = remote.require('electron').MenuItem

// let rightClickPosition = null

// const menu = new Menu()
// const menuItem = new MenuItem({
//   label: 'Inspect Element',
//   click: () => {
//     remote.getCurrentWindow().inspectElement(rightClickPosition.x, rightClickPosition.y)
//   }
// })
// menu.append(menuItem)

// window.addEventListener('contextmenu', (e) => {
//   e.preventDefault()
//   rightClickPosition = {x: e.x, y: e.y}
//   menu.popup(remote.getCurrentWindow())
// }, false)