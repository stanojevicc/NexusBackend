const express = require("express");
const app = express.Router();
const moment = require('moment-timezone');
const fs = require("fs");
const path = require("path");

const { verifyToken, verifyClient } = require("../tokenManager/tokenVerify.js");
const functions = require("../structs/functions.js");
const { cacheit, generateRandomCode, verifyTokenAPI, bValidUsername, sendEmail, getExpirationTime, dateToUnixTime, dateToTimestamp, cacheGet, cacheDel, cacheSet } = require("../model/Utils.js");


function getNextDayMidnight() {
    let now = new Date();
    let tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(0, 1, 0, 0); // Réglez l'heure sur 00:01:00:00

    // Vérifier si la date est passée, si oui, passer au lendemain
    if (tomorrow <= now) {
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 1, 0, 0); // Réglez à nouveau l'heure sur 00:01:00:00
    }

    return tomorrow;
}
function getNextThreeDayMidnight() {
    let now = new Date();
    let nextDate = new Date(now);

    // Ajouter trois jours à la date actuelle
    nextDate.setDate(now.getDate() + 3);

    // Définir l'heure sur 00:01:00:00
    nextDate.setHours(0, 1, 0, 0);

    // Si la date est déjà passée, passer au prochain cycle de trois jours
    while (nextDate <= now) {
        nextDate.setDate(nextDate.getDate() + 3);
    }

    return nextDate;
}


// Test de la fonction
app.get("/fortnite/api/calendar/v1/timeline", async (req, res) => {
    let Season = Number(12);
    let DefaultLobby = "LobbySeason" + Season;
    try {
        const memory = functions.GetVersionInfo(req);
        if (memory) {
            Season = Number(memory.season);
            DefaultLobby = memory.lobby;
        }
    }
    catch {

    }

    //console.log(Season);
    // console.log(DefaultLobby);

    const currentDate = new Date();


    const key_cache = "CacheTimeLineJSON-";
    let CacheFNTimelineJSON = cacheGet(key_cache);
    if (CacheFNTimelineJSON) {
        CacheFNTimelineJSON = CacheFNTimelineJSON.body;
    }
    else {
        const CacheFNTimeline = path.join(__dirname, "..", "userslogs", "WebServer", "Store", "Fortnite_StoreDate.json");
        CacheFNTimelineJSON = JSON.parse(await fs.readFileSync(CacheFNTimeline, "utf-8"));

        cacheSet(key_cache, { status: 200, body: CacheFNTimelineJSON }, 180);
    }
    //  const CacheFNTimeline = path.join(__dirname, "..", "userslogs", "WebServer", "Store", "Fortnite_StoreDate.json");
    //  const CacheFNTimelineJSON = JSON.parse(await fs.readFileSync(CacheFNTimeline, "utf-8"));


    let DailyStoreEndDate = new Date(CacheFNTimelineJSON.DailyStoreEndDate);
    let WeeklyStoreEndDate = new Date(CacheFNTimelineJSON.WeeklyStoreEndDate);
    const BattlePassEndDate = new Date(CacheFNTimelineJSON.BattlePassEndDate);

    const key = "TimelineCache-" + Season;
    const CachedResponse = cacheGet(key);
    if (CachedResponse) {
        if (CachedResponse.channels["client-events"]["cacheExpire"] && currentDate >= new Date(CachedResponse.channels["client-events"]["cacheExpire"]) || CachedResponse.channels["client-events"]["cacheExpire"] && currentDate >= new Date(DailyStoreEndDate)) {
            //   console.log("deleting cache bc expired");
            cacheDel(key);
        }
        else {
            //   console.log("found cached response");
            return res.json(CachedResponse);
        }
    }

    const jour = currentDate.getDate();
    const mois = currentDate.getMonth() + 1;
    const annee = currentDate.getFullYear();


    const DaysAddFeatured = Number(CacheFNTimelineJSON.DaysAdd);
    const HourSet = Number(CacheFNTimelineJSON.HoursAdd);
    const MinsSet = Number(CacheFNTimelineJSON.MinsAdd);

    let bModified = false;

    if (DailyStoreEndDate && isNaN(DailyStoreEndDate) || DailyStoreEndDate && currentDate >= DailyStoreEndDate) {
        console.log("expired date DailyStoreEndDate: " + DailyStoreEndDate + ":currentDate: " + currentDate);
        // Obtenir l'heure actuelle à Paris
        const tomorrowMidnightParis = moment.tz('Europe/Paris').add(1, 'day').startOf('day');
        const tomorrowMidnightUTC = tomorrowMidnightParis.utc();

        const DateConverted = new Date(tomorrowMidnightUTC);
        DailyStoreEndDate = DateConverted;
console.log(DailyStoreEndDate);
        CacheFNTimelineJSON.DailyStoreEndDate = DailyStoreEndDate;
        bModified = true;
    }
    if (WeeklyStoreEndDate && isNaN(WeeklyStoreEndDate) || WeeklyStoreEndDate && currentDate >= WeeklyStoreEndDate) {
        console.log("expired date WeeklyStoreEndDate");
        const tomorrowMidnightParis = moment.tz('Europe/Paris').add(3, 'day').startOf('day');
        const tomorrowMidnightUTC = tomorrowMidnightParis.utc();

        const DateConverted = new Date(tomorrowMidnightUTC);
        WeeklyStoreEndDate = DateConverted;

        CacheFNTimelineJSON.WeeklyStoreEndDate = WeeklyStoreEndDate;
        bModified = true;
    }

    if (bModified) {
        const CacheFNTimeline = path.join(__dirname, "..", "userslogs", "WebServer", "Store", "Fortnite_StoreDate.json");
       // const CacheFNTimelineJSON1 = JSON.parse(await fs.readFileSync(CacheFNTimeline, "utf-8"));
        await fs.writeFileSync(CacheFNTimeline, JSON.stringify(CacheFNTimelineJSON, null, 2));
        await cacheDel(key_cache);
      //  CacheFNTimelineJSON = CacheFNTimelineJSON1;
         //cacheSet(key_cache, { status: 200, body: CacheFNTimelineJSON }, 180);
    }

    let activeEvents = [
        {
            "eventType": `EventFlag.Season${Season}`,
            "activeUntil": "2028-01-01T00:00:00.000Z",
            "activeSince": "2020-01-01T00:00:00.000Z"
        },
        {
            "eventType": `EventFlag.${DefaultLobby}`,
            "activeUntil": "2028-01-01T00:00:00.000Z",
            "activeSince": "2020-01-01T00:00:00.000Z"
        },
        {
            "eventType": "EventFlag.HalloweenBattleBus",
            "activeUntil": "9999-01-01T00:00:00.000Z",
            "activeSince": "2020-01-01T00:00:00.000Z"
        }
    ];

    let CacheExpireDate = new Date();
    CacheExpireDate.setMinutes(CacheExpireDate.getMinutes() + 10);

    const Data = {
        channels: {
            "client-matchmaking": {
                states: [
                    {
                        validForm: new Date().toISOString(),
                        activeEvents: [],
                        state: {

                        }
                    },
                ],
                cacheExpire: DailyStoreEndDate,
            },
            "client-events": {
                states: [{
                    validFrom: "2018-01-01T00:00:00.000Z",
                    activeEvents: activeEvents,
                    state: {
                        activeStorefronts: [],
                        eventNamedWeights: {},
                        seasonNumber: Season,
                        seasonTemplateId: `AthenaSeason:athenaseason${Season}`,
                        matchXpBonusPoints: 0,
                        seasonBegin: "2020-01-01T00:00:00Z",
                        seasonEnd: BattlePassEndDate,
                        seasonDisplayedEnd: BattlePassEndDate,
                        weeklyStoreEnd: WeeklyStoreEndDate,
                        stwEventStoreEnd: "2039-01-01T00:00:00.000Z",
                        stwWeeklyStoreEnd: "2039-01-01T00:00:00.000Z",
                        dailyStoreEnd: DailyStoreEndDate
                    }
                }],
                cacheExpire: CacheExpireDate
            }
        },
        eventsTimeOffsetHrs: 0,
        cacheIntervalMins: 10,
        currentTime: currentDate
    };

    res.status(200).json(Data);
    // 7200 = 2 hours if we make some changes so it update
    return cacheSet(key, Data, 7200);
});

module.exports = app;