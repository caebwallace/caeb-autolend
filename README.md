CAEB AUTOLEND BOT
=================

Introduction
------------

After a tweet from @Eichelmining (https://twitter.com/Eichelmining/status/1364653203619520514), and developing a bot to make automatic lending on FTX is really a great idea.
So I took my favorite IDE to code that.

**Notice that this bot is only made for FTX.**

How to use
----------

 - You need Nod1JS (a decent version > 10.0).
 - You copy the file `.env.defaults` to `.env` and configure your accounts.
 - You customize your FTX API keys in `.env`
 - Install dependencies with `npm install`
 - Start it with `npm start`

Configuration
-------------

The default configuration is set to not working without changing config.
FTX API are of course concerned, but below you've the configuration to apply for invest ratio (INVEST_RATIO) and APY minimum (APY_MIN).

- INVEST_RATIO : `1` means that 100% (0.1 -> 10%...) of the lending elligibles tokens will be lend.
- APY_MIN : the lowest APY you accept in %.

```
# Your FTX API Key
FTX_API_KEY=XXXX

# Your FTX API Secret
FTX_API_SECRET=XXXX

# INTERVAL BETWEEN EACH CHECK (in minutes)
INTERVAL_CHECK_MIN=1

# The amount to invest of available coins at each call (set as 1 to transfer all spot to lending)
INVEST_RATIO=1

# The minimum of APY% asked
APY_MIN=5

# Ignore those assets from auto lending (seperated with a comma)
IGNORE_ASSETS=FAKE,COIN
```
