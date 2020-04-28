const {ipcRenderer:main, remote} = require('electron');
const Panzoom = require('@panzoom/panzoom')
const Mousetrap = require('mousetrap')


var LAYOUTSETTINGS = main.sendSync('getLayoutPositions')
let SOURCES = remote.getGlobal('SOURCES')

let CHAPTERMARK = main.sendSync('getCHAPTERMARK')

var OPTIONS = {
    LAZY_LOAD: true,
    LAZY_LOAD_PARTS: 2,
}

// | LOGGER
window.onerror = function (msg, url, ln) {
    main.send('window-error',[msg,url,ln])
    return false;
}
// EVENT LISTENERS FOR IMAGE
// ** CURRENT IMG IS IMG CONTAINER NOT <IMG>
var READER = {
    HREF:0,
    CURRENT_SOURCE:false,
    internalCurrentChapter:0,
    internalLastChapter:0,
    get CURRENT_CHAPTER(){
        return this.internalCurrentChapter
    },
    set CURRENT_CHAPTER(index){
        this.internalLastChapter = this.internalCurrentChapter
        this.internalCurrentChapter = index
        this.CHP_indexListener(index)
        console.log('test') 
        if(!CHAPTERMARK[this.HREF].READ.includes(index)){
            CHAPTERMARK[this.HREF].READ.push(index)
            main.send('syncCHAPTERMARK', CHAPTERMARK)
        }
        loadChapter(
            this.CHAPTERS[index],
            this.internalCurrentChapter - this.internalLastChapter
        )
    },
    CHP_indexListener: function(i){
        // DISABLE PREVIOUS IMG BUTTON IF INDEX IS 0
        if(i==0)
            $('#controls').find('#prevChap')
                .attr('disabled',true)
        else
            $('#controls').find('#prevChap')
                .attr('disabled',false)
        // DISABLE NEXT IMG BUTTON IF INDEX IS MAX
        if(i==this.CHAPTERS.length-1)
            $('#controls').find('#nextChap')
                .attr('disabled',true)
        else
            $('#controls').find('#nextChap')
                .attr('disabled',false)
        // CHANGE SELECTED             
        $('#chapterNum .dropdown')
            .find('.selected')
                .html(READER.CHAPTERS[i].text.replace('Chapter ',''))
                .end()
            .find('.options').children()
                .removeClass('active')
                .filter(`:nth-child(${i+1})`)
                    .addClass('active')
        
    },
    CHAPTERS:false,
}

let [chapters, index, {sourceKey,href}] = main.sendSync('retrieveChapterData')
READER.CURRENT_SOURCE = SOURCES[sourceKey]
READER.HREF = href
READER.CHAPTERS = chapters

READER.CHAPTERS.map((el,i)=>{
    let $option = $('<span class="option"></span>')
    $option.data('index',i)
    $option.html(el.text.replace('Chapter ',''))
    $('#chapterNum .dropdown .options').append($option)
})
$('#chapterNum .text').html(READER.CHAPTERS.slice(-1)[0].text.split(' ')[1])

READER.CURRENT_CHAPTER =  index

var DRAGGABLE_BUTTON_TEMPLATE = $(`
<div class="button-group">
    <button class="ri-ghost-2-line" id="hoverable"></button>
    <button class="ri-eye-fill" id="visible"></button>
    <div class="ri-drag-move-2-line" id="handle"></div>
</div>
`)

var IMGVIEW = {
    internalImages : false,
    get IMAGES(){
        return this.internalImages
    },
    set IMAGES(array){
        this.internalImages = array
        $('.image-handler').children('.img-container').remove()
        if(OPTIONS.LAZY_LOAD)
            this.chunkify(array,OPTIONS.LAZY_LOAD_PARTS)
        this.loadImages()
    },
    internalImagesChunks : [],
    chunkify(array,chunkSize){
        this.internalImagesChunks = []
        this.chunkCursor = 0 ;
        for(let i=0; i<array.length; i+=chunkSize){
            let chunk = array.slice(i,i+chunkSize)
            this.internalImagesChunks.push(chunk)
        }
    },
    chunkCursor:0,
    loadImages(){
        console.log('LOADING NEW IMAGES: CC=' +this.chunkCursor)
        if(OPTIONS.LAZY_LOAD){
            if(this.chunkCursor<this.internalImagesChunks.length)    
                var sources = this.internalImagesChunks[this.chunkCursor++]
            else
                return
        }
        else
            var sources = this.internalImages
        sources.map((src)=>{
            let $image = $(`
                <div class="img-container">
                    <img src="${src}">
                </div>
            `)
            $('.image-handler').append($image)
            $image
                .data('panzoom',
                    Panzoom($image.children('img')[0],{
                        animate:true,
                        panOnlyWhenZoomed:true,
                        canvas:true,
                    })
                )
                .data('pos', $image.position())
            $image.children('img')[0].addEventListener('wheel', function(e){
                if(!e.shiftKey) return
                if(e.target != this) return
                let panzoom = $(this).parent().data('panzoom')
                panzoom.zoomWithWheel(e)
            })
        })
    },
    internalCurrentImage:0,
    get CURRENT_IMG(){
        return this.internalCurrentImage
    },
    set CURRENT_IMG($container){
        this.internalCurrentImage = $container
        console.log($container.is(':last-child'))
        if($container.is(':last-child'))
            this.loadImages()
    },
    get IMAGE_CONTAINERS(){
        return $('.image-handler').children()
    },
}
// LOAD CHAPTERS
    function loadChapter({href},mode){
        if(mode==0) return
        $('.loading-wrapper')
                .fadeIn(function(){
                    READER.CURRENT_SOURCE.obj
                        .scrapeChapter(href)
                            .then((res)=>{
                                IMGVIEW.IMAGES = res
                                $('.loading-wrapper')
                                    .fadeOut()
                            })
                })
    }           
// IMAGE HANDLER
    function getCurrentShownImage(){
        let {left,top} = $('.content .pointer').offset()
        let targets = document.elementsFromPoint(left,top)
        for(const target of targets)
            if($(target).is('.img-container img'))
                return $(target).parent()
        return false
    }
    $('.image-handler').scroll(function(){
        if(!getCurrentShownImage()) return
        if(getCurrentShownImage().is(IMGVIEW.CURRENT_IMG)) return
        IMGVIEW.CURRENT_IMG = getCurrentShownImage()
    })
// DRAGGABLES
$(".draggable")
    .each(function(){
        $(this).prepend(DRAGGABLE_BUTTON_TEMPLATE.clone())
    })
    .draggable({
        containment: ".content",
        handle:"#handle",
        start: function(){
            $(this).data('changed',true)
        }
    })

;(function applyLayoutSettings(){
    for(let [id,value] of Object.entries(LAYOUTSETTINGS)){
        // REGISTER POSITION
        $(`.draggable-content#${id}`).parent()
            .css({top:value.top,left:value.left})
        // REGISTER VISIBILITY
            .find('#visible')
                .data('toggle',value.visible)
                .end()
            .find('#hoverable')
                .data('toggle',value.hoverable)
                
        if(!value.hoverable)
            $(`.draggable-content#${id}`)
                .parent()
                    .addClass('solid')
                .find('#hoverable')
                    .attr('class','ri-ghost-2-fill')

        if(!value.visible)
            $(`.draggable-content#${id}`)
                .parent()
                    .addClass('hidden')
                .find('#visible')
                    .attr('class','ri-eye-off-fill')
    }
})();

$(".draggable")
    .fadeIn(function(){
        $(this).css('display','flex')
    })
    .find('#visible')
        .click(function(){
            let STATE = $(this).data('toggle')
            console.log(STATE)
            let id = $(this).parent().parent().find('.draggable-content').attr('id')
            if(STATE){
                $(this).parent().parent().addClass('hidden')
                $(this).attr('class','ri-eye-off-fill')
                LAYOUTSETTINGS[id].visible = false;
            }
            else{
                $(this).parent().parent().removeClass('hidden')
                $(this).attr('class','ri-eye-fill')
                LAYOUTSETTINGS[id].visible = true;
            }
            LAYOUTSETTINGS[id].changed = true;
            $(this).data('toggle',!STATE)
        })
        .end()
    .find('#hoverable')
        .click(function(){
            let STATE = $(this).data('toggle')
            console.log(STATE)
            let id = $(this).parent().parent().find('.draggable-content').attr('id')
            if(STATE){
                $(this).parent().parent().addClass('solid')
                $(this).attr('class','ri-ghost-2-fill')
                LAYOUTSETTINGS[id].hoverable = false;
            }
            else{
                $(this).parent().parent().removeClass('solid')
                $(this).attr('class','ri-ghost-2-line')
                LAYOUTSETTINGS[id].hoverable = true;
            }
            LAYOUTSETTINGS[id].changed = true;
            $(this).data('toggle',!STATE)
        })

//DROPDOWN LOGIC
$('.dropdown .selected')
    .click(function(){
    $(this).parent()
        .toggleClass('active')
    })
    .parent()
    .mouseleave(function(){
        let $this =$(this)
        setTimeout(()=>$this.removeClass('active'),1000)
    })
$('.dropdown .option')
    .click(function(){
        $parent = $(this).parent().parent()
        $parent.find('.selected').html($(this).html())
        $parent.find('.option').removeClass('active')
        $(this).addClass('active')
        READER.CURRENT_CHAPTER = $(this).data('index')
    })
//-----------------------------
$("#show-main")
    .click(function(){
        showModal('backprompt')
    })

//EDIT LAYOUT LOGIC
$("#editLayout")
    .data('toggle',false)
    .click(function(){
        let STATE = $(this).data('toggle')
        if(STATE){
            $(this).addClass('active')
            $('.content').addClass('edit')
        }
        else{
            $(this).removeClass('active')
            $('.content').removeClass('edit')
            $('.draggable').each(function(){
                let id =$(this).find('.draggable-content').attr('id')
                if($(this).data('changed')){
                    LAYOUTSETTINGS[id].changed = true;
                    LAYOUTSETTINGS[id].top = $(this).offset().top
                    LAYOUTSETTINGS[id].left = $(this).offset().left
                    $(this).data('changed',false)
                }
            })
        }
        $(this).data('toggle',!STATE)
    })
$("button#options").click(function(){
    showModal('options')
})

$('.modal-content .closeModal').click(function(){
    $(this).parent().parent().parent().fadeOut()
})
$('.modal-bg').click(function(){
    $(this).fadeOut()
}).children().click(e=>e.stopPropagation())

function showModal(id){
    $('.modal-bg .modal-content').hide()
    $('.modal-bg').fadeIn()
    $('.modal-bg').find(`#${id}`).show()
}
// MODAL BUTTONS
$('#backprompt')
    .find('#return')
        .click(function(){
            main.send('showMainFromReader')
        })
        .end()
    .find('#cancel')
        .click(function(){
            $(this).parent().parent().parent().fadeOut()
        })

// ON UNLOAD SAVE LAYOUTSETTINGS
$(window).on('beforeunload',function(){
    main.send('setLayoutPositions',LAYOUTSETTINGS)
})

// CONTROLS
$('#controls')
    .find('#nextChap')
        .click(function(){
            READER.CURRENT_CHAPTER++ 
            console.log(READER.CURRENT_CHAPTER)
        }).end()
    .find('#prevChap')
        .click(function(){
            READER.CURRENT_CHAPTER--
            console.log(READER.CURRENT_CHAPTER)

        }).end()



// MOUSE LOCATIONS
MOUSE = {
    x:0,
    y:0
}
$(document).mousemove(e=>{
    MOUSE.x = e.pageX
    MOUSE.y = e.pageY
})


// BINDINGS
KEYBINDS = {
    ENABLED: true,
    PZ_RESET:'ctrl+r',
    REFRESH:['f5','ctrl+r','ctrl+f5']
} 

// PANZOOM RESET
Mousetrap.bind(KEYBINDS.PZ_RESET, function(e){
    e.preventDefault()
    let target = $(document.elementFromPoint(MOUSE.x,MOUSE.y))
    if(target.is('img'))
        target.parent()
            .data('panzoom')
                .reset()
    else if(target.is('div.img-container'))
        target
            .data('panzoom')
                .reset()
},'keydown')



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
            .fadeIn()
            .addClass((clickable)?'clickable':'')
            .css('display','flex')
        
        if(clickable){
            if(typeof cb !== 'function') throw 'Clickable Spawn Popup no callback function'
            $popup.click(cb)
        }
        setTimeout(function(){
            $popup
                .fadeOut(function(){
                    $(this).find('#msg')
                        .html('')
                })
                .removeClass('clickable')
        },5000)
    }

    main.on('mrionu-available',(evt,res)=>{
        spawnPopup(`Version ${res.version} available! <br>Click to return to MRION!`,'notif-c',
        function(){
            main.send('showMainFromReader')
        }
    )

    })
if(!KEYBINDS.ENABLED) Mousetrap.reset()

// DISABLE REFRESH
Mousetrap.bind(KEYBINDS.REFRESH.filter((val)=>{
    let {REFRESH, ...rest} = KEYBINDS
    return !Object.values(rest).includes(val)
}),(e,combo)=>e.preventDefault())