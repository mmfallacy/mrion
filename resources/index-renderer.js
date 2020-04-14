const {ipcRenderer:main, remote} = require('electron');
window.$ = require('jquery')
const {Mangakakalots,KissManga} = require('./resources/source.js');

// | SOURCES 
    let SOURCES = {
        mangakakalots:{
            source: new Mangakakalots('https://mangakakalots.com/'),
            name: "Mangakakalots",
            key:'mangakakalots',
        },
        kissmanga:{
            source:new KissManga('https://kissmanga.in/'),
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
            console.table({newObj})
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
            })
        function changeSourceTo(key){
            MRION.CURRENT_SOURCE = SOURCES[key]
            $('.source-select .selected')
                .hide()
                .html(MRION.CURRENT_SOURCE.name)
                .fadeIn()
        }

// | Search Content
    bindSTTToSelector($('.content#search'))
    $('.content#search .searchBar')
        .find('#searchSubmit')
            .click(function(){
                let keywords = $(this).siblings('#searchInput').val()
                console.log(keywords)
                $('.content#search').find('.searchResults')
                    .find('#keywords')
                        .hide()
                        .html(keywords)
                        .fadeIn()
                        .end()
                    .addClass('loading')
                
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
            console.log($(this).scrollTop(),$(this).height())
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

$('.navlink#search').click()