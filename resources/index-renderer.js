const {ipcRenderer:main, remote} = require('electron');
window.$ = require('jquery')
const {Mangakakalots,KissManga} = require('./resources/source.js');

// | SOURCES 
    let SOURCES = {
        mangakakalots:{
            obj: new Mangakakalots('https://mangakakalots.com/'),
            name: "Mangakakalots",
            key:'mangakakalots',
        },
        kissmanga:{
            obj:new KissManga('https://kissmanga.in/'),
            name:"KissManga",
            key:'kissmanga',
    
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
        $manga = mangaTemplate.clone()
        $manga.find('#title')
            .html(obj.title)
            
        $manga.find('img')
            .prop('src',obj.image)

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
            .data('href', obj.href)
            .data('source', MRION.CURRENT_SOURCE)
        return $manga
    }

// MANGA SELECT HANDLER
    $('.manga-wrapper').on('click','.manga',
        function(){
            let href = $(this).data('href')
            let source = $(this).data('source')
            
            source.obj.scanMangaHref(href)
                .then(function(result){
                    console.log(result)
                })
        });

// SPAWN ERROR POPUP
    function spawnErrorPopup(errMsg){
        let $popup = $('.popup#error')
        $popup
            .find('#errorMsg')
                .html(errMsg)
                .end()
            .fadeIn()
            .css('display','flex')
        
        setTimeout(function(){
            $popup
                .fadeOut(function(){
                    $(this).find('#errorMsg')
                        .html('')
                })
        },5000)
    }
$('.navlink#search').click()


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