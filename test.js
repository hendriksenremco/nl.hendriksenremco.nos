const request = require('request-promise');
const cheerio = require('cheerio');

const BROADCAST_TITLES = [
    'NOS Journaal', 'Nieuwsuur', 'NOS Jeugdjournaal', 'NOS Sportjournaal', 'NOS Studio Sport Eredivisie', 'NOS Studio Sport', 'NOS Studio Voetbal'
];

function getBroadcastPage(url) {
  return request
    .get(`https://nos.nl${url}`)
}

return request
  .get('https://nos.nl/uitzendingen/')
  .then(res => {
    const $ = cheerio.load(res);
    return $('.broadcast-programs a');
  })
  .then($links => {
    let broadcastPromises = [];

    $links.each((index, data) => {
      const broadcastTitle = data.children[0].data.trim();
      const broadcastUrl = data.attribs.href;
      if(!BROADCAST_TITLES.includes(broadcastTitle)) return;
      broadcastPromises.push(getBroadcastPage(data.attribs.href));
    })

    return Promise.all(broadcastPromises)
  })
  .then(pages => {
    pages.forEach(page => {
      $page = cheerio.load(page);

      // Find script tag with videoplayer config
      const script = $page('script[data-ssr-name="components/nos/broadcast/VideoPlayer/VideoPlayer"]').contents().first().text();
      if(!script) return;
      const scriptJson = JSON.parse(script);

      // Only get the highest quality
      const highestQualtity = scriptJson.formats.filter(item => {
        return item.name === '720p'
      })[0]
      const url = highestQualtity.url.mp4

      // Fetch page title
      let title = $page('title').contents().first().text().trim();
      title = title.replace(' | NOS','');
    })
  })
  .catch(err => {
    console.error('failed to update broadcasts', err);
  });
