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
 - You copy the file `.env.defaults` to `.env` and configure your accounts.
 - You customize your FTX API keys in `.env`
 - Install dependencies with `npm install`
 - Start it with `npm start`

 With Docker :

 - Install Docker (or Docker Desktop, anything that can run a docker image).
 - To to 'Running with Docker' to build and run the image.


Configuration
-------------

**The default configuration is set to not working without changing config.**

FTX API keys are of course concerned, but below you've the configuration to apply for invest ratio (INVEST_RATIO) and APY minimum (APY_MIN).

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

# Set the APY% manually (disable APY_MIN)
APY_MANUAL_FIXED=

# The reduction % compared to the estimated one (to be sure to be choosed)
APY_OFFER_DISCOUNT=0

# Ignore those assets from auto lending (seperated with a comma)
IGNORE_ASSETS=FAKE,COIN
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
