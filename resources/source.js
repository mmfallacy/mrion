var axios = require('axios')
class Source {
    constructor(url){
        this.url = url
        this.directive = {
        }
    }
    async getMangaList(){
        let {status, data} = await axios.get(this.url)
        if(status !== 200) throw 'Not 200'
        let $source = $(data)
        console.log(data)
    }
}
class Mangakakalots extends Source{
    constructor(url){
        super(url);
        this.directive = {
            discover: {
                mangaList : '.truyen-list',
                mangaItem: '.list-truyen-item-wrap',
                mangaTitle: 'a:first-child()',
                mangaImage: 'a:first-child() > img',
                latestChap: 'a.list-story-item-wrap-chapter'
            },
            search: {
                mangaList : '.panel_story_list',
                mangaItem: '.story_item',
                mangaTitle: '.story_item_right .story_name a',
                mangaImage: 'a:first-child() > img',
                latestChap: '.story_item_right em:nth-of-type(1) a'
            },
        }
    }
    async getMangaList(page){
        let {status, data} = await axios.get(`${this.url}manga_list/?page=${page}`)
        if(status !== 200) throw 'Not 200'
        let $source = $(data)
        let mangaList = []
        let directive = this.directive.discover
        $source.find(directive.mangaList).find(directive.mangaItem).each(function(){
            let manga = {}
            manga.title = $(this).find(directive.mangaTitle).prop('title')
            manga.image = $(this).find(directive.mangaImage).prop('src')
            manga.latestChap = $(this).find(directive.latestChap).html()
            manga.rating = false
            mangaList.push(manga)
        });
        
        return mangaList
    }
    async searchSourceFor(keywords){
        let {status, data} = await axios.get(`${this.url}search/${keywords}`)
        if(status !== 200) throw 'Not 200'
        let $source = $(data)
        let mangaList = []
        let directive = this.directive.search
        $source.find(directive.mangaList).find(directive.mangaItem).each(function(){
            let manga = {}
            manga.title = $(this).find(directive.mangaTitle).html()
            manga.image = $(this).find(directive.mangaImage).prop('src')
            manga.latestChap = $(this).find(directive.latestChap).html()
            manga.rating = false
            mangaList.push(manga)
        });
        
        return mangaList
    }
}
module.exports.Mangakakalots = Mangakakalots