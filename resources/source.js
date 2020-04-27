var axios = require('axios')
var cheerio = require('cheerio')
const puppeteer = require("puppeteer");

function pRequired(type) { throw new Error(`${type} parameter of ${arguments.callee.caller.name} is required!`) }

class Source {
    constructor(){
        this.url;
        this.sourceKey = 'source';
        this._CHROME_PATH = false;
    }
    async retrieveSourceFromUrl( url=pRequired('URL') ,{headless = false, waitFunction = false}){
        let content;
        if(headless) {
            console.time('HEADLESS SCRAPER')
            const browser = await puppeteer.launch(
                {
                    headless:true,
                    args: [
                        '--proxy-server="direct://"',
                        '--proxy-bypass-list=*',
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ],
                    executablePath: this._CHROME_PATH
                }
            )
            const page = await browser.newPage()

            await page.setRequestInterception(true);

            page.on('request', (req) => {
                if(['image','stylesheet','font',].includes(req.resourceType())){
                    req.abort();
                }
                else {
                    req.continue();
                }
            });
            await page.goto(url,{waitUntil:'domcontentloaded'})
            await page.waitForFunction(waitFunction)
            content = await page.content()
            browser.close().then(()=>console.timeEnd('HEADLESS SCRAPER'))

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
    

    async scrapeDiscover(page){ // RETURN VALUE: [MANGA ARRAY, TOTAL PAGE]
        let D = this.discover
        let $$ = await this.retrieveSourceFromUrl(D.urlBuilder(page),D.options)
        
        let mangaArray = []
        let sourceKey = this.sourceKey
        let pages = 
            (page==1)
            ? D.pages($$)
            : false

        $$(D.wrapper).find(D.item)
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
                        manga.latestChapter = _latestChapter.split(':')[0].trim()

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

    async searchFor(keywords,page){ // RETURN VALUE: [MANGA ARRAY, TOTAL PAGE]
        let D = this.search;
        let $$ = await this.retrieveSourceFromUrl(D.urlBuilder(keywords,page),D.options)
        
        let mangaArray = []
        let sourceKey = this.sourceKey;
        let pages = 
            (page==1)
            ? D.pages($$)
            : false

        $$(D.wrapper).find(D.item)
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
                        manga.latestChapter = _latestChapter.split(':')[0].trim()

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

    async scrapeGenre(genreHref,page){ // RETURN VALUE: [MANGA ARRAY, TOTAL PAGE]
        let D = this.genre;
        let $$ = await this.retrieveSourceFromUrl(D.urlBuilder(genreHref,page),D.options)
        
        let mangaArray = []
        let sourceKey = this.sourceKey
        let pages = 
            (page==1)
            ? D.pages($$)
            : false

        $$(D.wrapper).find(D.item)
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
                        manga.latestChapter = _latestChapter.split(':')[0].trim()

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

    async scrapeManga(href){ // RETURN VALUE: MANGA OBJECT
        let D = this.manga
        let $$ = await this.retrieveSourceFromUrl(href,D.options)
    
        let obj = {}

        obj.image = 
            (typeof D.image === 'function')
            ? D.image($$)
            : $$(D.image).prop('src')

        obj.title = 
            (typeof D.title === 'function')
            ? D.title($$)
            : $$(D.title).html()

        obj.altTitles = 
            (typeof D.altTitles === 'function')
            ? D.altTitles($$)
            : $$(D.altTitles).text().split(',')

        let chapters = []
        $$(D.chapter.wrapper).find(D.chapter.item)
            .each(function(){
                chapters.push({
                    text: $$(this).find(D.chapter.text).text().trim(),
                    date: $$(this).find(D.chapter.date).text().trim(),
                    href: $$(this).find(D.chapter.text).prop('href')
                })
            })

        obj.info = D.info($$)

        obj.chapters = chapters.reverse()

        obj.description = 
            (typeof D.description === 'function')
            ? D.description($$)
            : $$(D.description).text()

        return obj
    }

    async checkUpdates(href,title,lastChap){ // RETURN VALUE : BOOLEAN or LATEST CHAPTER STRING
        let D = this.manga
        let $$ = await this.retrieveSourceFromUrl(href,D.options)

        let $$lastChapter = $$(D.chapter.wrapper).find(D.chapter.item).first()
        
        let latest = {}
            latest.text = $$lastChapter.find(D.chapter.text).text().split(':')[0].trim()
            latest.date = $$lastChapter.find(D.chapter.date).text().trim()
            latest.title = title

        if(latest.text===lastChap) 
            return false
        else 
            return latest
    }
    async scrapeGenreList(){} // RETURN VALUE: GENRE ARRAY
    async scrapeChapter(href){
        let D = this.chapter
        console.log('RETRIEVING CHAPTER')
        let $$ = await this.retrieveSourceFromUrl(href,D.options)
        let images = []
        $$(D.wrapper).find(D.item).each(function(){
            images.push($$(this).prop('src'))
        })
        return images
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
        
        this.manga = {
            options : {
                headless: false
            },
            image : '.manga-info-top .manga-info-pic img',
            title : '.manga-info-top .manga-info-text li:nth-child(1) h1',
            altTitles : '.manga-info-top .manga-info-text li:nth-child(1) h2',
            description: ($$) => {return $$('#noidungm').clone().children().remove().end().text().trim() },
            info: this.infoParser,
            chapter:{
                wrapper: '.manga-info-chapter .chapter-list',
                item: '.row',
                text: 'span:nth-child(1) a',
                date: 'span:nth-child(3)'
            },
        }

        this.chapter = {
            options:{
                headless:true,
                waitFunction:'document.querySelector("#vungdoc").childElementCount >1'
            },
            wrapper:'#vungdoc',
            item: 'img:not(:nth-child(1))'
        }
    }
    infoParser($$){
        let info = {}
        $$('.manga-info-top .manga-info-text').find('li').each(function(index){
            switch(index){
                case 1:
                    info.author = []
                    $$(this).find('a').each(function(){
                        info.author.push($$(this).text())
                    })
                    break;
                case 2:
                    info.status = $$(this).text().split(' : ')[1].trim()
                    break;
                case 3:
                    info.lastUpdated = $$(this).text().split(' : ')[1].trim()
                    break;
                case 6:
                    info.genres = []
                    $$(this).find('a').each(function(){
                        info.genres.push($$(this).text())
                    })
                    break;
                case 8:
                    info.rating =  parseFloat($$(this).find('em').filter(function(){
                        return $$(this).attr('property') === 'v:average'
                    }).html())
                    break;
            }
        })
        return info
        
    }


    async scrapeGenreList(){
        let $$ = await this.retrieveSourceFromUrl(this.url,{})
        var genres = {}
        $$('.panel-category table tbody').find('tr').each(function(i){
            if(i<2) return
            $$(this).find('td:not(:nth-child(1))').each(function(){
                let genre = $$(this).text().trim()
                if(genre) genres[genre] = $$(this).find('a').prop('href').split('&').slice(0,-1).join('&')
            })
        })
        return genres
    }
}


module.exports = {Mangakakalots,Source}