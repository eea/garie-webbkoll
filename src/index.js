const garie_plugin = require('garie-plugin')
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const request = require('request-promise').defaults({jar: true});
const sleep = require('sleep-promise');
const scrape = require('website-scraper');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const webbkoll_backend_uri = "http://"+process.env.BACKEND_HOST + ":" + process.env.BACKEND_PORT;
const webbkoll_uri = "http://"+process.env.WEBBKOLL_HOST + ":" + process.env.WEBBKOLL_PORT + "/en/check";
const webbkoll = "http://"+process.env.WEBBKOLL_HOST + ":" + process.env.WEBBKOLL_PORT;

const default_countries_cat1 = [
        "Denmark",
        "Unknown"
    ];
const default_countries_cat2 = [
        "Austria",
        "Belgium",
        "Bulgaria",
        "Croatia",
        "Cyprus",
        "Czechia",
        "Denmark",
        "Estonia",
        "Finland",
        "France",
        "Germany",
        "Greece",
        "Hungary",
        "Ireland",
        "Italy",
        "Latvia",
        "Lithuania",
        "Luxembourg",
        "Malta",
        "Netherlands",
        "Poland",
        "Portugal",
        "Romania",
        "Slovakia",
        "Slovenia",
        "Spain",
        "Sweden",
        "United Kingdom"
    ];


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

function getSummaryStatus(dom, anchorHref) {
    try {
        const li = dom.window.document.querySelector(`a[href='${anchorHref}']`).closest('li');
        if (li.querySelector('.success')) return 'success';
        if (li.querySelector('.warning')) return 'warning';
        if (li.querySelector('.alert')) return 'alert';
        return null;
    } catch (err) {
        return null;
    }
}

function countCookieAlerts(dom, tableId) {
    try {
        const table = dom.window.document.querySelector(`#${tableId}`);
        if (!table) return 0;
        return table.querySelectorAll('span.alert').length;
    } catch (err) {
        return 0;
    }
}

function getResults(url, file){
    const dom = new JSDOM(file);

    let https_score = 0;
    const https_status = getSummaryStatus(dom, '#https');
    if (https_status === 'success') https_score = 20;
    else if (https_status === 'warning') https_score = 10;

    let hsts_score = 0;
    try {
        const hsts_section = dom.window.document.querySelector('#hsts');
        if (hsts_section) {
            const hsts_header = hsts_section.closest('section').querySelector('h3');
            if (hsts_header && hsts_header.querySelector('.success')) {
                hsts_score = 10;
            } else if (hsts_header && hsts_header.querySelector('.warning')) {
                hsts_score = 5;
            }
        }
    } catch (err) {}

    let csp_score = 0;
    const csp_status = getSummaryStatus(dom, '#csp');
    if (csp_status === 'success') csp_score = 20;
    else if (csp_status === 'warning') csp_score = 10;

    let rp_score = 0;
    const rp_status = getSummaryStatus(dom, '#referrers');
    if (rp_status === 'success') rp_score = 10;
    else if (rp_status === 'warning') rp_score = 5;

    let sri_score = 0;
    try {
        const sri_section = dom.window.document.querySelector('#sri');
        if (sri_section) {
            const sri_header = sri_section.closest('section').querySelector('h3');
            if (sri_header && sri_header.querySelector('.success')) {
                sri_score = 10;
            } else if (sri_header && sri_header.querySelector('.warning')) {
                sri_score = 5;
            }
        }
    } catch (err) {}

    let headers_score = 0;
    try {
        const headers_table = dom.window.document.querySelector('#headers table');
        if (headers_table) {
            const rows = headers_table.querySelectorAll('tbody tr');
            let passed = 0;
            let total = 0;
            rows.forEach(row => {
                const passCell = row.querySelector('td.pass');
                if (passCell) {
                    total++;
                    if (passCell.querySelector('.success')) passed++;
                }
            });
            if (total > 0) {
                headers_score = Math.round((passed / total) * 10);
            }
        }
    } catch (err) {}

    let cookies_score = 0;
    try {
        const cookies_first = dom.window.document.querySelector('#cookies-first');
        const cookies_third = dom.window.document.querySelector('#cookies-third');

        const first_party_alerts = countCookieAlerts(dom, 'cookies-first');
        const third_party_alerts = countCookieAlerts(dom, 'cookies-third');

        const has_third_party = (cookies_third !== null);

        if (!has_third_party && first_party_alerts === 0) {
            cookies_score = 10;
        } else if (has_third_party && third_party_alerts === 0 && first_party_alerts === 0) {
            cookies_score = 8;
        } else if (first_party_alerts > 0) {
            cookies_score = Math.max(0, 10 - first_party_alerts * 2);
        }
        if (has_third_party && third_party_alerts > 0) {
            cookies_score = Math.max(0, cookies_score - third_party_alerts * 2);
        }
    } catch (err) {}

    let tpr_score = 0;
    try {
        const tpr_li = dom.window.document.querySelector("a[href='#requests']").closest('li');
        const strong = tpr_li.querySelector('strong');
        if (strong) {
            const count = parseInt(strong.textContent.trim(), 10);
            if (!isNaN(count)) {
                if (count === 0) {
                    tpr_score = 10;
                } else if (count <= 3) {
                    tpr_score = 8;
                } else if (count <= 10) {
                    tpr_score = 5;
                } else if (count <= 50) {
                    tpr_score = 2;
                }
            }
        }
        const host_count_li = dom.window.document.querySelector("a[href='#requests']").closest('section')
            || dom.window.document.querySelector('#requests');
    } catch (err) {}

    let server_score = 0;
    const countries_cat1 = config.plugins.webbkoll.countries_cat1 || default_countries_cat1;
    const countries_cat2 = config.plugins.webbkoll.countries_cat2 || default_countries_cat2;
    try {
        const server_section = dom.window.document.querySelector('#server-location');
        if (server_section) {
            const alpha_div = server_section.closest('section').querySelector('.alpha');
            if (alpha_div) {
                const text = alpha_div.textContent;
                let found_country = null;
                for (const country of [...countries_cat1, ...countries_cat2]) {
                    if (text.includes(country)) {
                        found_country = country;
                        break;
                    }
                }
                if (found_country) {
                    if (countries_cat1.includes(found_country)) {
                        server_score = 10;
                    } else if (countries_cat2.includes(found_country)) {
                        server_score = 7;
                    }
                }
                if (!found_country) {
                    const server_li = dom.window.document.querySelector("a[href='#server-location']").closest('li');
                    const li_text = server_li.textContent;
                    for (const country of countries_cat1) {
                        if (li_text.includes(country)) {
                            server_score = 10;
                            break;
                        }
                    }
                    if (server_score === 0) {
                        for (const country of countries_cat2) {
                            if (li_text.includes(country)) {
                                server_score = 7;
                                break;
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {}

    const raw_total = https_score + hsts_score + csp_score + rp_score
        + sri_score + headers_score + cookies_score + tpr_score + server_score;
    const MAX_POSSIBLE = 110;
    const total = Math.round((raw_total / MAX_POSSIBLE) * 100);

    const result = [{
        measurement:"webbkoll",
        tags:{url},
        fields:{
            value:total,
            https:https_score,
            hsts:hsts_score,
            content_security_policy:csp_score,
            referrer_policy:rp_score,
            subresource_integrity:sri_score,
            security_headers:headers_score,
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

function cleanupSVGs(folder, page) {
    // get all countries' code
    const regexp = /flag-icon-(\w+)/g;
    const flags = [...page.matchAll(regexp)];
    const flags_with_separator = flags.map((elem) => elem[1] + "-");

    const nameHasFlag = (name) => {
        // check if flag svg or other kind
        if (name.match(/^[a-z][a-z]-/) === null) {
            return false;
        }
        if (flags_with_separator.length === 0) {
            return true;
        }
        for (let flag in flags_with_separator) {
            if (name.startsWith(flag)) {
                return true;
            }
        }
        return false;
    }

    const directoryPath = path.join(folder, 'fonts');
    fs.readdir(directoryPath, function (err, files) {
        if (err) {
            return console.log('Unable to scan directory to remove svg files: ', err);
        }
        files.forEach(function (file) {
            const [name, ext] = file.split('.');
            if (nameHasFlag(name) && ext === 'svg') {
                try {
                    fs.unlinkSync(folder + '/fonts/'+file);
                } catch(err) {
                    console.error("Couldn't remove svg flag file", err);
                }
            }
        });
    });


}


const getDataFromWebbkoll = async( url, folder ) => {
    return new Promise(async (resolve, reject) => {
        try {
            await sleep(5000)

            // get the csrf token to be able to POST for the result
            let response = await request({
                method: 'GET',
                uri: webbkoll,
                resolveWithFullResponse: true
            });

            const res = response.body.split('_csrf_token')[1];
            const token = res.split('"')[4];

            // simple:false necessary so we don't throw error when 302
            response = await request({
                method: 'POST',
                uri: webbkoll_uri,
                simple: false,
                form: {
                '_csrf_token': token,
                'url': url,
                },
                resolveWithFullResponse: true
            });

            const status_uri = response.headers.location;

            let next_uri;
            // we have to redirect to the previous headers.location
            while (true){
                const status_response = await request({
                    method: 'GET',
                    uri: webbkoll + status_uri,
                    simple: false,
                    followRedirect: false,
                    resolveWithFullResponse: true
                });

                // we wait for the result, so we query constantly until we have response different than status
                if (status_response.headers.location !== undefined)
                    next_uri = status_response.headers.location;
                else
                    next_uri = status_uri;

                if (next_uri !== status_uri) {
                    break;
                }
                await sleep(500)
            }
            const options = {
                urls: [{url: webbkoll + next_uri, filename: 'webbkoll.html'},],
                directory: folder,
            };
            const page_result = await scrape(options);
            cleanupSVGs(folder, page_result[0].text);

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

            let html_data = await getDataFromWebbkoll(url, reportFolder);

            html_data = html_data.replace("</html>","<style type='text/css'>header.navigation,#results-title>.beta,.footer-outer{display:none !important;}</style></html>");

            const html_file = path.join(reportFolder, 'webbkoll.html');

            fs.outputFile(html_file, html_data)
            .then(() => console.log(`Saved webbkoll html file for ${url}`))
            .catch(err => {
              console.log(err)
            })

            const json_data = await getDataFromBackend(url);

            const json_file = path.join(reportFolder, 'webbkoll.json');

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


const main = async () => {
  try{

    const { app } = await garie_plugin.init({
      getData:getData,
      getMeasurement:myEmptyGetMeasurement,
      db_name:'webbkoll',
      plugin_name:'webbkoll',
      report_folder_name:'webbkoll-results',
      app_root: path.join(__dirname, '..'),
      config:config,
      onDemand: true
    });
    app.listen(3000, () => {
      console.log('Application listening on port 3000');
    });
  }
  catch(err){
    console.log(err);
  }
}

if (process.env.ENV !== 'test') {
  main();
}
