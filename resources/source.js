var axios = require('axios')
class Source {
    constructor(url){
        this.url = url
        this.directive = {
        }
    }
    async getMangaList(page){
        let directive = this.directive.discover
        let {status, data} = await axios.get(`${this.url}${directive.urlAdd}${directive.pageAdd}${page}`)
        if(status !== 200) throw 'Not 200'
        let $source = $(data)
        let mangaList = []
        $source.find(directive.mangaList).find(directive.mangaItem).each(function(){
            let manga = {}
            manga.title = (typeof directive.titleParser!=='function')?$(this).find(directive.mangaTitle).html():directive.titleParser($(this).find(directive.mangaTitle))
            manga.image = (typeof directive.imgParser!=='function')?$(this).find(directive.mangaImage).prop('src'):directive.imgParser($(this).find(directive.mangaImage))
            manga.latestChap = $(this).find(directive.latestChap).html()
            manga.rating = (!directive.rating)?false : manga.rating= $(this).find(directive.rating).html()
            mangaList.push(manga)
        });
        
        return mangaList
    }
    async searchSourceFor(keywords){
        let directive = this.directive.search
        let {status, data} = await axios.get(`${this.url}${directive.urlAdd}${keywords}`)
        if(status !== 200) throw 'Not 200'
        let $source = $(data)
        let mangaList = []
        $source.find(directive.mangaList).find(directive.mangaItem).each(function(){
            let manga = {}
            manga.title = $(this).find(directive.mangaTitle).html()
            manga.image = $(this).find(directive.mangaImage).prop('src')
            manga.latestChap = $(this).find(directive.latestChap).html()
            manga.rating = (!directive.rating)?false : manga.rating= $(this).find(directive.rating).html()
            mangaList.push(manga)
        });
        
        return mangaList
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
                mangaTitle: 'a:first-child()',
                mangaImage: 'a:first-child() > img',
                latestChap: 'a.list-story-item-wrap-chapter',
                urlAdd: 'manga_list/',
                pageAdd: '?page=',
                rating: false,
                titleParser: function($selector){
                    return $selector.prop('title')
                }
            },
            search: {
                mangaList : '.panel_story_list',
                mangaItem: '.story_item',
                mangaTitle: '.story_item_right .story_name a',
                mangaImage: 'a:first-child() > img',
                latestChap: '.story_item_right em:nth-of-type(1) a',
                urlAdd: 'search/',
                rating: false,
            },
        }
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
                latestChap: '.item-summary .list-chapter .chapter-item:first-child() span a',
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
        }
    }
    imgParser($selector){
        if(!$selector[0]) return ''
        if (!$selector.prop('srcset')) return $selector.prop('src')
        let temp = $selector.prop('srcset').split(', ')
        let srcset = {}
        for(let array of temp){
            var [src, key] = array.split(' ')
            srcset[key] = src
        }
        let maxKey = `${Object.keys(srcset).reduce((a,b)=>{
            return Math.max(parseInt(a.slice(0,-1)),parseInt(b.slice(0,-1)))
        })}w`
        return srcset[maxKey]
    }
}
module.exports.Mangakakalots = Mangakakalots
module.exports.KissManga = KissManga
