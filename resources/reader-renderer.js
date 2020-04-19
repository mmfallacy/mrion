const {ipcRenderer:main, remote} = require('electron');
const Panzoom = require('@panzoom/panzoom')
const Mousetrap = require('mousetrap')
var POSITIONS = main.sendSync('getLayoutPositions')

$('img').attr('draggable',false);


(function parsePOSITIONSVariable(){
    for(let [id,value] of Object.entries(POSITIONS)){
        $(`.draggable-content#${id}`).parent()
            .css({top:value.top,left:value.left})
        if(!value.visible)
            $(`.draggable-content#${id}`)
                .parent()
                    .addClass('hidden')
                .find('#visible')
                    .attr('class','ri-eye-off-fill')
    }
})();

$(".draggable")
    .draggable({
    containment: ".content",
    handle:"#handle",
    start: function(){
        $(this).data('changed',true)
    }
    }).fadeIn().css('display','flex')

$(".draggable #visible")
    .data('toggle',false)
    .click(function(){
    let STATE = $(this).data('toggle')
    let id = $(this).parent().parent().find('.draggable-content').attr('id')
    if(STATE){
        $(this).parent().parent().addClass('hidden')
        $(this).attr('class','ri-eye-off-fill')
        POSITIONS[id].visible = false;
    }
    else{
        $(this).parent().parent().removeClass('hidden')
        $(this).attr('class','ri-eye-fill')
        POSITIONS[id].visible = true;
    }
    POSITIONS[id].changed = true;
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
                    POSITIONS[id].changed = true;
                    POSITIONS[id].top = $(this).offset().top
                    POSITIONS[id].left = $(this).offset().left
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


// ON UNLOAD SAVE POSITIONS
$(window).on('beforeunload',function(){
    main.send('setLayoutPositions',POSITIONS)
})

// CONTROLS
$('#controls')
    // IMAGES
    .find('#nextImg')
        .click(function(){
            let $nextObj = READER.CURRENT_IMG.next()
            let offset = $nextObj.data('pos').top
            
            $('.image-handler').animate({
                scrollTop: offset
            },1000, 'swing')
        })
        .end()
    .find('#prevImg')
        .click(function(){
            let $prevObj = READER.CURRENT_IMG.prev()
            let offset = $prevObj.data('pos').top
            
            $('.image-handler').animate({
                scrollTop: offset
            },1000, 'swing')
        })
        .end()



// ZOOM CONTROLS
$('#zoom-controls')
    .find('#zoomIn')
        .click(function(){
            getCurrentShownImage()
                .data('panzoom')
                    .zoomIn()
        })
        .end()
    .find('#zoomOut')
        .click(function(){
            getCurrentShownImage()
                .data('panzoom')
                    .zoomOut()
        })
        .end()
    .find('#reset')
        .click(function(){
            getCurrentShownImage()
                .data('panzoom')
                    .reset()
        })

// MOUSE LOCATIONS
MOUSE = {
    x:0,
    y:0
}
$(document).mousemove(e=>{
    MOUSE.x = e.pageX
    MOUSE.y = e.pageY
})


// IMAGE HANDLERS
$('.image-handler').scroll(function(){
    if(!getCurrentShownImage()) return
    if(getCurrentShownImage().is(READER.CURRENT_IMG)) return
    READER.CURRENT_IMG = getCurrentShownImage()
})
$('.image-handler .img-container').each(function(){
    $(this).data('pos',$(this).position())
})
$('.image-handler .img-container img').each(function(){
    $(this).parent().data('panzoom',
        Panzoom($(this)[0],{
            animate:true,
            panOnlyWhenZoomed:true,
            canvas:true,
        })
    )
})

$('.image-handler .img-container img').each(function(){
    this.addEventListener('wheel', function(e){
        if(!e.shiftKey) return
        if(e.target != this) return
        let panzoom = $(this).parent().data('panzoom')
        panzoom.zoomWithWheel(e)
    })

})
// EVENT LISTENERS FOR IMAGE
// ** CURRENT IMG IS IMG CONTAINER NOT <IMG>
var READER = {
    internalCurrentImg:false,
    get CURRENT_IMG(){
        return this.internalCurrentImg
    },
    set CURRENT_IMG($node){
        this.internalCurrentImg = $node
        this.CURRENT_IMG_INDEX = $('.img-container').index($node)
    },
    internalImgIndex: 1,
    get CURRENT_IMG_INDEX(){
        return this.internalImgIndex
    },
    set CURRENT_IMG_INDEX(i){
        this.internalImgIndex=i
        this.indexListener(i)
    },
    indexListener: function(i){
        // DISABLE PREVIOUS IMG BUTTON IF INDEX IS 0
        if(i==0)
            $('#controls').find('#prevImg')
                .attr('disabled',true)
        else
            $('#controls').find('#prevImg')
                .attr('disabled',false)
        // DISABLE NEXT IMG BUTTON IF INDEX IS MAX
        if(i==this.CHAPTER_IMG_TOTAL-1)
            $('#controls').find('#nextImg')
                .attr('disabled',true)
        else
            $('#controls').find('#nextImg')
                .attr('disabled',false)
    },
    get CHAPTER_IMG_CURRENT(){
        $('.image-handler').children().length
    },
    CHAPTER_IMG_TOTAL: 0,


}

READER.CURRENT_IMG = $('.image-handler .img-container').first()
READER.CHAPTER_IMG_TOTAL = 7

function getCurrentShownImage(){
    let {left,top} = $('.content .pointer').offset()
    let targets = document.elementsFromPoint(left,top)
    for(const target of targets)
        if($(target).is('.img-container img'))
            return $(target).parent()
    return false
}



// BINDINGS

Mousetrap.bind('ctrl+r', function(e){
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
})