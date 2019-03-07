# Garie webbkoll plugin

<p align="center">
  <p align="center">Tool to gather webbkoll reports and supports CRON jobs.<p>
</p>

**Highlights**

-   Poll for [webbkoll](https://github.com/andersju/webbkoll) reports on any website
-   View all historic webbkoll reports.
-   Setup within minutes

## Overview of garie-webbkoll

Garie-webbkoll was developed as a plugin for the [Garie](https://github.com/boyney123/garie) Architecture.

[Garie](https://github.com/boyney123/garie) is an out the box web performance toolkit, and `garie-webbkoll` is a plugin that generates and stores [webbkoll](https://github.com/andersju/webbkoll) reports in HTML and JSON format.

`Garie-webbkoll` can also be run outside the `Garie` environment and run as standalone.

If your interested in an out the box solution that supports multiple performance tools like `lighthouse`, `google-speed-insight` and `web-page-test` then checkout [Garie](https://github.com/boyney123/garie).

If you want to run `garie-webbkoll` standalone you can find out how below.

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
| `cron`   | `string` (optional) | Cron timer. Supports syntax can be found [here].(https://www.npmjs.com/package/cron) |
| `urls`   | `object` (required) | Config for webbkoll. More detail below                                               |

**urls object**

| Property                                | Type                 | Description                                               |
| --------------------------------------- | -------------------- | --------------------------------------------------------- |
| `url`                                   | `string` (required)  | Url to get webbkoll statistics for.                       |

## Note
Currently the webbkoll garie plugin is not storing any data in InfluxDB.
