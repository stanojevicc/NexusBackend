const XMLBuilder = require("xmlbuilder");
const uuid = require("uuid");
const bcrypt = require("bcrypt");
const fs = require('fs'); // Assurez-vous d'utiliser la version promesse de fs
const fs1 = require('fs').promises; // Assurez-vous d'utiliser la version promesse de fs
const crypto = require("crypto");
const path = require("path");
const jwt = require("jsonwebtoken");
const cache = require('memory-cache');
const { format } = require('date-fns');
const { zonedTimeToUtc, utcToZonedTime } = require('date-fns-tz');

const User = require("../model/user.js");
const Profile = require("../model/profiles.js");
const profileManager = require("../structs/profile.js");
const Friends = require("../model/friends.js");
const { cacheit, generateRandomCode, verifyTokenAPI, bValidUsername, sendEmail, getExpirationTime, dateToUnixTime } = require("../model/Utils.js");

const BLOCKED_WORDS = [
    "faggot",
    "hitler",
    "HITLER",
    "nigga",
    "nigger",
    "pd",
    "filsdepute",
    "penis",
    "bite",
    "badwordtest"
];

async function sleep(ms) {
    await new Promise((resolve, reject) => {
        setTimeout(resolve, ms);
    })
}

function GetVersionInfo(req) {
    let memory = {
        season: 0,
        build: 0.0,
        build2: "",
        CL: "0",
        lobby: "",
        Plateform: ""
    }

    if (req.headers["user-agent"]) {
        let CL = "";

        const test = req.headers["user-agent"];
        if (test) {
            memory.Plateform = test;
        }


        try {
            let BuildID = req.headers["user-agent"].split("-")[3].split(",")[0];

            if (!Number.isNaN(Number(BuildID))) CL = BuildID;
            else {
                BuildID = req.headers["user-agent"].split("-")[3].split(" ")[0];

                if (!Number.isNaN(Number(BuildID))) CL = BuildID;
            }
        } catch {
            try {
                let BuildID = req.headers["user-agent"].split("-")[1].split("+")[0];

                if (!Number.isNaN(Number(BuildID))) CL = BuildID;
            } catch { }
        }

        try {
            let Build = req.headers["user-agent"].split("Release-")[1].split("-")[0];

            if (Build.split(".").length == 3) {
                let Value = Build.split(".");
                Build = Value[0] + "." + Value[1] + Value[2];
            }

            memory.build2 = Build;
            memory.season = Number(Build.split(".")[0]);
            memory.build = Number(Build);
            memory.CL = CL;
            memory.lobby = `LobbySeason${memory.season}`;

            if (Number.isNaN(memory.season)) throw new Error();
        } catch {
            if (Number(memory.CL) < 3724489) {
                memory.season = 0;
                memory.build = 0.0;
                memory.CL = CL;
                memory.lobby = "LobbySeason0";
            } else if (Number(memory.CL) <= 3790078) {
                memory.season = 1;
                memory.build = 1.0;
                memory.CL = CL;
                memory.lobby = "LobbySeason1";
            } else {
                memory.season = 2;
                memory.build = 2.0;
                memory.CL = CL;
                memory.lobby = "LobbyWinterDecor";
            }
        }
    }

    return memory;
}

function getContentPages(req) {
    const memory = GetVersionInfo(req);

    const contentpages = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "responses", "contentpages.json")).toString());

    let Language = "en";

    try {
        if (req.headers["accept-language"]) {
            if (req.headers["accept-language"].includes("-") && req.headers["accept-language"] != "es-419") {
                Language = req.headers["accept-language"].split("-")[0];
            } else {
                Language = req.headers["accept-language"];
            }
        }
    } catch { }

    const modes = ["saveTheWorldUnowned", "battleRoyale", "creative", "saveTheWorld"];
    const news = ["savetheworldnews", "battleroyalenews"];

    try {
        modes.forEach(mode => {
            contentpages.subgameselectdata[mode].message.title = contentpages.subgameselectdata[mode].message.title[Language]
            contentpages.subgameselectdata[mode].message.body = contentpages.subgameselectdata[mode].message.body[Language]
        })
    } catch { }

    try {
        if (memory.build < 5.30) {
            news.forEach(mode => {
                contentpages[mode].news.messages[0].image = "https://cdn.discordapp.com/attachments/927739901540188200/930879507496308736/discord.png";
                contentpages[mode].news.messages[1].image = "https://cdn.discordapp.com/attachments/927739901540188200/930879519882088508/lawin.png";
            });
        }
    } catch { }

    try {
        contentpages.dynamicbackgrounds.backgrounds.backgrounds[0].stage = `season${memory.season}`;
        contentpages.dynamicbackgrounds.backgrounds.backgrounds[1].stage = `season${memory.season}`;

        if (memory.season == 10) {
            contentpages.dynamicbackgrounds.backgrounds.backgrounds[0].stage = "seasonx";
            contentpages.dynamicbackgrounds.backgrounds.backgrounds[1].stage = "seasonx";
        }

        if (memory.build == 11.31 || memory.build == 11.40) {
            contentpages.dynamicbackgrounds.backgrounds.backgrounds[0].stage = "Winter19";
            contentpages.dynamicbackgrounds.backgrounds.backgrounds[1].stage = "Winter19";
        }

        if (memory.build == 19.01) {
            contentpages.dynamicbackgrounds.backgrounds.backgrounds[0].stage = "winter2021";
            contentpages.dynamicbackgrounds.backgrounds.backgrounds[0].backgroundimage = "https://cdn.discordapp.com/attachments/927739901540188200/930880158167085116/t-bp19-lobby-xmas-2048x1024-f85d2684b4af.png";
            contentpages.subgameinfo.battleroyale.image = "https://cdn.discordapp.com/attachments/927739901540188200/930880421514846268/19br-wf-subgame-select-512x1024-16d8bb0f218f.jpg";
            contentpages.specialoffervideo.bSpecialOfferEnabled = "true";
        }

        if (memory.season == 20) {
            if (memory.build == 20.40) {
                contentpages.dynamicbackgrounds.backgrounds.backgrounds[0].backgroundimage = "https://cdn2.unrealengine.com/t-bp20-40-armadillo-glowup-lobby-2048x2048-2048x2048-3b83b887cc7f.jpg"
            } else {
                contentpages.dynamicbackgrounds.backgrounds.backgrounds[0].backgroundimage = "https://cdn2.unrealengine.com/t-bp20-lobby-2048x1024-d89eb522746c.png";
            }
        }

        if (memory.season == 21) {
            contentpages.dynamicbackgrounds.backgrounds.backgrounds[0].backgroundimage = "https://cdn2.unrealengine.com/s21-lobby-background-2048x1024-2e7112b25dc3.jpg"
        }
    } catch { }

    return contentpages;
}

const getYesterdayDate = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
};

const processCatalogForToday = () => {

    // Define the Europe/Paris timezone
    const timeZone = 'Europe/Paris';
    // Get the current date and time
    const now = new Date();

    // Options for formatting the date and time in the Europe/Paris timezone
    const options = {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };

    // Create a formatter for the Europe/Paris timezone
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(now);

    // Extract the formatted date parts
    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const second = parts.find(part => part.type === 'second').value;

    // Combine parts into the desired format
    let formattedDate = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    //console.log(formattedDate);
    formattedDate = formattedDate.split('T')[0]; // Extrait la date au format YYYY-MM-DD  

    const cacheKey = `catalog_${formattedDate}`;

    // const today = new Date().toISOString().split('T')[0]; // Obtient la date d'aujourd'hui au format YYYY-MM-DD
    // const cacheKey = `catalog_${today}`;

    //   // Vérifie si le catalogue pour aujourd'hui est déjà en cache
    const cachedCatalog = cache.get(cacheKey);
    if (cachedCatalog) {
        // console.log('Le catalogue pour aujourd\'hui a déjà été mis en cache.');
        return cachedCatalog; // Retourne le catalogue en cache si disponible
    }
    else {
        const yesterdayCacheKey = cacheKey + '_' + getYesterdayDate();
        cache.del(yesterdayCacheKey);
    }

    const catalogFilePath = path.join(__dirname, '..', 'responses', 'catalog.json');
    const catalogConfigFilePath = path.join(__dirname, '..', 'Config', 'catalog_config.json');
    // Charge le catalogue et le fichier de configuration
    const catalog = JSON.parse(fs.readFileSync(catalogFilePath).toString());
    const catalogConfig = JSON.parse(fs.readFileSync(catalogConfigFilePath).toString());

    catalogConfig.shops.forEach(shop => {
        const dateKey = Object.keys(shop)[0]; // Récupère la clé de la date dans chaque magasin
        const shopDate = dateKey.split('T')[0]; // Extrait la date au format YYYY-MM-DD  
        if (shopDate === formattedDate) {
            // Si la clé de la date correspond à aujourd'hui
            const shopContent = shop[dateKey]; // Récupère le contenu du magasin pour aujourd'hui

            // Faites quelque chose avec le contenu du magasin pour aujourd'hui
            //   console.log("Contenu du magasin pour aujourd'hui :", shopContent);


            let Numbertest = 0;
            for (let value in shopContent) {
                if (!Array.isArray(shopContent[value].itemGrants)) continue;
                if (shopContent[value].itemGrants.length == 0) continue;


                Numbertest++;

                const CatalogEntry = {
                    meta: {
                        TileSize: "Normal",
                        DisplayAssetPath: "",
                        NewDisplayAssetPath: "",
                        SectionId: "",
                        priority: 0,
                    }, "devName": "", "offerId": "", "fulfillmentIds": [], "dailyLimit": -1, "weeklyLimit": -1, "monthlyLimit": -1, "categories": [shopContent[value].panel], "prices": [{ "currencyType": "MtxCurrency", "currencySubType": "", "regularPrice": 0, "finalPrice": 0, "saleExpiration": "9999-12-02T01:12:00Z", "basePrice": 0 }], "matchFilter": "", "filterWeight": 0, "appStoreId": [], "requirements": [], "offerType": "StaticPrice", "giftInfo": { "bIsEnabled": true, "forcedGiftBoxTemplateId": "", "purchaseRequirements": [], "giftRecordIds": [] }, "refundable": false, "metaInfo": [], "displayAssetPath": "", "itemGrants": [], "sortPriority": Number(Numbertest), "catalogGroupPriority": Number(Numbertest)
                };

                let i = catalog.storefronts.findIndex(p => p.name == (value.toLowerCase().startsWith("daily") ? "BRDailyStorefront" : "BRWeeklyStorefront"));
                if (i == -1) continue;

                for (let itemGrant of shopContent[value].itemGrants) {
                    // if (typeof itemGrant != "string") continue;
                    if (itemGrant.length == 0) continue;


                    let PathDisplay = itemGrant.Path;
                    if (PathDisplay != undefined && PathDisplay.length > 5) {
                        CatalogEntry.displayAssetPath = PathDisplay;
                        CatalogEntry.meta.DisplayAssetPath = PathDisplay;
                    }

                    CatalogEntry.requirements.push({ "requirementType": "DenyOnItemOwnership", "requiredId": itemGrant.Skin, "minQuantity": 1 });
                    CatalogEntry.itemGrants.push({ "templateId": itemGrant.Skin, variants: itemGrant.Variants, "quantity": 1 });
                }

                if (shopContent[value].IsNew == true) {
                    CatalogEntry.metaInfo.push({ "key": "BannerOverride", "value": "New" });
                }

                CatalogEntry.prices = [{
                    "currencyType": "MtxCurrency",
                    "currencySubType": "",
                    "regularPrice": shopContent[value].price,
                    "finalPrice": shopContent[value].price,
                    "saleExpiration": "9999-12-02T01:12:00Z",
                    "basePrice": shopContent[value].price
                }];

                if (CatalogEntry.itemGrants.length > 0) {
                    let uniqueIdentifier = crypto.createHash("sha1").update(`${JSON.stringify(shopContent[value].itemGrants)}_${shopContent[value].price}`).digest("hex");

                    CatalogEntry.devName = uniqueIdentifier;
                    CatalogEntry.offerId = uniqueIdentifier;

                    catalog.storefronts[i].catalogEntries.push(CatalogEntry);
                }
            }

            // Met à jour le cache avec le catalogue pour aujourd'hui
            cache.put(cacheKey, catalog, 86400000); // Cache pendant 24 heures (en millisecondes)
        }
    });
    return catalog; // Retourne le contenu du magasin pour aujourd'hui

};

/*
function getItemShop() {
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "responses", "catalog.json")).toString());
    const CatalogConfig0 = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "Config", "catalog_config.json").toString()));


    const today = new Date().toISOString().split('T')[0]; // Récupère la date d'aujourd'hui au format YYYY-MM-DD

    CatalogConfig0.shops.forEach(shop => {
        const dateKey = Object.keys(shop)[0]; // Récupère la clé de la date dans chaque magasin
        const shopDate = dateKey.split('T')[0]; // Extrait la date au format YYYY-MM-DD  
        if (shopDate === today) {
            // Si la clé de la date correspond à aujourd'hui
            const shopContent = shop[dateKey]; // Récupère le contenu du magasin pour aujourd'hui
            // Faites quelque chose avec le contenu du magasin pour aujourd'hui
         //   console.log("Contenu du magasin pour aujourd'hui :", shopDate);

            const CatalogConfig = shopContent;
            // try {

            let Numbertest = 0;
            for (let value in CatalogConfig) {
                if (!Array.isArray(CatalogConfig[value].itemGrants)) continue;
                if (CatalogConfig[value].itemGrants.length == 0) continue;

                
                Numbertest++;

                const CatalogEntry = { "devName": "", "offerId": "", "fulfillmentIds": [], "dailyLimit": -1, "weeklyLimit": -1, "monthlyLimit": -1, "categories": [CatalogConfig[value].panel], "prices": [{ "currencyType": "MtxCurrency", "currencySubType": "", "regularPrice": 0, "finalPrice": 0, "saleExpiration": "9999-12-02T01:12:00Z", "basePrice": 0 }], "matchFilter": "", "filterWeight": 0, "appStoreId": [], "requirements": [], "offerType": "StaticPrice", "giftInfo": { "bIsEnabled": true, "forcedGiftBoxTemplateId": "", "purchaseRequirements": [], "giftRecordIds": [] }, "refundable": false, "metaInfo": [], "displayAssetPath": "", "itemGrants": [], "sortPriority": Number(Numbertest), "catalogGroupPriority": Number(Numbertest) };

                let i = catalog.storefronts.findIndex(p => p.name == (value.toLowerCase().startsWith("daily") ? "BRDailyStorefront" : "BRWeeklyStorefront"));
                if (i == -1) continue;

                let PathDisplay = CatalogConfig[value].Path;
                if (PathDisplay != undefined && PathDisplay.length > 5) {
                    CatalogEntry.displayAssetPath = PathDisplay;
                }

                for (let itemGrant of CatalogConfig[value].itemGrants) {
                   // if (typeof itemGrant != "string") continue;
                    if (itemGrant.length == 0) continue;

                    CatalogEntry.requirements.push({ "requirementType": "DenyOnItemOwnership", "requiredId": itemGrant.Skin, "minQuantity": 1 });
                    CatalogEntry.itemGrants.push({ "templateId": itemGrant.Skin, variants: itemGrant.Variants, "quantity": 1 });
                }

                if (CatalogConfig[value].IsNew == true) {
                    CatalogEntry.metaInfo.push({ "key": "BannerOverride", "value": "New" });
                }

                CatalogEntry.prices = [{
                    "currencyType": "MtxCurrency",
                    "currencySubType": "",
                    "regularPrice": CatalogConfig[value].price,
                    "finalPrice": CatalogConfig[value].price,
                    "saleExpiration": "9999-12-02T01:12:00Z",
                    "basePrice": CatalogConfig[value].price
                }];

                if (CatalogEntry.itemGrants.length > 0) {
                    let uniqueIdentifier = crypto.createHash("sha1").update(`${JSON.stringify(CatalogConfig[value].itemGrants)}_${CatalogConfig[value].price}`).digest("hex");

                    CatalogEntry.devName = uniqueIdentifier;
                    CatalogEntry.offerId = uniqueIdentifier;

                    catalog.storefronts[i].catalogEntries.push(CatalogEntry);
                }
            }
            //  } catch { }
            return catalog;
        }
    })


    return catalog;
}
*/
function getOfferID(offerId) {
    const catalog = processCatalogForToday();

    for (let storefront of catalog.storefronts) {
        let findOfferId = storefront.catalogEntries.find(i => i.offerId == offerId);

        if (findOfferId) return {
            name: storefront.name,
            offerId: findOfferId
        };
    }
}

function MakeID() {
    return uuid.v4();
}

function sendXmppMessageToAll(body) {
    if (!global.Clients) return;
    if (typeof body == "object") body = JSON.stringify(body);

    global.Clients.forEach(ClientData => {
        ClientData.client.send(XMLBuilder.create("message")
            .attribute("from", "xmpp-admin@prod.ol.epicgames.com")
            .attribute("xmlns", "jabber:client")
            .attribute("to", ClientData.jid)
            .element("body", `${body}`).up().toString());
    });
}

function sendXmppMessageToId(body, toAccountId) {
    if (!global.Clients) return;
    if (typeof body == "object") body = JSON.stringify(body);

    let receiver = global.Clients.find(i => i.accountId == toAccountId);
    if (!receiver) return;

    receiver.client.send(XMLBuilder.create("message")
        .attribute("from", "xmpp-admin@prod.ol.epicgames.com")
        .attribute("to", receiver.jid)
        .attribute("xmlns", "jabber:client")
        .element("body", `${body}`).up().toString());
}

function sendXmppMessageToId2(body, senderisniggerid, toAccountId) {
    if (!global.Clients) return;
    if (typeof body == "object") body = JSON.stringify(body);

    let receiver = global.Clients.find(i => i.accountId == toAccountId);
    if (!receiver) return;

    let sendernigger = global.Clients.find(i => i.accountId == senderisniggerid);
    if (!sendernigger) return;

    receiver.client.send(XMLBuilder.create("message")
        .attribute("from", sendernigger.jid)
        .attribute("to", receiver.jid)
        .attribute("xmlns", "jabber:client")
        .element("body", `${body}`).up().toString());
}

function getPresenceFromUser(fromId, toId, offline) {
    if (!global.Clients) return;

    let SenderData = global.Clients.find(i => i.accountId == fromId);
    let ClientData = global.Clients.find(i => i.accountId == toId);

    if (!SenderData || !ClientData) return;

    let xml = XMLBuilder.create("presence")
        .attribute("to", ClientData.jid)
        .attribute("xmlns", "jabber:client")
        .attribute("from", SenderData.jid)
        .attribute("type", offline ? "unavailable" : "available")

    if (SenderData.lastPresenceUpdate.away) xml = xml.element("show", "away").up().element("status", SenderData.lastPresenceUpdate.status).up();
    else xml = xml.element("status", SenderData.lastPresenceUpdate.status).up();

    ClientData.client.send(xml.toString());
}

async function registerUser(discordId, username, email, plainPassword) {
    email = email.toLowerCase();

    if (!discordId || !username || !email || !plainPassword) return { message: "Username/email/password is required.", status: 400 };

    if (await User.findOne({ discordId })) return { message: "You already created an account!", status: 400 };

    const accountId = MakeID().replace(/-/ig, "");

    // filters
    const emailFilter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!emailFilter.test(email)) return { message: "You did not provide a valid email address!", status: 400 };
    if (username.length >= 25) return { message: "Your username must be less than 25 characters long.", status: 400 };
    if (username.length < 3) return { message: "Your username must be atleast 3 characters long.", status: 400 };
    if (plainPassword.length >= 128) return { message: "Your password must be less than 128 characters long.", status: 400 };
    if (plainPassword.length < 8) return { message: "Your password must be atleast 8 characters long.", status: 400 };

    const blockedword = BLOCKED_WORDS.some((word) => username.includes(word));
    if (blockedword) {
        return { message: "Your username use inappropriate words." + blockedword, status: 400 };
    }

    const allowedCharacters = (" !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~").split("");

    for (let character of username) {
        if (!allowedCharacters.includes(character)) return { message: "Your username has special characters, please remove them and try again.", status: 400 };
    }


    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    try {
        await User.create({ created: new Date().toISOString(), discordId, accountId, username, username_lower: username.toLowerCase(), email, password: hashedPassword }).then(async (i) => {
            await Profile.create({ created: i.created, accountId: i.accountId, profiles: profileManager.createProfiles(i.accountId) });
            await Friends.create({ created: i.created, accountId: i.accountId });
        });
    } catch (err) {
        if (err.code == 11000) return { message: `Username or email is already in use.`, status: 400 };

        return { message: "An unknown error has occured, please try again later.", status: 400 };
    };

    return { message: `Successfully created an account with the username ${username}`, status: 200 };
}

async function registerUserViaApi(discordId, username, email, plainPassword) {
    email = email.toLowerCase();

    if (!discordId || !username || !email || !plainPassword) return { message: "Username/email/password is required.", status: 400 };

    if (await User.findOne({ email: email }).lean()) return { message: "Email is already in use", status: 400 };

    const accountId = MakeID().replace(/-/ig, "");

    // filters
    const emailFilter = /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!emailFilter.test(email)) return { message: "You did not provide a valid email address!", status: 400 };
    if (username.length >= 15) return { message: "Your username must be less than 25 characters long.", status: 400 };
    if (username.length < 3) return { message: "Your username must be atleast 3 characters long.", status: 400 };
    if (plainPassword.length >= 128) return { message: "Your password must be less than 128 characters long.", status: 400 };
    if (plainPassword.length < 8) return { message: "Your password must be atleast 8 characters long.", status: 400 };

    const allowedCharacters = (" !\"#$%&'*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ^_`abcdefghijklmnopqrstuvwxyz").split("");

    for (let character of username) {
        if (!allowedCharacters.includes(character)) return { message: "Your username has special characters, please remove them and try again.", status: 400, blockedWord: character };
    }

    const blockedWord = BLOCKED_WORDS.find(word => username.toLowerCase().includes(word.toLowerCase()));
    if (blockedWord) {
        return { message: "Your username contains inappropriate words.", status: 400, blockedWord: blockedWord };
    }



    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const token = jwt.sign({ accountId: accountId, password: hashedPassword }, global.JWT_SECRET, { expiresIn: "60d" });


    const newxp = getExpirationTime(token);
    const realdate = dateToUnixTime(newxp);
    /*
     // Create token
     const token = jwt.sign(
      { email:  email },
      global.JWT_SECRET,
      {
        expiresIn: "72h",
      }
    );*/

    try {
        /*  var bIsPassCosmos = false;
                  var bIsPassPremium = false;*/
        await User.create({ created: new Date().toISOString(), discordId, accountId, username, username_lower: username.toLowerCase(), email, password: hashedPassword, token: token, AllData: [], email_confirm: true, email_confirm: true, bIsPassCosmos: false, bIsPassPremium: false, last_emailchange: new Date().toISOString(), last_passwordchange: new Date().toISOString(), last_usernamechange: new Date().toISOString() }).then(async (i) => {
            await Profile.create({ created: i.created, accountId: i.accountId, profiles: profileManager.createProfiles(i.accountId) });
            await Friends.create({ created: i.created, accountId: i.accountId });
        });
    } catch (err) {
        if (err.code == 11000) return { message: `Username is already in use.`, status: 400 };

        return { message: "An unknown error has occured, please try again later.", status: 400 };
    };

    const profilenigga = await User.findOne({ discordId });

    return { message: `Successfully created an account with the username ${username}`, status: 200, token: token, exp: realdate };
}


function DecodeBase64(str) {
    return Buffer.from(str, 'base64').toString();
}

async function UpdateTokens() {
    
    return;
    try {
        await fs1.writeFile("./tokenManager/tokens.json", JSON.stringify({
            accessTokens: global.accessTokens,
            refreshTokens: global.refreshTokens,
            clientTokens: global.clientTokens
        }, null, 2));
    } catch (error) {
        console.error("Error writing tokens to file:", error);
    }
}

async function UpdateTokensr() {
    try {
        const tokensData = {
            accessTokens: global.accessTokens,
            refreshTokens: global.refreshTokens,
            clientTokens: global.clientTokens
        };

        // Validation JSON avant écriture
        const jsonString = JSON.stringify(tokensData, null, 2);
        
        // Écriture du fichier
        await fs1.writeFile("./tokenManager/tokens.json", jsonString);

       // console.log("Tokens updated successfully.");
    } catch (error) {
        console.error("Error writing tokens to file:", error);
    }
}

function startTokenUpdater(intervalMs = 60000) {
    let errorCount = 0;
    const maxErrors = 5; // Nombre maximum d'erreurs avant d'arrêter

    const intervalId = setInterval(async () => {
        try {
            await UpdateTokensr();
            errorCount = 0; // Réinitialiser le compteur d'erreurs en cas de succès
        } catch (error) {
            errorCount++;
            console.error(`Failed to update tokens (${errorCount}/${maxErrors}):`, error);
            if (errorCount >= maxErrors) {
                console.error("Too many errors, stopping token updater.");
                clearInterval(intervalId); // Arrête l'intervalle si trop d'erreurs
            }
        }
    }, intervalMs);

    return intervalId; // Pour pouvoir éventuellement arrêter l'intervalle plus tard
}

// Démarrer l'intervalle d'update toutes les 60 secondes
startTokenUpdater();

module.exports = {
    sleep,
    GetVersionInfo,
    getContentPages,
    processCatalogForToday,
    getOfferID,
    MakeID,
    sendXmppMessageToAll,
    sendXmppMessageToId,
    sendXmppMessageToId2,
    getPresenceFromUser,
    registerUser,
    registerUserViaApi,
    DecodeBase64,
    UpdateTokens
}