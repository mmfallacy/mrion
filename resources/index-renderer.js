const {ipcRenderer:main} = require('electron');
window.$ = require('jquery')

$('.side-bar').children('button').each(function(){
    $(this).prepend($(main.sendSync('requestSvg',`${this.id}.svg`)))
});
$('.title-bar button').each(function(){
   $(this).click(()=> main.send(this.id))
})
$('.side-bar div.menu').dblclick(function(){
    $(this).parent().toggleClass('hold')
    $(".content.shown").toggleClass('side-bar-docked')
})
$('.side-bar button.navlink').click(function(){
    $('.side-bar button.navlink').removeClass('active')
    $('.content').removeClass('shown').hide()
    $(this).addClass('active')
    $(`.content#${this.id}`).addClass('shown').fadeIn()
})


// DROP DOWN SOURCE HANDLER
let SOURCES = {
    'Mangakakalot':true,
    'Mangascans':true,
    'KissManga':true,
    'Meraki Scans':true,
}

function sourceChange(){

}
for(key in SOURCES)
    $('.source-select .dropdown-options').append(
        `<div class="option">${key}</div>`
    )
$('.source-select .dropdown').click(function(){
    $(this).toggleClass('active')
})
$('.source-select .option').click(function(){
    $('.source-select .option').show()
    $('.source-select .selected').html($(this).html())
    $(this).hide()
    sourceChange()
})

$('button.navlink#home').click()