var axios = require('axios')
var cheerio = require('cheerio')
class Source {
    constructor(url){
        this.url = url
        this.directive = {
        }
    }
    async getSourceFromUrl(url){
        let directive = this.directive.discover
        let {status, data} = await axios.get(url)
        if(status !== 200) throw 'Not 200'
        var $$ = cheerio.load(data)
        return [$$,$$('html')]
    }
    async getMangaList(page){
        let directive = this.directive.discover
        var [$$,$$source] = await this.getSourceFromUrl(`${this.url}${directive.urlAdd}${directive.pageAdd}${page}`)
        let mangaList = []
        $$source.find(directive.mangaList).find(directive.mangaItem).each(function(i,element){
            let manga = {}
            manga.title = (typeof directive.titleParser!=='function')
                ? $$(this).find(directive.mangaTitle).html()
                : directive.titleParser( $$ , $$(this).find(directive.mangaTitle) )

            manga.image = (typeof directive.imgParser!=='function')
                ? $$(this).find(directive.mangaImage).prop('src')
                : directive.imgParser( $$ , $$(this).find(directive.mangaImage) )

            manga.latestChap = $$(this).find(directive.latestChap).html()

            manga.rating = (!directive.rating)?
                false 
                : manga.rating= $$(this).find(directive.rating).html()

            manga.href = $$(this).find(directive.mangaTitle).prop('href')

            mangaList.push(manga)
        });
        return mangaList
    }
    async searchSourceFor(keywords){
        let directive = this.directive.search
        var [$$,$$source] = await this.getSourceFromUrl(`${this.url}${directive.urlAdd}${keywords}`)
        let mangaList = []
        $$source.find(directive.mangaList).find(directive.mangaItem).each(function(){
            let manga = {}

            manga.title = (typeof directive.titleParser!=='function')
                ? $$(this).find(directive.mangaTitle).html()
                : directive.titleParser($$,$$(this).find(directive.mangaTitle))

            manga.image = (typeof directive.imgParser!=='function')
                ? $$(this).find(directive.mangaImage).prop('src')
                : directive.imgParser($$,$$(this).find(directive.mangaImage))

            manga.latestChap = $$(this).find(directive.latestChap).html()

            manga.rating = (!directive.rating)
                ? false 
                : manga.rating= $$(this).find(directive.rating).html()
            manga.href = $$(this).find(directive.mangaTitle).prop('href')
            mangaList.push(manga)
        });
        
        return mangaList
    }
    async scanMangaHref(href){
        let directive = this.directive.manga
        var [$$,$$source] = await this.getSourceFromUrl(href)
        let obj = {}

        obj.image = $$source.find(directive.image).prop('src')
        obj.title = $$source.find(directive.title).html()
        obj.altTitles = $$source.find(directive.altTitle).text().split(',')
        
        let chapters = []
        
        $$source.find(directive.chapter.parent).find(directive.chapter.el).each(function(){
            let chapter = {}
            chapter.text = $$(this).find(directive.chapter.text).text().split(':')[0].trim()
            chapter.date = $$(this).find(directive.chapter.date).text().trim()
            chapters.push(chapter)
        })

        obj.info = (typeof directive.infoParser!=='function')
            ? 'test'
            : directive.infoParser($$, $$source.find(directive.info))

        obj.chapters = chapters

        obj.description = (typeof directive.descriptionParser!=='function')
            ? $$source.find(directive.description).html()
            : directive.descriptionParser($$, $$source.find(directive.description))

        return obj
    }
    async checkHrefForUpdates(href,title,lastChap){
        let directive = this.directive.manga
        var [$$,$$source] = await this.getSourceFromUrl(href)
        let latestChapter = {}
        let $$chapSelector = $$source.find(directive.chapter.parent).find(directive.chapter.el).first()
        latestChapter.text = $$chapSelector.find(directive.chapter.text).text().split(':')[0].trim()
        latestChapter.date = $$chapSelector.find(directive.chapter.date).text().trim()
        latestChapter.title = title
        if(latestChapter.text===lastChap) return false
        return latestChapter

    }
}
class Mangakakalots extends Source{
    constructor(url){
        super(url);
        this.searchBuilder = '_';
        this.directive = {
            discover: {
                mangaList : '.truyen-list',
                mangaItem: '.list-truyen-item-wrap',
                mangaTitle: 'a:nth-child(1)',
                mangaImage: 'a:nth-child(1) > img',
                latestChap: 'a.list-story-item-wrap-chapter',
                urlAdd: 'manga_list/',
                pageAdd: '?page=',
                rating: false,
                titleParser: function($$,$$selector){
                    return $$selector.prop('title')
                }
            },
            search: {
                mangaList : '.panel_story_list',
                mangaItem: '.story_item',
                mangaTitle: '.story_item_right .story_name a',
                mangaImage: 'a:nth-child(1) > img',
                latestChap: '.story_item_right em:nth-of-type(1) a',
                urlAdd: 'search/',
                rating: false,
            },
            manga:{
                image : '.manga-info-top .manga-info-pic img',
                title : '.manga-info-top .manga-info-text li:nth-child(1) h1',
                altTitle : '.manga-info-top .manga-info-text li:nth-child(1) h2',
                description:'#noidungm',
                info: '.manga-info-top .manga-info-text',
                chapter:{
                    parent: '.manga-info-chapter .chapter-list',
                    el: '.row',
                    text: 'span:nth-child(1) a',
                    date: 'span:nth-child(3)'
                },
                descriptionParser: this.descriptionParser,
                infoParser: this.infoParser
            }
        }
    }
    
    infoParser($$, $$selector){
        let info = {}
        $$selector.find('li').each(function(index){
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
    descriptionParser($$, $$selector){
        return $$selector.clone().children().remove().end().text().trim()
    }
}


class KissManga extends Source{
    constructor(url){
        super(url);
        this.searchBuilder = '+';
        this.directive = {
            discover: {
                mangaList : '.page-content-listing',
                mangaItem: '.page-item-detail.manga ',
                mangaTitle: '.item-summary .post-title.font-title a',
                mangaImage: '.item-thumb a img',
                latestChap: '.item-summary .list-chapter .chapter-item:nth-child(1) span a',
                urlAdd: 'manga-list/',
                pageAdd: '',
                rating: '.item-summary .post-total-rating .total_votes',
                imgParser: this.imgParser
            },
            search: {
                mangaList : '.c-tabs-item',
                mangaItem: '.row.c-tabs-item__content',
                mangaTitle: '.tab-summary .post-title a',
                mangaImage: '.tab-thumb a img',
                latestChap: '.tab-meta .latest-chap .chapter a',
                urlAdd: '?post_type=wp-manga&s=',
                rating: '.tab-meta .rating .post-total-rating .total_votes',
                imgParser: this.imgParser
            },
            manga:{
                image : '.container .tab-summary .summary_image a img',
                title : '.container .post-title h1',
                altTitle : '.container  .tab-summary .summary_content_wrap .summary_content .post-content_item:nth-child(5) .summary-content',
                description:'.description-summary .summary__content p',
                info: '.container  .tab-summary .summary_content_wrap .summary_content .post-content',
                chapter:{
                    parent: '.listing-chapters_wrap .main',
                    el: '.wp-manga-chapter',
                    text: 'a',
                    date: '.chapter-release-date'
                },
                imgParser:this.imgParser,
                infoParser: this.infoParser
            },
        }
    }
    imgParser($$,$$selector){
        if(!$$selector[0]) return ''
        if (!$$selector.prop('srcset')) return $$selector.prop('src')
        let temp = $$selector.prop('srcset').split(', ')
        let srcset = {}
        let srcval = []
        for(let array of temp){
            var [src, key] = array.split(' ')
            srcset[key] = src
            srcval.push(parseInt(key.slice(0,-1)))
        }

        let maxKey = `${srcval.reduce((a,b)=>{
            return Math.max(a,b)
        })}w`
        return srcset[maxKey]
    }
    infoParser($$,$$selector){
        let info = {}
        info.rating = $$selector.find('.post-total-rating').find('.score').html()
        info.status = $$selector.siblings('.post-status').find('.post-content_item:nth-child(2) .summary-content').html()
        info.lastUpdated = $$('html').find('.listing-chapters_wrap .main').first().find('.chapter-release-date').html()
        $$selector.find('.post-content_item').each(function(index){
            switch(index){
                case 3:
                    info.author = []
                    $$(this).find('.summary-content').find('.author-content').find('a').each(function(){

                        info.author.push($$(this).html())
                    })
                    if(info.author.includes('Updating')) info.author = ["Not Specified"]
                    break;
                case 5:
                    info.genres = []
                    $$(this).find('.summary-content').find('.genres-content').find('a').each(function(){
                        info.genres.push($$(this).html())
                    })
                    if(info.author.includes('Updating')) info.author = ["Not Specified"]
                    break;
            }
        })
        return info
    }
}
module.exports.Mangakakalots = Mangakakalots
module.exports.KissManga = KissManga
