const {ipcRenderer:main, remote} = require('electron');
window.$ = require('jquery')

var CONFIG = remote.getGlobal('CONFIG')
// --------------------------------------
$(`.content#settings .setting-group#preload .dropdown .selected`).html(CONFIG.preloadNum)
if(CONFIG.preload!=0) $(`.content#settings .setting-group#preload .dropdown.select`).removeClass('disabled')
else $(`.content#settings .setting-group#preload .dropdown.select`).addClass('disabled')
$('img').attr('draggable',false)
for([id,val] of Object.entries(CONFIG))
    $(`.content#settings #${id} input`).prop('checked',val)

$('.side-bar').children('button').each(function(){
    $(this).prepend($(main.sendSync('requestSvg',`${this.id}.svg`)))
});
$('.title-bar button').each(function(){
    if(this.id=='close-electron') return
    else
    $(this).click(()=> main.send(this.id))
})
$('.title-bar button#close-electron').click(function(){
    console.log('test')
    $('.modal-bg').fadeIn()
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
    if(['home','genrelist'].includes(this.id)) $('.source-select').slideDown()
    else $('.source-select').slideUp()
})
main.on('favoritesUpdate', async () =>{
    let UPDATES = main.sendSync("getUpdates")
    parseUpdates(UPDATES)
    console.log("updated")
})

//CUSTOM LISTENER TO FAVORITES BUBBLE
favorites = {
    aInternal: 0,
    aListener: function(val) {
        if(val<=0)
            $('button.navlink#favorites').children('.bubble').fadeOut()
        else
            $('button.navlink#favorites').children('.bubble').fadeIn()
    },
    set bubble(val) {
      this.aInternal = val;
      this.aListener(val);
    },
    get bubble() {
      return this.aInternal;
    }
  }

// DROP DOWN SOURCE HANDLER
const {Mangakakalots,KissManga} = require('./resources/source.js');

let SOURCES = {
  mangakakalots:{
      source: new Mangakakalots('https://mangakakalots.com/'),
      name: "Mangakakalots",
      sourceId:0,
      key:'mangakakalots',
  },
  kissmanga:{
      source:new KissManga('https://kissmanga.in/'),
      name:"KissManga",
      sourceId:2,
      key:'kissmanga',

  }
}
// let SOURCES = main.getGlobal('SOURCES') 
let CURRENT_SOURCE;
let CURRENT_SOURCE_PAGE=1;

let CURRENT_GENRE_PAGE=1;
let ISMAXGENREPAGE = false;

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
function parseUpdates(UPDATES){
    for(let[href, obj] of Object.entries(UPDATES)){
        if(typeof obj === 'boolean') continue
        favorites.bubble++;
        let $manga =
            $(`.content#favorites .source-group`).find('.mangas').find('.manga').filter(function(){
                return $(this).data('href') === href
            })
        $manga.find('.bubble').fadeIn();
        $manga.one('click',function(){
            $(this).find('.bubble').fadeOut();
            favorites.bubble--;
            main.send('updateLatestChap',{href:href,text:obj.text})
        })
    }
}
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
let updateMangaTimeout, updateGenreTimeout,updateMangaGenreTimeout;
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
async function updateGenreList({source}){
    let $loader = $("<div class='overlay'><div class='loader animating'></div></div>");
    let $genre = $("<div class='genre'></div>")
    let STATUS = true;
    let genreList;
    try{
        genreList = await source.getGenreList()
    }catch(err){
        console.log(err)
        STATUS = false
        updateGenreTimeout = setTimeout(()=>{
            updateGenreList({source})
        },5000)
    }
    if(!STATUS) return
    $('.content#genrelist .genre-list').empty()
    for(let [text,href] of Object.entries(genreList)){
        genre = $genre.clone()
        genre.data('href',href)
        genre.html(text)
        $('.content#genrelist .genre-list').append(genre).hide().fadeIn()
    }
}
async function updateMangaListFromGenre(href,page){
    let $loader = $("<div class='overlay'><div class='loader animating'></div></div>");
    let STATUS = true;
    let mangaList;
    try{
        mangaList = await CURRENT_SOURCE.source.getMangaListFromGenre(href,page)
    }catch(err){
        console.log(err)
        STATUS = false
        $('#genre-MangaList .overlay').remove()
        updateMangaGenreTimeout = setTimeout(()=>{
            updateMangaListFromGenre(href,page)
        },5000)
    }
    $('#genre-MangaList').append($loader)
    $('.content#genrelist .manga-select').data('loading',true)
    if (mangaList === 404) {
        ISMAXGENREPAGE = true
        $('#genre-MangaList .overlay').children().remove().end().append('<div class="nomore">End of page</div>')
        $('.content#genrelist .manga-select').data('loading',false)
        return
    }
    else ISMAXGENREPAGE = false
    if(!STATUS) return
    for(obj of mangaList){
        appendMangaToHandler('genre-MangaList',obj)
        $('#genre-MangaList .overlay').remove()
        $('.content#genrelist .manga-select').data('loading',false)
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
    $(`#${id} .manga,#${id} h3,#${id} .genre`).fadeOut('fast',function(){        
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
    $manga.append('<div class="bubble"></div>')
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
for(let [href,obj] of Object.entries(main.sendSync('getFavorites'))){
    $('.content#favorites').find(`#source${SOURCES[obj.sourceKey].sourceId}`).find('.mangas').append(deserializeMangaObj(obj))
}
let UPDATES = main.sendSync("getUpdates")
if(UPDATES) parseUpdates(UPDATES)
$('.source-select .dropdown').click(function(){ // CUSTOM DROPDOWN FOR SOURCE SELECTION
    $(this).toggleClass('active')
})
$('.source-select .option').click(function(){ // OPTION HANDLER FOR SOURCE SELECTION
    $('.source-select .option').show()
    $('.source-select .selected').html($(this).html())
    $(this).hide()
    clearMangaHandler('home-searchManga')
    clearMangaHandler('home-mangaList')
    clearMangaHandler('genre-MangaList')
    clearTimeout(updateMangaTimeout)
    clearTimeout(updateGenreTimeout)
    clearTimeout(updateMangaGenreTimeout)
    CURRENT_SOURCE = SOURCES[$(this).prop('id')]
    CURRENT_SOURCE_PAGE=1
    CURRENT_GENRE_PAGE=1
    $('.content#genrelist .genre-list .genre').fadeOut('fast',function(){
        $(this).parent().empty()
    })
    $('.content#home .searchbar *').prop('disabled',false)
    $('.content#home .searchbar *').prop('placeholder',"Enter Keywords...")
    updateMangaList(CURRENT_SOURCE,CURRENT_SOURCE_PAGE)
    updateGenreList(CURRENT_SOURCE)
})
$('.content#home .returnTop').click(function(){ //RETURN TO TOP BUTTON EVT HANDLER
    $('.content#home .manga-select').stop().animate({scrollTop:0}, 500, 'swing');
})
$('.content#genrelist .returnTop').click(function(){ //RETURN TO TOP BUTTON EVT HANDLER
    $(this).parent().stop().animate({scrollTop:0}, 500, 'swing');
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

$('.content#genrelist').scroll(function() { //LOAD NEW PAGE ON SCROLL TO BOTTOM
    if($(this).find("#genre-MangaList").children().length<1) return

    if($(this).scrollTop()>$(this).height())$(this).find('.returnTop').fadeIn().css('display', 'flex');
    else $(this).find('.returnTop').fadeOut()
    if(!CURRENT_SOURCE) return
    if($(this).data("loading")) return
    let hasReachedBottom = ($(this).scrollTop()+$(this).innerHeight()>=this.scrollHeight)
    if(hasReachedBottom&&!ISMAXGENREPAGE){
        updateMangaListFromGenre($(this).find("#genre-MangaList").data('href'),++CURRENT_GENRE_PAGE)
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

$('.genre-list').on('click','.genre',function(){
    $(this).parent().siblings('.manga-handler').data('href',$(this).data('href'))
    $(this).parent().parent().find('#selectedGenre').html(`${$(this).html()} Mangas`).hide().slideDown()
    $('.genre').removeClass('active')
    $(this).addClass('active')
    $('#genre-MangaList').empty()
    $('.content#genrelist .header .clear').fadeIn()
    CURRENT_GENRE_PAGE=1
    updateMangaListFromGenre($(this).data('href'),CURRENT_GENRE_PAGE)
})
$('.content#genrelist .header .clear').click(function(){
    var $clear = $(this)
    $("#genre-MangaList .manga").fadeOut('fast',function(){
        $('.genre').removeClass('active')
        $(this).parent().parent().find('#selectedGenre').html('').slideUp()
        $clear.fadeOut()
        $(this).parent().empty()
    })
})

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
    //if(id==='readMode') id = $(this).parent().attr('id')
    if(id==='preload') $parent.find('.dropdown').toggleClass('disabled')
    $parent.parent().find('h5').slideDown().data('changed','changed')
    setConfig(id,(this.checked)?1:0)
})

$('.modal-content#closePrompt #closeModal').click(function(){
    $('.modal-bg').fadeOut()
})
$('.modal-content#closePrompt #closeElectron').click(function(){
    main.send('close-electron')
})
$('.modal-content#closePrompt #minToTray').click(function(){
    main.send('min-toTray')
})
//$('.content#testing').show()
$('button.navlink#genrelist').click()
