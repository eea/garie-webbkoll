const garie_plugin = require('garie-plugin')
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const express = require('express');
const bodyParser = require('body-parser');
const serveIndex = require('serve-index');
const request = require('request-promise');
const sleep = require('sleep-promise');
const scrape = require('website-scraper');

const webbkoll_backend_uri = "http://"+process.env.BACKEND_HOST + ":" + process.env.BACKEND_PORT;
const webbkoll_uri = "http://"+process.env.WEBBKOLL_HOST + ":" + process.env.WEBBKOLL_PORT+"/check";

const getDataFromBackend = async( url ) => {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await request({
                method: 'GET',
                uri: webbkoll_backend_uri,
                qs: {
                  'fetch_url': url
                },
                json: true,
                resolveWithFullResponse: true
            });
            resolve(response.body);
        } catch (err) {
            if (err.error !== undefined) {
                if (err.error.success === false){
                    console.log(`Failed to get data for ${url}`);
                    resolve(err.error);
                    return;
                }
            }
            console.log(`Failed to get json data for ${url}`, err);
            reject(`Failed to get json data for ${url}`);
            resolve(err.error);
        }
    });
}


const getDataFromWebbkoll = async( url, folder ) => {
    return new Promise(async (resolve, reject) => {
        try {
            await sleep(5000)
            const response = await request({
                method: 'GET',
                uri: webbkoll_uri,
                qs: {
                  'url': url,
                  'refresh': 'on'
                },
                resolveWithFullResponse: true
            });
            const status_uri = response.request.uri.href;

            var next_uri;
            while (true){
                const status_response = await request({
                    method: 'GET',
                    uri: status_uri,
                    resolveWithFullResponse: true
                });
                next_uri = status_response.request.uri.href;
                if (next_uri !== status_uri){
                    break;
                }
                await sleep(500)
            }
            const options = {
                urls: [{url: next_uri, filename: 'webbkoll.html'},],
                directory: folder,
            };
            const page_result = await scrape(options);

            resolve(page_result[0].text);
        } catch (err) {
            if (err.error !== undefined) {
                if (err.error.success === false){
                    console.log(`Failed to get data for ${url}`);
                    resolve(err.error);
                    return;
                }
            }
            console.log(`Failed to get html data for ${url}`, err);
            reject(`Failed to get html data for ${url}`);
            resolve(err.error);
        }
    });
}

const getData = async (item) => {
    const { url } = item.url_settings;
    return new Promise(async (resolve, reject) => {
        try {
            const { reportDir } = item;
            const reportFolder = garie_plugin.utils.helpers.reportDirNow(reportDir);


            var html_data = await getDataFromWebbkoll(url, reportFolder);

            html_data = html_data.replace("</html>","<style type='text/css'>header.navigation,#results-title>.beta,.footer-outer{display:none !important;}</style></html>");

            var html_file = path.join(reportFolder, 'webbkoll.html');

            fs.outputFile(html_file, html_data)
            .then(() => console.log(`Saved webbkoll html file for ${url}`))
            .catch(err => {
              console.log(err)
            })

            const json_data = await getDataFromBackend(url);

            var json_file = path.join(reportFolder, 'webbkoll.json');

            fs.outputJson(json_file, json_data, {spaces: 2})
            .then(() => console.log(`Saved webbkoll json file for ${url}`))
            .catch(err => {
              console.log(err)
            })

            var data = {}
            resolve(data);
        } catch (err) {
            console.log(`Failed to get data for ${url}`, err);
            reject(`Failed to get data for ${url}`);
        }
    });
}



console.log("Start");


const app = express();
app.use('/reports', express.static('reports'), serveIndex('reports', { icons: true }));

const main = async () => {
  return new Promise(async (resolve, reject) => {
    try{
      garie_plugin.init({
        getData:getData,
        db_name:'webbkoll',
        plugin_name:'webbkoll',
        report_folder_name:'webbkoll-results',
        app_root: path.join(__dirname, '..'),
        config:config
      });
    }
    catch(err){
      reject(err);
    }
  });
}

if (process.env.ENV !== 'test') {
  const server = app.listen(3000, async () => {
    console.log('Application listening on port 3000');
    try{
      await main();
    }
    catch(err){
      console.log(err);
      server.close();
    }
  });
}
