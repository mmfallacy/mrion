const {ipcRenderer:main, remote} = require('electron');
window.$ = require('jquery')

var CONFIG = remote.getGlobal('CONFIG')
// --------------------------------------
$(`.content#settings .setting-group#preload .dropdown .selected`).html(CONFIG.preloadNum)
if(CONFIG.preload!=0) $(`.content#settings .setting-group#preload .dropdown.select`).removeClass('disabled')
else $(`.content#settings .setting-group#preload .dropdown.select`).addClass('disabled')

for([id,val] of Object.entries(CONFIG))
    $(`.content#settings #${id} input`).prop('checked',val)

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
    if(this.id=="settings") $('.side-bar button.navlink:not(#settings)').one('click',()=>{
        if($('.content#settings').find('h5').data('changed')!=='changed') return;
        console.log('changed')
        $('.content#settings').find('h5').slideUp()
        main.send('settingsUpdated')
    })
})


// DROP DOWN SOURCE HANDLER
let SOURCES = remote.getGlobal('SOURCES')
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
const sourceGroupTemplate = $(`
<div class="source-group">
    <div class="header">
        <h3>Mangakakalots</h3>
        <hr>
    </div>
    <div class="mangas-wrapper">
        <div class="mangas">
        </div>
    </div>
</div>
`) 


// -------------------------------------- FUNCTIONS
function setConfig(key,value){
    if(!Object.keys(CONFIG).includes(key)) throw "CONFIG DOES NOT CONTAIN KEY : " + key
    CONFIG[key] = value
    return main.sendSync('setConfig',[key,value])
}
function getConfig(key){
    MAINCONFIGVAL = main.sendSync('getConfig',key)
    if (CONFIG[key] !== MAINCONFIGVAL) throw "CONFIG MISMATCH" 
    return CONFIG[key]
}
function appendMangaToHandler(id,obj){
    $manga = mangaTemplate.clone()
    $manga.data('source',CURRENT_SOURCE)
    $manga.data('bookmarked',false)
    $manga.find('#title').html(obj.title)
    $manga.find('img').prop('src',obj.image).prop('alt',obj.title)
    $manga.find('#latestchap').html(obj.latestChap)
    $manga.data('href',obj.href)
    $manga.data('rating',obj.rating)
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
async function updateMangaList({source},page){
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
            updateMangaList({source},page)
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
async function searchManga({source},keywords){
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
    if(mangaList.length<1){
        $('#home-searchManga').append('<h3>No Results</h3>').children("h3").hide().slideDown()
    }
    for(obj of mangaList){
        appendMangaToHandler('home-searchManga',obj)
    }
}

function clearMangaHandler(id){
    $(`#${id} .manga,#${id} h3`).fadeOut('fast',function(){        
        $(this).parent().empty()
    })
}
function selectedMangaReset(){
    $(".manga-info .manga-image img").removeAttr('src')
    $(".manga-info").removeData('mangaObj')
    $(".manga-info").removeData('source')
    $('.manga-info .manga-image #bookmark').removeClass('bookmarked')
    let $parent = $('.content#selectedManga')
    let $mangaInfo = $parent.find(".manga-info .manga-info-text")
    $mangaInfo.find('#title').html('')
    $mangaInfo.find('#alt-titles').html('')
    $mangaInfo.find('#description .text').html('')
    $mangaInfo.find('#author .text').html('')
    $mangaInfo.find('#status .text').html('')
    $mangaInfo.find('#lastUpdate .text').html('')
    $mangaInfo.find('#chapters .text').html('')
    $mangaInfo.find('#genres .text').empty()
    $mangaInfo.find('#rating .text').children().attr('class', 'ri-star-line')
    $mangaInfo.find('.more-info-card').removeClass('shown')
    $parent.find('.chapter-list').empty()

}
function stripTagsFromString(string){
    var doc = new DOMParser().parseFromString(string, 'text/html');
    return doc.body.textContent || "";
 }
async function selectManga(){
    let manga = await $(this).data('source').source.scanMangaHref($(this).data('href'))
    selectedMangaReset()
    $(".manga-info .manga-image img").prop('src', manga.image)
    $(".manga-info").data('mangaObj', $(this))
    $('.manga-info').data('source',$(this).data('source'))
    if($(this).data('bookmarked'))
        $('.manga-info .manga-image #bookmark').addClass('bookmarked')
    let $parent = $('.content#selectedManga')
    let $mangaInfo = $parent.find(".manga-info .manga-info-text")
    $mangaInfo.find('#title').html(manga.title)
    $mangaInfo.find('#alt-titles').html(manga.altTitles.join(", "))
    $mangaInfo.find('#description .text').html(stripTagsFromString(manga.description))
    $mangaInfo.find('#author .text').html(manga.info.author.join(", "))
    $mangaInfo.find('#status .text').html(manga.info.status)
    $mangaInfo.find('#lastUpdate .text').html(manga.info.lastUpdated)
    $mangaInfo.find('#chapters .text').html(manga.chapters.length)
    manga.info.genres.map(el=>$mangaInfo.find('#genres .text').append(`<span class="genre">${el}</span>`))
    $mangaInfo.find('#rating .text span').each(function(i){
        if(manga.info.rating-i>.75) $(this).attr('class','ri-star-fill')
        else if(manga.info.rating-i>.25) $(this).attr('class','ri-star-half-line')
    })
    let $chapters = $parent.find('.chapter-list')
    manga.chapters.map(function(obj){
        $chapters.append(`
            <button class="chapter">
                <span class="chapter-num">${obj.text}</span>
                <span class="chapter-date">${obj.date}</span>
            </button>
        `)
    })
    $parent.fadeIn()
    $parent.find('.chapter-list').scrollTop(0)
}
function serializeMangaObj($selector){
    let obj = {}
    obj.title = $selector.find("#title").html()
    obj.image = $selector.find("img").prop('src')
    obj.latestChap = $selector.find("#latestchap").html()
    obj.href = $selector.data('href')
    obj.rating = $selector.data('rating')
    obj.sourceKey = $selector.data('source').key
    obj.bookmarked = $selector.data('bookmarked')
    return obj
}
function deserializeMangaObj(obj){
    $manga = mangaTemplate.clone()
    $manga.data('source',SOURCES[obj.sourceKey])
    $manga.data('bookmarked',obj.bookmarked)
    $manga.find('#title').html(obj.title)
    $manga.find('img').prop('src',obj.image).prop('alt',obj.title)
    $manga.find('#latestchap').html(obj.latestChap)
    $manga.data('href',obj.href)
    $manga.data('rating',obj.rating)
    $manga.find('#rating span').each(function(i){
        if(obj.rating-i>.75) $(this).attr('class','ri-star-fill')
        else if(obj.rating-i>.25) $(this).attr('class','ri-star-half-line')
    })
    if(!obj.latestChap)
        $manga.find('#latestchap, #latestchap+label').hide()
    if(obj.rating==-1) 
        $manga.find('#rating').hide()
    return $manga
}

// --------------------------------------
for([key,value] of Object.entries(SOURCES)){
    $('.source-select .dropdown-options').append(
        `<div class="option" id="${key}">${value.name}</div>`
    )
    let $SG = sourceGroupTemplate.clone()
    $SG.prop('id',`source${value.sourceId}`)
    $SG.find('.header').find('h3').html(value.name)
    $('.content#favorites').append($SG)
    //let favorites = main.sendSync('getFavorites',key)
}
for(obj of main.sendSync('getFavorites')){
    $('.content#favorites').find(`#source${SOURCES[obj.sourceKey].sourceId}`).find('.mangas').append(deserializeMangaObj(obj))
}

$('.source-select .dropdown').click(function(){ // CUSTOM DROPDOWN FOR SOURCE SELECTION
    $(this).toggleClass('active')
})
$('.source-select .option').click(function(){ // OPTION HANDLER FOR SOURCE SELECTION
    $('.source-select .option').show()
    $('.source-select .selected').html($(this).html())
    $(this).hide()
    clearMangaHandler('home-searchManga')
    clearMangaHandler('home-mangaList')
    clearTimeout(updateMangaTimeout)
    CURRENT_SOURCE = SOURCES[$(this).prop('id')]
    CURRENT_SOURCE_PAGE=1
    $('.content#home .searchbar *').prop('disabled',false)
    $('.content#home .searchbar *').prop('placeholder',"Enter Keywords...")
    updateMangaList(CURRENT_SOURCE,CURRENT_SOURCE_PAGE)
})
$('.content#home .returnTop').click(function(){ //RETURN TO TOP BUTTON EVT HANDLER
    $('.content#home .manga-select').stop().animate({scrollTop:0}, 500, 'swing');
})
$('.content#home .manga-select').scroll(function() { //LOAD NEW PAGE ON SCROLL TO BOTTOM
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
$('.content#home .searchbar button#searchbutton').click(function(){  // SEARCH EVT HANDLER
    searchManga(CURRENT_SOURCE,$(this).siblings('input#searchfield').val())
})
$('.content#home .searchbar button#clearsearchbutton').click(function(){ // CLEAR SEARCH EVT HANDLER
    $(this).siblings('input#searchfield').val('')
    clearMangaHandler('home-searchManga')
})
$('.content#home .searchbar input#searchfield').click(function(){ // SELECT CONTENTS OF INPUT ONCE CLICKED
    $(this).select()
}).keydown(function(e){ // SUBMIT ON ENTER
    if(e.which==13)
    $(this).siblings('button#searchbutton').click()
})

$('.manga-handler').on('click','.manga',selectManga) // MANGA COMPONENT CLICK EVT HANDLER
$('.content#favorites').on('click','.mangas .manga',selectManga) // MANGA COMPONENT CLICK EVT HANDLER (FAVORITES)

$('.content#selectedManga  .manga-info .manga-info-text #back').click(function(){ // SELECTED MANGA BACK EVT HANDLER
    $('.content#selectedManga').fadeOut()
})
$('.content#selectedManga  .manga-info .manga-image #bookmark').click(function(){  // FAVORITE BUTTON EVT HANDLER
    let $parent = $(this).parent().parent()
    let $manga = $parent.data('mangaObj')
    let $mangaClone = $manga.clone(true)
    let id =`source${$parent.data('source').sourceId}`
    if($manga.data('bookmarked')){
        $(this).removeClass('bookmarked')
        $manga.data('bookmarked',false)
        main.send('removeFavorite', $manga.data('href'))
        $(`.content#favorites .source-group#${id}`).find('.mangas').find('.manga').filter(function(){
            return $(this).data('href') === $manga.data('href')
        }).remove()
    }
    else{
        $manga.data('bookmarked',true)
        $(this).addClass('bookmarked')
        $mangaClone.data('bookmarked',true)
        $(`.content#favorites .source-group#${id}`).find('.mangas').append($mangaClone)
        let serializedManga = serializeMangaObj($manga)
        serializedManga.rating = -1
        main.send('addFavorite',serializedManga)
    }
})
$('.content#selectedManga  .manga-info .manga-image #test').click(function(){
    let $parent = $(this).parent().parent()
    let $manga = $parent.data('mangaObj')
    let $mangaClone = $manga.clone(true)
    console.log('created global serialized obj')
    MANGATEST = serializeMangaObj($mangaClone)
})
$('.content#selectedManga  .manga-info .manga-info-text .absolute-snap').click(function(){ // MORE INFO CARD EVT HANDLER
    $(this).children('.more-info-card').toggleClass('shown')
})


$('.content#selectedManga  .manga-info .manga-info-text').hover( // HOVER EVENTS FOR MANGA INFO TEXT
    function(){ // DETERMINE GREATER HEIGHT
        let addHeight = $(this).find('#title').height() + $(this).find('#alt-titles').height() + 21  
        let descHeight = $(this).find('.description-card').height()
        let infoHeight = $(this).find('.more-info-card').height()
        $(this).height(Math.max(descHeight,infoHeight)+addHeight)
    },
    function(){ // RESET HEIGHT
        $(this).height("45vh");
    });

$('.content#favorites').on('click','.source-group .header',function(){ // EXPAND SOURCE GROUP
    $(this).siblings('.mangas-wrapper').slideToggle("fast")
})

// SETTINGS
$(`.content#settings .setting-group#preload .dropdown .selected,
   .content#settings .setting-group#preload .dropdown .arrow`).click(function(){
    console.log('test')
    $(this).parent().toggleClass('active')
})
$('.content#settings .setting-group#preload .dropdown .options .option').click(function(){
    let $parent = $(this).parent().parent()
    $parent.find('.selected').html($(this).html())
    $parent.find('.option').each(function(){
        $(this).removeClass('current')
    })
    $(this).addClass('current')
    $parent.data('selected', $(this).html())
    $parent.parent().parent().find('h5').slideDown().data('changed','changed')
    setConfig('preloadNum',parseInt($(this).html()))
    $parent.removeClass('active')
})
$('.content#settings .setting-group .switch.round input').change(function(){
    $parent = $(this).parent().parent()
    let id = $parent.attr('id')
    if(id==='readMode') id = $(this).parent().attr('id')
    if(id==='preload') $parent.find('.dropdown').toggleClass('disabled')
    $parent.parent().find('h5').slideDown().data('changed','changed')
    setConfig(id,(this.checked)?1:0)
})
//$('.content#testing').show()
$('button.navlink#settings').click()
// setTimeout(()=>{
//     $('.content#home .dropdown-options .option').filter(function(){
//         return ($(this).html() === "Mangakakalots")
//     }).click()
// },1000)
