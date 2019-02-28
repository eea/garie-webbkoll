const garie_plugin = require('garie-plugin')
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const express = require('express');
const bodyParser = require('body-parser');
const serveIndex = require('serve-index');
const request = require('request-promise');

const webbkoll_backend_uri = "http://"+process.env.BACKEND_HOST + ":" + process.env.BACKEND_PORT;

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
            console.log(`Failed to get data for ${url}`, err);
            reject(`Failed to get data for ${url}`);
            resolve(err.error);
        }
    });
}


const myGetData = async (item) => {
    const { url } = item.url_settings;
    return new Promise(async (resolve, reject) => {
        try {
            const { reportDir } = item;
            const reportFolder = garie_plugin.utils.helpers.reportDirNow(reportDir);

            const json_data = await getDataFromBackend(url);

            var json_file = path.join(reportFolder, 'webbkoll.json');

            fs.outputJson(json_file, json_data, {spaces: 2})
            .then(() => console.log(`Saved webbkoll json file for ${url}`))
            .catch(err => {
              console.log(err)
            })


//            await writeReport(jsonReport, reportDirNow)
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
  garie_plugin.init({
    getData:myGetData,
    db_name:'webbkoll',
    plugin_name:'webbkoll',
    report_folder_name:'webbkoll-results',
    app_root: path.join(__dirname, '..'),
    config:config
  });
}

if (process.env.ENV !== 'test') {
  app.listen(3000, async () => {
    console.log('Application listening on port 3000');
    await main();
  });
}
