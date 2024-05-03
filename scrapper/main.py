import scrapy

class LcrtSpider(scrapy.Spider):
    name = "lcrt"
    start_urls = [
        "https://www.lacartedescolocs.fr/url/1mfl6o",
    ]

    custom_settings = {
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
        'DEFAULT_REQUEST_HEADERS': {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en',
        }
    }

    def parse(self, response):
        # Extract the data you want here.
        # The CSS selectors will depend on the structure of the webpage.
        for item in response.css("div.item"):  # replace 'div.item' with the appropriate selector
            yield {
                "title": item.css("h2::text").get(),  # replace 'h2::text' with the appropriate selector
                "content": item.css("p::text").get(),  # replace 'p::text' with the appropriate selector
            }