
# Garie webbkoll plugin

<p align="center">
  <p align="center">Tool to gather webbkoll reports and supports CRON jobs.<p>
</p>

**Highlights**

-   Poll for [webbkoll](https://github.com/andersju/webbkoll) reports on any website and stores the data into InfluxDB
-   View all historic webbkoll reports
-   Setup within minutes

## Overview of garie-webbkoll

Garie-webbkoll was developed as a plugin for the [Garie](https://github.com/boyney123/garie) Architecture.

[Garie](https://github.com/boyney123/garie) is an out the box web performance toolkit, and `garie-webbkoll` is a plugin that generates and stores [webbkoll](https://github.com/andersju/webbkoll) reports in HTML and JSON format.

`Garie-webbkoll` can also be run outside the `Garie` environment and run as standalone.

If your interested in an out the box solution that supports multiple performance tools like `lighthouse`, `google-speed-insight` and `web-page-test` then checkout [Garie](https://github.com/boyney123/garie).

If you want to run `garie-webbkoll` standalone you can find out how below.

## Score for webbkoll

The score of a website is calculated using the following formula:

| Field | Value | Score|
|-------|--------|-----|
|HTTPS by default|Yes|16|
||Yes, but has issues|8|
||No; insecure|0|
|Content Security Policy|Good policy|16|
||Implemented, but has problems|8|
||Invalid header|0|
||Not implemented|0|
|Referrer Policy|Referrers not leaked|16|
||Referrers partially leaked|8|
||Referrers leaked|0|
||Unknown|0|
|Third-party requests|0|16|
||>0|0|
|Server location| if country in *countries_cat1* list from config|20|
|| if country in *countries_cat2* list from config|16|
|| if country is not in any list|0|
|Cookies| if all *first-party* cookies are marked as green and no *third-party* cookies are used|16|
|| if all *first-party* cookies are marked as green and there are *third-party* cookies|8|
|| if there are *first-party* cookies marked as red and no *third-party* cookies are used|8|
|| if there are *first-party* cookies marked as red and there are *third-party* cookies|0|

The points from each field are summed and that's the final score (value), except 2 special cases. If **HTTPS by default** or  **Server location** got 0 points, the final score is **0**.

The points for each field are always written in influxdb, even if the final score is **0**.

The fields written in influxdb are:

- value (final score)
- https
- content_security_policy
- referrer_policy
- cookies
- third_party_requests
- server_location

## Getting Started

### Prerequisites

-   Docker installed

### Running garie-webbkoll

You can get setup with the basics in a few minutes.

First clone the repo.

```sh
git clone https://github.com/eea/garie-webbkoll.git
```

Next setup you're config. Edit the `config.json` and add websites to the list.

```javascript
{
  "plugins":{
        "webbkoll":{
            "cron": "0 */4 * * *"
        }
    },
  "urls": [
    {
      "url": "https://www.eea.europa.eu/"
    },
    {
      "url": "https://biodiversity.europa.eu/"
    }
  ]
}
```

Once you finished edited your config, lets setup our environment.

```sh
docker-compose up
```

This will run the application, and also will set up a local webbkoll backend and frontend, so we don't have to interogate https://webbkoll.dataskydd.net/, but we can use our local service.

On start garie-webbkoll will start to gather statistics for the websites added to the `config.json`.


## config.json

| Property | Type                | Description                                                                          |
| -------- | ------------------- | ------------------------------------------------------------------------------------ |
| `plugins.webbkoll.cron`   | `string` (optional) | Cron timer. Supports syntax can be found [here].(https://www.npmjs.com/package/cron) |
| `plugins.webbkoll.countries_cat1`   | `list of strings` mandatory | If the servers is located in one of theese countries, it will get 20 points |
| `plugins.webbkoll.countries_cat2`   | `list of strings` mandatory | If the servers is located in one of theese countries, it will get 16 points |
| `plugins.webbkoll.retry`   | `object` (optional) | Configuration how to retry the failed tasks |
| `plugins.webbkoll.retry.after`   | `number` (optional, default 30) | Minutes before we retry to execute the tasks |
| `plugins.webbkoll.retry.times`   | `number` (optional, default 3) | How many time to retry to execute the failed tasks |
| `plugins.webbkoll.retry.timeRange`   | `number` (optional, default 360) | Period in minutes to be checked in influx, to know if a task failed |
| `plugins.webbkoll.MAX_AGE_OF_REPORT_FILES`   | `number` (optional, default 365) | Maximum age (in days) of report files that can be deleted. |
| `plugins.webbkoll.MAX_AGE_OF_REPORT_VIDEOS`   | `number` (optional, default 100) | Maximum age (in days) of report videos that can be deleted. |
| `urls`   | `object` (required) | Config for webbkoll. More detail below |

**urls object**

| Property                                | Type                 | Description                                               |
| --------------------------------------- | -------------------- | --------------------------------------------------------- |
| `url`                                   | `string` (required)  | Url to get webbkoll statistics for.                       |

## Note
Currently the webbkoll garie plugin is not storing any data in InfluxDB.

## Important
Always upgrade both webbkoll and webbkoll-backend, because there might be backward compatibility issues between them.
For webbkoll-backend look for changes in https://github.com/andersju/webbkoll-backend and compare with our fork at https://github.com/eea/webbkoll-backend

For more information please go to the [garie-plugin](https://github.com/eea/garie-plugin) repo.

