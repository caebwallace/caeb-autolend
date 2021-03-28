CAEB AUTOLEND BOT
=================

Introduction
------------

After a tweet from @Eichelmining (https://twitter.com/Eichelmining/status/1364653203619520514), and developing a bot to make automatic lending on FTX is really a great idea.
So I took my favorite IDE to code that.

**Notice that this bot is only made for FTX.**

How to use
----------

With nodeJS :

 - You need NodeJS (a decent version > 10.0).
 - You copy the file `/config/index.example.json` to `/config/index.json` and configure your accounts.
 - You customize your FTX API keys and other confi params in `/config/index.json`
 - Install dependencies with `npm install`
 - Start it with `npm start`

 With Docker :

 - Install Docker (or Docker Desktop, anything that can run a docker image).
 - To to 'Running with Docker' to build and run the image.


Configuration `/config/index.json`
-------------

**FTX Account**

`apiKey` and `apiSecret` are required.
Optionallu, you can specify a subaccount nicke name with `subaccountId`.

```
"account": {
    "apiKey": "PROVIDE YOUR FTX API KEY",
    "apiSecret": "PROVIDE YOUR FTX API SECRET",
    "subaccountId": null
}
```

**All Assets Config**

That section is to configure all assets in one.

```
"general": {
    "investRatio": 100,                 // In %, the ratio of your asset amount to lend (100 USDT with a investRatio at 50, will lend and lock 50 USDT for one hour)
    "apyMin": 0,                        // The min APY to accept (default: 0)
    "discount": 1,                      // In %, the discount to apply compared to the market (if the market APY is 10%, we will offer 9.9% to be sure to lend asset)
    "allowCoinConversion": true,        // Allow to convert coin into another, based on a user defined list that choose the best yield
    "fiatAssets": ["USD", "USDT"]       // Define assets that are considered as FIAT
}
```

**Individual asset config**

That section is to configure each asset individually.

PLEASE BE VERY CAREFULL WITH AUTO CONVERT FEATURE : you can have fees and if you're in a bear market, the user will borrow your asset to short it.
=> So you'll earn a little amount of asset, but the price will go down, so your balance will be negative.

**I RECOMMEND TO DISABLE THAT FEATURE AND USE IT AT YOUR OWN RISKS**

```
"assets": {
    "USD": {
        "discount": 1,                    // The discount to apply for that asset
        "investRatio": 100,               // The total amount of your asset to lend
        "convert": ["USDT"]               // Allow to convert USD to USDT if USDT perf is better (doesn't convert otherway, you've to configure USDT -> USD)
    }
}
```

Running with Docker
-------------------

Build the image :

```
docker build -t caeb/caeb-autolend .
```

Run the image :

```
docker run caeb/caeb-autolend
```

TODO
----

- Add lending history.
- Plug a private telegram bot to output actions.

Copyright (c) 2021, Caeb WALLACE
--------------------------------

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
