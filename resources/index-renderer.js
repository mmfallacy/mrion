const {ipcRenderer:main} = require('electron');
window.$ = require('jquery')
const {Mangakakalots,KissManga} = require('./resources/source.js');

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
    'Mangakakalots':new Mangakakalots('https://mangakakalots.com/'),
    'Mangascans':true,
    'KissManga':new KissManga('https://kissmanga.in/'),
    'Meraki Scans':true,
}
let CURRENT_SOURCE;
let CURRENT_SOURCE_PAGE=1;
const mangaTemplate = $(`
<div class="manga">
    <img>
    <div id="rating">
        <span class="ri-star-line"></span>
        <span class="ri-star-line"></span>
        <span class="ri-star-line"></span>
        <span class="ri-star-line"></span>
        <span class="ri-star-line"></span>
    </div>
    <div class="manga-info">
        <span id="latestchap">CHAP</span>
        <span class="label">Latest Chapter:</span>
        <hr>
        <span id='title'>TITLE</span>
    </div>
</div>
`)
function appendMangaToHandler(id,obj){
    $manga = mangaTemplate.clone()
    $manga.find('#title').html(obj.title)
    $manga.find('img').prop('src',obj.image).prop('alt',obj.title)
    $manga.find('#latestchap').html(obj.latestChap)
    $manga.find('#rating span').each(function(i){
        if(obj.rating-i>.75) $(this).attr('class','ri-star-fill')
        else if(obj.rating-i>.25) $(this).attr('class','ri-star-half-line')
    })
    if(!obj.latestChap)
        $manga.find('#latestchap, #latestchap+label').hide()
    if(!obj.rating) 
        $manga.find('#rating').hide()
    $(`#${id}`).append($manga)
    $manga.hide().fadeIn('fast')
}
let updateMangaTimeout;
async function updateMangaList(source,page){
    let $loader = $("<div class='overlay'><div class='loader animating'></div></div>");
    let STATUS = true;
    let mangaList;
    try{
        mangaList = await source.getMangaList(page)
    }catch(err){
        console.log(err)
        STATUS = false
        $('#home-mangaList .overlay').remove()
        updateMangaTimeout = setTimeout(()=>{
            updateMangaList(source,page)
        },5000)
    }
    $('#home-mangaList').append($loader)
    $('.content#home .manga-select').data('loading',true)
    if(!STATUS) return
    for(obj of mangaList){
        appendMangaToHandler('home-mangaList',obj)
        $('#home-mangaList .overlay').remove()
        $('.content#home .manga-select').data('loading',false)
    }
}
async function searchManga(source,keywords){
    let parsed_keywords = keywords.replace(/\s/g, source.searchBuilder)
    $('#home-searchManga').empty()
    let mangaList;
    let STATUS=true;
    try{
        mangaList = await source.searchSourceFor(parsed_keywords)
    }catch(err){
        console.log(err)
        STATUS=false;
    }
    if(!STATUS) return
    for(obj of mangaList){
        appendMangaToHandler('home-searchManga',obj)
    }
}

function clearMangaHandler(id){
    $(`#${id} .manga`).fadeOut('fast',function(){        
        $(this).parent().empty()
    })
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
    clearMangaHandler('home-searchManga')
    clearMangaHandler('home-mangaList')
    clearTimeout(updateMangaTimeout)
    CURRENT_SOURCE = SOURCES[$(this).html()]
    CURRENT_SOURCE_PAGE=1
    $('.content#home .searchbar *').prop('disabled',false)
    $('.content#home .searchbar *').prop('placeholder',"Enter Keywords...")
    updateMangaList(CURRENT_SOURCE,CURRENT_SOURCE_PAGE)
})
$('.content#home .returnTop').click(function(){
    $('.content#home .manga-select').scrollTop(0)
})
$('.content#home .manga-select').scroll(function() {
    if($(this).scrollTop()>$(this).height())
        $('.content#home .returnTop').fadeIn().css('display', 'flex');
    else $('.content#home .returnTop').fadeOut()
    if(!CURRENT_SOURCE) return
    if($(this).data("loading")) return
    let hasReachedBottom = ($(this).scrollTop()+$(this).innerHeight()>=this.scrollHeight)
    if(hasReachedBottom){
        updateMangaList(CURRENT_SOURCE,++CURRENT_SOURCE_PAGE)
    }
});

$('.content#home .searchbar *').prop('disabled',true)
$('.content#home .searchbar button#searchbutton').click(function(){
    searchManga(CURRENT_SOURCE,$(this).siblings('input#searchfield').val())
})
$('.content#home .searchbar button#clearsearchbutton').click(function(){
    $(this).siblings('input#searchfield').val('')
    clearMangaHandler('home-searchManga')
})
$('.content#home .searchbar input#searchfield').click(function(){
    $(this).select()
}).keydown(function(e){
    if(e.which==13)
    $(this).siblings('button#searchbutton').click()
})

$('.content#selectedManga  .manga-info .manga-info-text .absolute-snap').click(function(){
    $(this).children('.more-info-card').toggleClass('shown')
})
$('.content#selectedManga').show()
//$('button.navlink#home').click()

