var axios = require('axios')
var cheerio = require('cheerio')
var puppeteer = require('puppeteer')
 
function pRequired(type) { throw new Error(`${type} parameter of ${arguments.callee.caller.name} is required!`) }

class Source {
    constructor(){
        this.url;
        this.sourceKey = 'source';
    }
    async retrieveSourceFromUrl( url=pRequired('URL') ,{headless = false, waitSelector = 'html'}){
        let content;
        if(headless) {
            const browser = await puppeteer.launch()
            const page = await browser.newPage()

            await page.goto(url)
            await page.waitForSelector(waitSelector)

            content = await page.content()

            await browser.close()
        }
        else{
            try {
                var {status, data} = await axios.get(url)
            }
            catch(err){
                throw err
            }
            if(status!==200) throw new Error(status)

            content = data;
        }
        let $$ = cheerio.load(content)

        return $$
    }
    

    async scrapeDiscover(page){
        let D = this.discover
        let $$ = await this.retrieveSourceFromUrl(D.urlBuilder(page),D.options)
        
        let mangaArray = []
        let sourceKey = this.sourceKey
        let pages = D.pages($$);
        $$('html').find(D.wrapper).find(D.item)
            .each(function(){
                let manga = {}
                // POPULATE MANGA OBJ ITEMS
                    manga.title = 
                        (typeof D.title === 'function')
                        ? D.title($$, $$(this))
                        : $$(this).find(D.title).html()
                        
                    manga.image = 
                        (typeof D.image === 'function')
                        ? D.image($$, $$(this))
                        : $$(this).find(D.image).prop('src')

                    let _latestChapter = 
                        (typeof D.latestChapter === 'function')
                        ? D.latestChapter($$, $$(this))
                        : $$(this).find(D.latestChapter).html()
                    if(_latestChapter) 
                        manga.latestChapter = _latestChapter.trim()

                    manga.rating = 
                        (typeof D.rating === 'function')
                        ? D.rating($$, $$(this))
                        : $$(this).find(D.rating).html()

                    manga.href = 
                        (typeof D.href === 'function')
                        ? D.href($$, $$(this))
                        : $$(this).find(D.href).prop('href')
                    
                    
                    manga.sourceKey = sourceKey

                    mangaArray.push(manga)

            });
            return [mangaArray,pages];
    }

    async searchFor(keywords,page){
        let D = this.search;
        let $$ = await this.retrieveSourceFromUrl(D.urlBuilder(keywords,page),D.options)
        
        let mangaArray = []
        let sourceKey = this.sourceKey;
        let pages = D.pages($$);
        $$('html').find(D.wrapper).find(D.item)
            .each(function(){
                let manga = {}
                // POPULATE MANGA OBJ ITEMS
                    manga.title = 
                        (typeof D.title === 'function')
                        ? D.title($$, $$(this))
                        : $$(this).find(D.title).html()
                        
                    manga.image = 
                        (typeof D.image === 'function')
                        ? D.image($$, $$(this))
                        : $$(this).find(D.image).prop('src')

                    let _latestChapter = 
                        (typeof D.latestChapter === 'function')
                        ? D.latestChapter($$, $$(this))
                        : $$(this).find(D.latestChapter).html()
                    if(_latestChapter) 
                        manga.latestChapter = _latestChapter.trim()

                    manga.rating = 
                        (typeof D.rating === 'function')
                        ? D.rating($$, $$(this))
                        : $$(this).find(D.rating).html()

                    manga.href = 
                        (typeof D.href === 'function')
                        ? D.href($$, $$(this))
                        : $$(this).find(D.href).prop('href')
                    
                    
                    manga.sourceKey = sourceKey

                    mangaArray.push(manga)

            });
            return [mangaArray, pages];
    }

    async scrapeGenre(genreHref,page){
        let D = this.genre;
        let $$ = await this.retrieveSourceFromUrl(D.urlBuilder(genreHref,page),D.options)
        
        let mangaArray = []
        let sourceKey = this.sourceKey
        let pages = D.pages($$)

        $$('html').find(D.wrapper).find(D.item)
            .each(function(){
                let manga = {}
                // POPULATE MANGA OBJ ITEMS
                    manga.title = 
                        (typeof D.title === 'function')
                        ? D.title($$, $$(this))
                        : $$(this).find(D.title).html()
                        
                    manga.image = 
                        (typeof D.image === 'function')
                        ? D.image($$, $$(this))
                        : $$(this).find(D.image).prop('src')

                    let _latestChapter = 
                        (typeof D.latestChapter === 'function')
                        ? D.latestChapter($$, $$(this))
                        : $$(this).find(D.latestChapter).html()
                    if(_latestChapter) 
                        manga.latestChapter = _latestChapter.trim()

                    manga.rating = 
                        (typeof D.rating === 'function')
                        ? D.rating($$, $$(this))
                        : $$(this).find(D.rating).html()

                    manga.href = 
                        (typeof D.href === 'function')
                        ? D.href($$, $$(this))
                        : $$(this).find(D.href).prop('href')
                    
                    
                    manga.sourceKey = sourceKey

                    mangaArray.push(manga)

            });
            return [mangaArray, pages];
    }
}


class Mangakakalots extends Source{
    constructor(){
        super();
        this.url = 'https://mangakakalots.com/';
        this.sourceKey = 'mangakakalots'
        this.discover = {
            urlBuilder: (page = 1) => { return`${this.url}manga_list/?page=${page}` },
            options: {
                headless:false
            },
            wrapper: '.truyen-list',
            item:  '.list-truyen-item-wrap',
            title: ($$, $$scope)=>{return $$scope.find('a:nth-child(1)').prop('title')},
            href:'a:nth-child(1)',
            image: 'a:nth-child(1) > img',
            latestChapter: 'a.list-story-item-wrap-chapter',
            rating: ($$, $$scope) => {return -1},

            pages: ($$) => {
                let _pages = $$('.panel_page_number').find('.page_last').html()
                return (_pages)?parseInt(_pages.slice(5,-1)):1
            },
        } 
        this.search = {
            urlBuilder: (keywords, page = 1) => { return `${this.url}search/${keywords}?page=${page}`},
            options: {
                headless:false
            },
            wrapper : '.panel_story_list',
            item: '.story_item',
            title: '.story_item_right .story_name a',
            image: 'a:nth-child(1) > img',
            href: '.story_item_right .story_name a',
            latestChapter: '.story_item_right em:nth-of-type(1) a',
            rating: ($$, $$scope) => {return -1},

            pages: ($$) => {
                let _pages = $$('.panel_page_number').find('.page_last').html()
                return (_pages)?parseInt(_pages.slice(5,-1)):1
            },
        }

        this.genre = {...this.discover}
        this.genre.urlBuilder = (genreUrl,page=1) => {return `${genreUrl}&page=${page}`}
    }
}


module.exports = {Mangakakalots}