const {ipcRenderer:main, remote} = require('electron');
window.$ = require('jquery')
const anime = require('animejs')
const Mousetrap = require('mousetrap')
const moment = require('moment')

// | LOGGER
    window.onerror = function (msg, url, ln) {
        main.send('window-error',[msg,url,ln])
        return false;
    }
// | SOURCES 
    let SOURCES = remote.getGlobal('SOURCES')
    let UPDATES = main.sendSync("getUpdates")
    var MRION = {
        internalSource:false,
        internalMainPage:1,
        TOTAL_MANGA_PAGE:2,
        internalGenrePage:1,
        TOTAL_GENRE_PAGE:2,
        CURRENT_SEARCH_PAGE:1,
        TOTAL_SEARCH_PAGE:2,
        internalFavoritesBubble:0,
        get FAVORITES_BUBBLE(){
            return this.internalFavoritesBubble
        },
        set FAVORITES_BUBBLE(val){
            this.internalFavoritesBubble = val;
            if(val<=0)
                $('button.navlink#favorites').children('.bubble').fadeOut()
            else
                $('button.navlink#favorites').children('.bubble').fadeIn()
            
        },
        get CURRENT_SOURCE(){
            return this.internalSource
        },
        set CURRENT_SOURCE(obj){
            this.sourceListener(obj)
        },
        get CURRENT_MANGA_PAGE(){
            return this.internalMainPage;
        },
        set CURRENT_MANGA_PAGE(value){
            this.internalMainPage = value
        },
        get CURRENT_GENRE_MANGA_PAGE(){
            return this.internalGenrePage;
        },
        set CURRENT_GENRE_MANGA_PAGE(value){
            this.internalGenrePage = value
        },
        sourceListener: function(newObj){
            this.internalMainPage = 1;
            this.internalGenrePage = 1;
            this.TOTAL_MANGA_PAGE = 2;
            this.TOTAL_GENRE_PAGE = 2;

            if(!this.internalSource){
                $(".content").filter('#search, #home, #genrelist')
                    .data('disabled',false)
                    .find('.overlay')
                        .fadeOut(function(){
                            $(this).parent()
                                .removeClass('no-source')
                        })
            }
            else{
                //CLEAR MANGA WRAPPERS
                $('.global-loading-wrapper')
                        .fadeIn(function(){
                            $(".content").filter('#search, #home, #genrelist')
                                .find('.manga-wrapper')
                                    .empty()
                                    .end()
                                .filter('#genrelist')
                                    .find('.genre-wrapper')
                                        .empty()
                        })
                setTimeout(()=>$('.global-loading-wrapper').fadeOut(),2000)
            }
            
            this.internalSource = newObj;
            
            let visibleContent = $(".content:visible").attr('id')

            if(visibleContent === 'home')
                updateHomeMangaList(this.internalMainPage)
            else 
                $('.navlink#home').one('click',()=>updateHomeMangaList(this.internalMainPage))
            
            if(visibleContent === 'genrelist'){
                getGenreList()
            }
            else
            $('.navlink#genrelist').one('click',()=>getGenreList())
                
            
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
    $('.side-bar button.clickable')
        .mousedown(function(){
            $(this).addClass('active')
        })
        .mouseup(function(){
            $(this).removeClass('active')
        })
        .filter('#update')
            .click(function(){
                showModal('updatePrompt')
            }).end()
        .filter('#bug-report')
            .click(function(){
                showModal('bugReport')
            })
// | TITLEBAR
    $('.title-bar button').click(function(){
        if(this.id=='close-prompt')
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
    $('#closePrompt')
        .find('button')
            .click(function(){
                main.send(this.id)
            })
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
    function searchSourceFor(keywords,page){
        MRION.CURRENT_SOURCE.obj.searchFor(keywords,page)
        .then(([result,totalPage])=>{
            // REMOVE LOADER
            if(totalPage)MRION.TOTAL_SEARCH_PAGE = totalPage
            $searchResults
                .find('.loading-wrapper')
                    .fadeOut(function(){
                        $(this).parent()
                            .removeClass('loading')
                    }).end()
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
            spawnPopup(err)
        })

    }
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
                $(this).parent().data('keywords',keywords)
                $('.content#search').data('disabled',false)
                $searchResults = $('.content#search').find('.searchResults')
                MRION.CURRENT_SEARCH_PAGE = 1
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
                        .end()
                    .find('.manga-wrapper#search')
                        .empty()
                searchSourceFor(keywords,MRION.CURRENT_SEARCH_PAGE)
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
    $('.content#search')
        .data('disabled',false)
        .scroll(function(){
            if($(this).find('.manga-wrapper').children('.manga').length<1) return;
        
            if($(this).scrollTop()>$(this).height())
                $(this).find('#scrollToTop').fadeIn()
            else 
                $(this).find('#scrollToTop').fadeOut()
            
            let hasReachedBottom = ($(this).scrollTop()+$(this).innerHeight()>=this.scrollHeight)
            if(hasReachedBottom && !$(this).data('disabled')){
                let keywords = $(this).find('.searchBar').data('keywords')
                console.log(MRION.CURRENT_SEARCH_PAGE,MRION.TOTAL_SEARCH_PAGE)
                if(++MRION.CURRENT_SEARCH_PAGE>=MRION.TOTAL_SEARCH_PAGE){
                    spawnPopup('No more search results!','info')
                    $(this).data('disabled',true)
                }
                else
                    searchSourceFor(keywords,MRION.CURRENT_SEARCH_PAGE)
            }
        }).end()
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
        if(obj.cachedPath){
            $manga.data('cached', true)
            $manga.data('cachedPath', obj.cachedPath)
            obj.cachedImage = `${obj.cachedPath}/image.` + obj.image.split('.').pop()
            console.log(obj.cachedImage)
        }
        else 
            $manga.data('cached', false)


        $manga.find('#title')
            .html(obj.title)
            
        $manga.find('img')
            .prop('src',obj.cachedImage || obj.image)

        if(!obj.latestChapter)
            $manga.find('#latestChap, #latestChap+.label')
                .hide()
        else
            $manga.find('#latestChap')
                .html(obj.latestChapter)

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
        return $manga
    }
// SERIALIZATION OF MANGA OBJ (NODE -> OBJ)
    function serializeMangaNode($node){
        let obj = {}
        obj.title = $node.find('#title').html()
            
        obj.image = $node.find('img').prop('src')

        obj.latestChapter = $node.find('#latestChap').html()
        
        obj.rating = $node.data('rating')

        obj.href = $node.data('href')

        obj.sourceKey = $node.data('source').key

        if($node.data('cached')){
            obj.cachedPath = $node.data('cachedPath')
        }
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
                    .data('raw',result.chapters)
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
                $(this)
                    .siblings('.cl-wrapper')
                        .fadeIn()
                    .children('#chapter-list')
                        .scrollTop(0)
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
            $('.reader-loading-wrapper').fadeIn()
            readerAnimation.start()
            main.send('spawnReaderWindow', [$(this).parent().data('raw'),index,$('.selectedManga').data('mangaObj')])
            main.once('readerInitialized',()=>{
                readerAnimation.finish()
            })
        }
    })
    // FAVORITE
        $('.selectedManga .button-wrapper #toggleFavorite').click(function(){
            let STATUS = $(this).hasClass('active')
            let href = $('.selectedManga').data('href')
            let SGID = $('.selectedManga').data('source-group')
            let mangaObj = $('.selectedManga').data('mangaObj')
            // LOAD CURRENT CACHED RESULT
            let cachedResult = $('.selectedManga').data('result')
            let $this = $(this)
            if($this.hasClass('tempDisabled')) {
                spawnPopup('Please do not spam the Favorite button.', 'warning')
                return;
            }
            $this.addClass('tempDisabled')
            setTimeout(()=>$this.removeClass('tempDisabled'),2000)
            if(STATUS){
                
                main.send('removeFavorite',href)
                main.once('promise', (event,resolved)=>{
                    if(resolved){
                        delete FAVORITES[href]
                        $('.content#favorites').find(`.source-group#${SGID}`)
                            .find('.manga').filter(function(){return $(this).data('href')===href})
                                .remove()
                        $(this).removeClass('active')
                    }
                    else{
                        console.error('ERROR')
                        spawnPopup(resolved)
                    }
                })
            }
            else{
                main.send('addFavorite',mangaObj)
                main.once('promise', (event,resolved)=>{
                    if(resolved){
                        main.send('updateFavCache',[cachedResult,href,SGID])
                        FAVORITES[href] = mangaObj
                        let $manga = deserializeMangaObj(mangaObj)
                        
                        $('.content#favorites').find(`.source-group#${SGID}`)
                            .find('.manga-wrapper')
                                .append($manga)
                        $(this).addClass('active')
                    }
                    else{
                        spawnPopup(resolved)
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
            let isFavorite = Object.keys(FAVORITES).includes(href)
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
                        source.obj.scrapeManga(href)
                            .then((result)=>{
                                console.log('FRESH')
                                if($this.data('cached'))
                                    main.send('updateFavCache',[result,href,source.key])
                                populateSelectManga(result,href,source,isFavorite,mangaObj)
                                reflowSMHeight()
                                $selectManga
                                    .find('.loading-wrapper')
                                        .fadeOut(function(){
                                            $(this).parent()
                                                .removeClass('loading')
                                        })
                            })
                            .catch((err)=>{
                                if($this.data('cached')){
                                    console.log('CACHED')
                                    spawnPopup('Using Cached Mode due to '+err, 'warning')
                                    $selectManga.addClass('cached')
                                    let result = main.sendSync('readFavCache',$this.data('cachedPath'))
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
                                spawnPopup(err)
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

// HOME HANDLER
    function updateHomeMangaList(page){
        let $parent = $('.content#home')
        $parent.find('.loading-wrapper')
            .fadeIn()
        MRION.CURRENT_SOURCE.obj.scrapeDiscover(page)
            .then(([result,totalPage])=>{
                if(totalPage)MRION.TOTAL_MANGA_PAGE = totalPage
                result.map((obj)=>{
                    let $manga = deserializeMangaObj(obj)
                    $manga.hide()
                    $parent.find('.manga-wrapper').append($manga)
                })
            })
            .then(()=>{
                $parent
                    .find('.loading-wrapper')
                        .fadeOut()
                        .end()
                    .find('.manga-wrapper').children('.manga')
                        .fadeIn(600)
            })
        console.log('PAGE:' + page)
    }
    bindSTTToSelector($('.content#home'))
    $('.content#home')
        .data('disabled',false)
        .scroll(function(){
            if($(this).find('.manga-wrapper').children('.manga').length<1) return;
            
            if($(this).scrollTop()>$(this).height())
                $(this).find('#scrollToTop').fadeIn()
            else 
                $(this).find('#scrollToTop').fadeOut()
            
            let hasReachedBottom = ($(this).scrollTop()+$(this).innerHeight()>=this.scrollHeight)
            if(hasReachedBottom && !$(this).data('disabled')){
                if(++MRION.CURRENT_MANGA_PAGE >= MRION.TOTAL_MANGA_PAGE){
                    spawnPopup('End of Discover','info')
                    $(this).data('disabled',true)
                }
                else updateHomeMangaList(MRION.CURRENT_MANGA_PAGE)
            }
        })
// GENRELIST
    function getGenreList(){
        let genreTemplate = $(`<div class="genre"></div>`)
        let $parent = $('.content#genrelist')
        $parent.find('.genre-list').find('.loading-wrapper')
            .fadeIn()
        MRION.CURRENT_SOURCE.obj.scrapeGenreList().then((result)=>{
            for(const [genre,href] of Object.entries(result)){
                let $genre = genreTemplate.clone()
                $genre.html(genre)
                $genre.data('href',href)
                $parent.find('.genre-wrapper').append($genre)    
            }
        }).then(()=>{
            $parent.find('.genre-list')
            .find('.loading-wrapper')
                .fadeOut()
                .end()
            .find('.genre-wrapper').children('.genre')
                .fadeIn(600)
        })
    }
    function updateGenreMangaList(page){
        let $parent = $('.content#genrelist')
        let href = $parent.find('#currentGenre').data('href')
        $parent.children('.loading-wrapper')
            .fadeIn()
        MRION.CURRENT_SOURCE.obj.scrapeGenre(href,page)
            .then(([result,totalPage])=>{
                if(totalPage)MRION.TOTAL_GENRE_PAGE = totalPage
                result.map((obj)=>{
                    let $manga = deserializeMangaObj(obj)
                    $manga.hide()
                    $parent.find('.manga-wrapper').append($manga)
                })
            })
            .then(()=>{
                $parent
                    .children('.loading-wrapper')
                        .fadeOut()
                        .end()
                    .find('.manga-wrapper').children('.manga')
                        .fadeIn(600)
            })
        console.log('G-PAGE:' + page)
    }
    $('.content#genrelist .genre-wrapper').on('click','.genre',function(){
        let $parent = $('.content#genrelist')
        $(this)
            .siblings()
                .removeClass('active')
                .end()
            .addClass('active')
        MRION.CURRENT_GENRE_MANGA_PAGE = 1;
        $parent
            .find('#currentGenre')
                .html($(this).html())
                .data('href',$(this).data('href'))
                .parent()
                    .hide()
                    .fadeIn(600)
                    .end()
                .end()
            .find('.manga-wrapper')
                .children()
                    .fadeOut(function(){
                        $(this).remove()
                    })
        updateGenreMangaList(MRION.CURRENT_GENRE_MANGA_PAGE)     
    })
    bindSTTToSelector($('.content#genrelist'))
    $('.content#genrelist')
        .data('disabled',false)
        .scroll(function(){
            if($(this).find('.manga-wrapper').children('.manga').length<1) return;
            
            if($(this).scrollTop()>$(this).height())
                $(this).find('#scrollToTop').fadeIn()
            else 
                $(this).find('#scrollToTop').fadeOut()
            
            let hasReachedBottom = ($(this).scrollTop()+$(this).innerHeight()>=this.scrollHeight)
            if(hasReachedBottom && !$(this).data('disabled')){
                if(++MRION.CURRENT_GENRE_MANGA_PAGE>=MRION.TOTAL_GENRE_PAGE){
                    spawnPopup('No more mangas in this Genre!','info')
                    $(this).data('disabled',true)
                }
                else updateGenreMangaList(MRION.CURRENT_GENRE_MANGA_PAGE)
            }
        });
// READER LOADING

    (function encloseLetterInSpan(){
        var $wrapper = $('.reader-loading-wrapper .text')
        $wrapper.html($wrapper.text().replace(/\S/g,"<span class='letter'>$&</span>"))
    })();
    var readerAnimation = {
        internalStart :[
                // TEXT
                anime({
                    targets: '.reader-loading-wrapper .text .letter',
                    opacity: [
                        {
                            value:1,
                            easing: "easeInOutQuad",
                            duration: 750,
                        },
                        {
                            value:0,
                            easing: "easeInOutQuad",
                            duration: 750,
                        }
                    ],
                    autoplay:false,
                    loop:true,
                    delay: anime.stagger(100)   
                },0),
            //LOGO
            anime({
                targets:'.reader-loading-wrapper .logo-wrapper .background',
                rotate:'1turn',
                loop:true,
                autoplay:false,
                easing: "linear",
                duration:2250
            },0)
        ],
        start: function(){
            for(let animation of this.internalStart)
                animation.play()
        },
        internalFinish:
            anime.timeline({autoplay:false,easing:'easeInQuad'})
                .add({
                    targets:'.reader-loading-wrapper .logo-wrapper .background',
                    borderRadius:{
                        value:'10rem',
                        easing: "easeInCirc",
                        duration:1250
                    },
                    height:'100%',
                    width:'100%',
                    top:'0%',
                    left:'0%',
                    easing: "easeInQuad",
                    duration:1000
                })
                .add({
                    targets:'.reader-loading-wrapper .text',
                    opacity:0,
                    easing: "easeInQuad",
                    duration:500,
                })
                .add({
                    targets:'.reader-loading-wrapper .logo-wrapper .foreground',
                    opacity:0,
                    easing: "easeInQuad",
                    duration:500,
                })
                .add({
                    targets:'.reader-loading-wrapper .clipped',
                    clipPath:[
                        'circle(5vh at 50vw 34vh)',
                        'circle(100vh at 50vw 34vh)',
                    ],
                    easing: "easeInExpo",
                    duration: 1250,
                },1000),
        finish: function(){
            this.internalFinish.play()
            this.internalFinish.finished
                .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
                .then(()=>{
                    main.send('show-reader')
                    $('.reader-loading-wrapper').fadeOut(
                        ()=>{
                            for(let animation of this.internalStart){
                                animation.seek(0)
                            }
                            this.internalFinish.seek(0)
                        }
                    )
                })
        }
    };
    
// HANDLE UPDATES
    main.on('favoritesUpdate', (evt,UPDATES) =>{
        parseUpdates(UPDATES)
    });
    main.on('spawnInfoOnUpdates', (evt,number) =>{
        spawnPopup(number + ` manga${(number>1)?'s':''} updated!`,'info')
    });
    function parseUpdates(updates){
        if(!updates) return
        for(let[href, obj] of Object.entries(updates)){
            if(typeof obj === 'boolean') continue
            MRION.FAVORITES_BUBBLE++;
            let $manga =
                $(`.content#favorites .source-group`).find('.manga-wrapper').find('.manga').filter(function(){
                    return $(this).data('href') === href
                })
            $manga.find('.bubble').fadeIn();
            $manga.find('#latestChap').html(obj.text)
            $manga.one('click',function(){
                $(this).find('.bubble').fadeOut();
                MRION.FAVORITES_BUBBLE--
            })
        }
    };
    parseUpdates(UPDATES)
// SPAWN POPUPS
    function spawnPopup(msg,type,cb){
        let id = type || 'error'
        if(id == 'error') {
            let err = Error(msg)
            console.error(err)
            let caller = err.stack.split("\n").pop();
            let [url,ln] = caller.slice(3,-1).split(':').slice(-3,-1)
            main.send('window-error', [msg,url,ln])
        }
        let clickable=false;
        if(id==='notif-c'){
            clickable=true;
            id='notif'
        }
        let $popup = $(`.popup#${id}`)

        $popup
            .find('#msg')
                .html(msg)
                .end()
            .css('display','flex')
            .addClass((clickable)?'clickable':'')

        let animation = anime.timeline({autoplay:false})
                .add({
                    targets:`.popup#${id}`,  
                    width: '350px',
                    easing: "easeInQuad",
                    duration:500,
                })
                .add({
                    targets:`.popup#${id} .note`,
                    opacity:1,
                    easing: "easeInQuad",
                    duration:500,
                })
                .add({
                    targets:`.popup#${id}`,  
                    width: 0,
                    padding:{
                        value:0,
                        delay:400,
                        easing:'linear',
                        duration:100
                    },
                    easing: "easeInQuad",
                    duration:500,
                },'+=5000')
        animation.play()
        if(clickable){
            if(typeof cb !== 'function') throw 'Clickable Spawn Popup no callback function'
            $popup.click(cb)
        }
        animation.finished
            .then(()=>{
                $popup.off('click')
                $popup.find('#msg').html('')
            })
    }
$('.navlink#genrelist').click()

// CHROME PATH SELECTOR
main.on('chromeNotSet',(evt)=>{
    showModal('chromePath')
})
main.send('mainWindowReady')
$('#chromePath #spawnFileDialog').click(function(){
    let _path = main.sendSync('spawnFileDialog')

    // CANCEL PARSING EVENTS IF DIALOG IS CANCELED
    if(!_path) return


    let _name = _path.split('\\').pop()
    $(this).siblings('#path').html(_path)
    console.log(_name)
    if(_name!='chrome.exe') spawnPopup('Invalid File Path!')
    else{
        main.sendSync('setConfig',['chromePath',_path])
        main.send('saveConfig')
        setTimeout(()=>{
            $('#chromePath').fadeOut()
            $('.modal-content').hide()
            spawnPopup('Restarting MRION for changes to take effect!','info')
            setTimeout(()=>{
                main.send('restart-electron')
            },5000)
        },2000)
    }
})

// HANDLE AUTO UPDATE
    let UPDATE_STATUS = main.sendSync('mrionu-getUpdateStatus')
    if(UPDATE_STATUS) handleUpdate(UPDATE_STATUS)
    main.on('mrionu-available',(evt,data)=>handleUpdate(data))


    function handleUpdate(res){
        console.log("UPDATE AVAILABLE")
        // POPULATE DATA
            $('.modal-content#updatePrompt')
                .find('#version')
                    .html(res.version)
                    .end()
                .find('#filename')
                    .html(res.files[0].url)
                    .end()
                .find('#filesize')
                    .html(res.files[0].size)
                    .end()
                .find('#reldate')
                    .html(moment(res.releaseDate).format('MMMM DD, YYYY'))
                    .end()
            $('.modal-content#downloadProgress')
                .find('#filename')
                    .html(res.files[0].url)
        $('.side-bar #update').fadeIn().css('display','flex')
        spawnPopup(`Version ${res.version} available! <br>Click to update!`,'notif-c',
            function(){
                $(this).fadeOut()
                showModal('updatePrompt')
            }
        )
    }

    // MODAL
    $('.modal-content#updatePrompt')
        .find('#updateCancel')
            .click(()=>$('.modal-bg').fadeOut())
            .end()
        .find('#updateConfirm')
            .click(()=>{
                $('#downloadProgress').hide()
                showModal('downloadProgress')
                main.send('downloadUpdate')
            })
            .end()

    main.on('download-progress',(evt,progress)=>{
        $('.modal-content#downloadProgress')
            .find('#dl-speed')
                .html(progress.speed)
                .end()
            .find('#dl-transferred')
                .html(progress.trans)
                .end()
            .find('#dl-total')
                .html(progress.total)
                .end()
            .find('#dl-percent')
                .html(parseInt(progress.percent))
                .data(parseInt(progress.percent))
                .end()
            .find('.prog-fg')
                .width(`${Math.max(6.5,parseInt(progress.percent))}%`)

        if(parseInt(progress.percent)>99)
            $('#downloadProgress').find('.prog-fg').addClass('filled')
    })

    main.on('mrionu-downloaded',(evt)=>{
        if(!$('#downwloadProgress').find('#dl-percent').data('percent')){
            $('#downloadProgress')
                .find('.prog-fg').addClass('filled')
                .find('#dl-percent').html('100')
        }
        let animation =
        anime.timeline({easing:'easeInQuad'})
            .add({
                targets:'#downloadProgress .prog-bg',
                width: '10%',
                marginLeft: '45%',
                easing: "easeInExpo",
                duration: 2250
            })
            .add({
                targets:'#downloadProgress .prog-fg #dl-percent',
                opacity: 0,
                easing: "easeInExpo",
                duration: 2250
            },0)
            .add({
                targets:'#downloadProgress #clip-path',
                clipPath:'circle(100% at 50% 64%)',
                easing: "easeInExpo",
                duration: 1250,
            },'+=500')

        animation.finished
        .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
        .then(()=>main.send('mrionu-installUpdates'))
    })

// HANDLE BUG REPORTS
    // MODAL
    let bugReportAnimation = {
        clipPath:
            anime({
                targets:'.modal-content#bugReport .clipped',
                clipPath:'circle(200% at 79% 82%)',
                easing: "easeInExpo",
                duration: 1000,
                autoplay:false
            }),
        drawHalo:anime.timeline({autoplay:false})
            .add({
                targets:'.modal-content#bugReport .clipped #halo',
                strokeDasharray: '283,20000',
                easing: "easeInExpo",
                duration: 750,
                delay:100
            })
            .add({
                targets:'.modal-content#bugReport .clipped #text',
                opacity:1,
                easing: "easeInExpo",
                duration: 750
            },500)
    }
    $('.modal-content#bugReport')
        .find('#bug-log').find('#switch')
            .change(function(){
                let STATUS = $(this).prop('checked')
                $(this).parent().data('checked',STATUS)
                if(STATUS)
                    $(this).parent().siblings('.label')
                        .html('Include Current Instance Only')
                else
                    $(this).parent().siblings('.label')
                        .html('Include Whole Log')
            }).end().end()
        .find('#bugConfirm')
            .click(function(){
                // VALIDATE IF BOTH FIELDS ARE FILLED UP
                let $parent = $(this).parent().parent()
                let $title = $parent.find('#bug-title')
                let $body = $parent.find('#bug-body')
                let $log = $parent.find('#bug-log')
                $parent.find('.input').removeClass('invalid')

                if(!$title.val())
                    $title.addClass('invalid')

                
                else if(!$body.val())
                    $body.addClass('invalid')
                
                else{
                        bugReportAnimation.clipPath.play()
                        main.send('mrion-bugReport',{
                            body:$body.val(),
                            title:$title.val(),
                            wholeLog:!$log.data('checked')
                        })
                }
            }).end()
        .find('#bugDiscard')
            .click(function(){
                $(this).parent().parent()
                    .find('.input').val('')
                $('.modal-bg').fadeOut()
            })

    main.on('mrion-bugReportStatus',(evt,result)=>{
        console.log('RESULT: '+result)
        if(result){
            bugReportAnimation.drawHalo.play()
            bugReportAnimation.drawHalo.finished
            .then(() => new Promise(resolve => setTimeout(resolve, 1000)))
                .then(()=>{
                    $('.modal-bg').fadeOut(()=>{
                        bugReportAnimation.clipPath.seek(0)
                        bugReportAnimation.drawHalo.seek(0)
                    })
                })
        }
        else{
            $('.modal-bg').fadeOut(()=>{
                bugReportAnimation.clipPath.seek(0)
                spawnPopup('Cannot send Bug Report','warning')
            })

        }
    })
    // PREFILL ON ERROR POPUP CLICK
    $('.popup#error').click(
        function(){
            let ISSUE_TITLE = $(this).find('#msg').html()
            $(this).fadeOut()
            showModal('bugReport')
            $('.modal-content#bugReport')
                .find('#bug-title')
                    .val(ISSUE_TITLE)
                    .end()
                .find('#bug-body')
                    .focus()
        }
    )
// KEYBINDS
Mousetrap.bind(['alt+f4','ctrl+w'],(e)=>{
    e.preventDefault()
    $('.title-bar').find('#close-prompt').click()
},'keydown')

