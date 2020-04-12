const {ipcRenderer:main, remote} = require('electron');

var POSITIONS = main.sendSync('getLayoutPositions')

$('img').attr('draggable',false)

for(let [id,value] of Object.entries(POSITIONS)){
    $(`.draggable-content#${id}`).parent().css({top:value.top,left:value.left})
    if(!value.visible)$(`.draggable-content#${id}`).parent().addClass('hidden').find('#visible').attr('class','ri-eye-off-fill')
}

$(".draggable")
    .draggable({
    containment: ".content",
    handle:"#handle",
    start: function(){
        $(this).data('changed',true)
    }
    }).fadeIn().css('display','flex')

$(".draggable #visible").data('toggle',false).click(function(){
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
$('.dropdown .selected').click(function(){
    $(this).parent().toggleClass('active')
}).parent().mouseleave(function(){
    let $this =$(this)
    setTimeout(()=>$this.removeClass('active'),1000)
})
$('.dropdown .option').click(function(){
    $parent = $(this).parent().parent()
    $parent.find('.selected').html($(this).html())
    $parent.find('.option').removeClass('active')
    $(this).addClass('active')
})
//-----------------------------
$("#show-main").click(function(){
    showModal('backprompt')
})
$("#editLayout").data('toggle',false).click(function(){
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
                console.log($(this).offset())
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


$(window).on('beforeunload',function(){
    main.send('setLayoutPositions',POSITIONS)
})