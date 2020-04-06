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

$('button.navlink#home').click()