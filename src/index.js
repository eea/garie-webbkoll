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
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const webbkoll_backend_uri = "http://"+process.env.BACKEND_HOST + ":" + process.env.BACKEND_PORT;
const webbkoll_uri = "http://"+process.env.WEBBKOLL_HOST + ":" + process.env.WEBBKOLL_PORT+"/check";

const myEmptyGetMeasurement = async (item, data) => {
    return new Promise(async (resolve, reject) => {
        try {
            resolve(data);
        } catch (err) {
            console.log(`Failed to save in influx data for ${url}`, err);
            reject(`Failed to save in influx data for ${url}`);
        }
    });
}

function getResults(url, file){
    const dom = new JSDOM(file);

    var total_multiplier = 1;

    // HTTPS
    var https_score = 0;
    try{
        const https_element = dom.window.document.querySelector("a[href='#https']").closest('li').textContent;
        const https_element_text = https_element.split("HTTPS by default:")[1].trim();
        if (https_element_text === "Yes"){
            https_score = 16;
        }
        if (https_element_text === "Yes, but has issues"){
            https_score = 8;
        }
        if (https_element_text === "No; insecure"){
            https_score = 0;
            total_multiplier = 0;
        }
    }
    catch(err){
        https_score = 0;
    }

    // Content security policy
    var csp_score = 0;
    try{
        const csp_element = dom.window.document.querySelector("a[href='#csp']").closest('li').textContent;
        const csp_element_text = csp_element.split("Content Security Policy:")[1].trim();
        if (csp_element_text === "Good policy") {
            csp_score = 16;
        }
        if (csp_element_text === "Implemented, but has problems") {
            csp_score = 8;
        }
        if ((csp_element_text === "Invalid header") || (csp_element_text === "Not implemented")){
            csp_score = 0;
        }
    }
    catch(err){
        csp_score = 0;
    }

    // Referrer Policy
    var rp_score = 0;
    try{
        const rp_element = dom.window.document.querySelector("a[href='#referrers']").closest('li').textContent;
        const rp_element_text = rp_element.split("Referrer Policy:")[1].trim();
        if (rp_element_text === "Referrers not leaked"){
            rp_score = 16;
        }
        if (rp_element_text === "Referrers partially leaked"){
            rp_score = 8;
        }
        if ((rp_element_text === "Referrers leaked") || (rp_element_text === "Unknown")) {
            rp_score = 0;
        }
    }
    catch(err){
        rp_score = 0;
    }

    // Cookies
    var cookies_score = 0;
    try{
        const cookies_first = dom.window.document.querySelector("#cookies-first");
        const cookies_third = dom.window.document.querySelector("#cookies-third");

        var third_party_exist = true;
        if (cookies_third === undefined){
            third_party_exist = false;
        }

        var all_first_party_green = true;
        if (cookies_first !== undefined){
            if (cookies_first.querySelector("table").querySelectorAll(".icon-times.alert").length > 0){
                all_first_party = false;
            }
        }
        if (!third_party_exist && all_first_party_green){
            cookies_score = 16;
        }
        if (third_party_exist && all_first_party_green){
            cookies_score = 8;
        }
        if (!third_party_exist && !all_first_party_green){
            cookies_score = 8;
        }
    }
    catch(err){
        cookies_score = 0;
    }
    // Third-party requests
    var tpr_score = 0;
    try{
        const tpr_element = dom.window.document.querySelector("a[href='#requests']").closest('li').textContent;
        const tpr_element_text = tpr_element.split("Third-party requests:")[1].trim();

        if (tpr_element_text === "0"){
            tpr_score = 16;
        }
        if (tpr_element_text !== "0"){
            // TODO whitelist for some requests
            tpr_score = 0;
        }
    }
    catch(err){
        tpr_score = 0;
    }

    // Server location
    var server_score = 0;
    try{
        const server_element = dom.window.document.querySelector("a[href='#server-location']").closest('li').textContent;
        const server_element_text = server_element.split("Server location:")[1].split("—")[0].trim();
        if (config.plugins.webbkoll.countries_cat2.includes(server_element_text)) {
            server_score = 16;
        }
        else{
            if (config.plugins.webbkoll.countries_cat1.includes(server_element_text)) {
                server_score = 20;
            }
            else {
                server_score = 0;
                total_multiplier = 0;
            }
        }
    }
    catch(err){
        server_score = 0;
    }

    var total = total_multiplier * (https_score + csp_score + rp_score + cookies_score + tpr_score + server_score);

    var result = [{
        measurement:"webbkoll",
        tags:{url},
        fields:{
            value:total,
            https:https_score,
            content_security_policy:csp_score,
            referrer_policy:rp_score,
            cookies:cookies_score,
            third_party_requests:tpr_score,
            server_location:server_score
        }
    }];
    return (result);
}

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

            const result = getResults(url, html_data);
            resolve(result)
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
      await garie_plugin.init({
        getData:getData,
        getMeasurement:myEmptyGetMeasurement,
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
