'use strict';

const request = require('request-promise');
const cheerio = require('cheerio');
const Homey = require('homey');

const BROADCAST_TITLES = [
    'NOS Journaal', 'Nieuwsuur', 'NOS Jeugdjournaal', 'NOS Sportjournaal', 'NOS Studio Sport Eredivisie', 'NOS Studio Sport', 'NOS Studio Voetbal'
];

class NOS extends Homey.App {

	async onInit() {
		this.programMap = {};

    for (let name of BROADCAST_TITLES) {
      this.programMap[name] = {
        token: new Homey.FlowToken(name, { type: 'string', title: name }),
      };
      this.programMap[name].token.register()
        .catch(err => this.error(`failed to register token ${name}`, err));
    }

		await this.updateBroadcasts();

		// Update broadcast urls every 30 minutes
		setInterval(() => {
			this.updateBroadcasts();
		}, 30 * 60 * 1000);
	}

  updateMap(title, url) {
    this.programMap[title].url = url;
    this.programMap[title].title = title;
    this.programMap[title].token.setValue(url);

    return true
  }

  getBroadcastPage(url) {
    return request
      .get(`https://nos.nl${url}`)
      .catch(err => {
        this.error('Cannot fetch broadcast page', err)
      })
  }

	updateBroadcasts() {
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
          broadcastPromises.push(this.getBroadcastPage(data.attribs.href));
        })

        return Promise.all(broadcastPromises)
      })
      .then(pages => {
        return pages.forEach(page => {
          const $page = cheerio.load(page);

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

          return this.updateMap(title, url)
        })
      })
      .catch(err => {
        this.error('failed to update broadcasts', err);
      });
	}
}

module.exports = NOS;
