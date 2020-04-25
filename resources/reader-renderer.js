const {ipcRenderer:main, remote} = require('electron');
const Panzoom = require('@panzoom/panzoom')
const Mousetrap = require('mousetrap')
var LAYOUTSETTINGS = main.sendSync('getLayoutPositions')


// EVENT LISTENERS FOR IMAGE
// ** CURRENT IMG IS IMG CONTAINER NOT <IMG>
var READER = {
    internalCurrentChapter:0,
    get CURRENT_CHAPTER(){
        return this.internalCurrentChapter
    },
    set CURRENT_CHAPTER(index){
        this.internalCurrentChapter = index
        this.CHP_indexListener(index) 
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

//let [chapters, index] = main.sendSync('retrieveChapterData')
READER.CHAPTERS =// chapters
[
    {
        text:"Chapter 1",
        date:"Aug 25,19",
        href:"https://mangakakalots.com/chapter/baka_to_test_to_shokanjuu_dya/chapter_1"
    },
    {
        text:"Chapter 2",
        date:"Aug 25,19",
        href:"https://mangakakalots.com/chapter/baka_to_test_to_shokanjuu_dya/chapter_2"
    },
    {
        text:"Chapter 3",
        date:"Aug 25,19",
        href:"https://mangakakalots.com/chapter/baka_to_test_to_shokanjuu_dya/chapter_3"
    }
]

READER.CHAPTERS.map((el,i)=>{
    let $option = $('<span class="option"></span>')
    $option.data('index',i)
    $option.html(el.text.replace('Chapter ',''))
    $('#chapterNum .dropdown .options').append($option)
})
$('#chapterNum .text').html(READER.CHAPTERS.slice(-1)[0].text.split(' ')[1])

READER.CURRENT_CHAPTER = 2//index

var DRAGGABLE_BUTTON_TEMPLATE = $(`
<div class="button-group">
    <button class="ri-ghost-2-line" id="hoverable"></button>
    <button class="ri-eye-fill" id="visible"></button>
    <div class="ri-drag-move-2-line" id="handle"></div>
</div>
`)


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
    NEXT_IMAGE: 'right',
    PREV_IMAGE: 'left',
} 

;(function MOUSETRAP_BINDINGS(){
    if(!KEYBINDS.ENABLED) return;
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
    },'keyup')

    // PREVIOUS IMAGE
    Mousetrap.bind(KEYBINDS.PREV_IMAGE,function(e){
        e.preventDefault()
        let $button = $('#controls').find('#prevImg')

        if(!$button.attr('disabled'))
            $button.click()
    },'keyup')

    // NEXT IMAGE
    Mousetrap.bind(KEYBINDS.NEXT_IMAGE,function(e){
        e.preventDefault()
        let $button = $('#controls').find('#nextImg')

        if(!$button.attr('disabled'))
            $button.click()
    },'keyup')

})();