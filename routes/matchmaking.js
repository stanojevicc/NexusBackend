const express = require("express");
const app = express.Router();
const functions = require("../structs/functions.js");
const Profile = require("../model/profiles.js");
const error = require("../structs/error.js");
const axios = require('axios');

const { verifyToken, verifyClient } = require("../tokenManager/tokenVerify.js");

let buildUniqueId = {};
let PlayListName = {};

async function FindTicket(a) {
    try {
        return await axios.get("http://127.0.0.1:3000/Cosmos/FindTicket?ticketid=" + a);
    }
    catch {
        return "";
    }
}

app.get("/fortnite/api/matchmaking/session/findPlayer/*", (req, res) => {
    res.status(200).end();
});

app.get("/fortnite/api/game/v2/matchmakingservice/ticket/player/*", verifyToken, async (req, res) => {
    if (typeof req.query.bucketId != "string") return res.status(400).end();
    if (req.query.bucketId.split(":").length != 4) return res.status(400).end();

    try {
        const AccountID = req.user.accountId;

        //  console.log(req.url);
        // console.log(AccountID);


        let bFillOption = false;
        const FillTeamQuery = req.query["player.option.fillTeam"];
        if (FillTeamQuery) {
            bFillOption = true;
        }
        // console.log(bFillOption);

        const playlist = req.query.bucketId.split(":")[3];
        if (!playlist) return res.status(500).json({});

        const user = await Profile.findOne({ accountId: AccountID });
        if (!user) return res.status(500).json({});

        const common_core = user.profiles["common_core"];
        if (common_core) {
            let attributes = common_core.stats.attributes;
            if (attributes) {

                if (attributes.Last_bFillOption != bFillOption) {
                    attributes.Last_bFillOption = bFillOption;
                    await user.updateOne({ $set: { "profiles.common_core.stats.attributes": attributes } });
                }

                const ban_status = attributes.ban_status;
                if (ban_status && ban_status.bRequiresUserAck == true) {
                    return res.status(500).json({});
                }
            }
        }

        buildUniqueId[AccountID] = req.query.bucketId.split(":")[0];
        PlayListName[AccountID] = playlist;

        const Region = req.query.bucketId.split(":")[2];
        const fullurl = "wss://dev.epstatic.online:443/" + playlist + ":" + AccountID + ":" + Region;
        //  console.log("fullurl :" + fullurl);
        return res.json({
            "serviceUrl": fullurl,
            //  "serviceUrl": `ws://${config.matchmakerIP}`,
            "ticketType": "mms-player",
            "payload": "69=",
            "signature": "420="
        });
    }
    catch (e) {
        console.log(e);
    }
    return res.status(500).json({});
});

app.get("/fortnite/api/game/v2/matchmaking/account/:accountId/session/:sessionId", (req, res) => {
    res.json({
        "accountId": req.params.accountId,
        "sessionId": req.params.sessionId,
        "key": "none"
    });
});

app.get("/fortnite/api/matchmaking/session/:sessionId", verifyToken, async (req, res) => {

    // console.log("passed 0");

    let Playlist = PlayListName[req.user.accountId];
    if (Playlist == undefined || Playlist == null) return res.status(500).json({});

    let ServerIP = "127.0.0.1";
    let PortServer = Number(7777);
    // console.log("passed 1");

    for (var i = 0; i < 5; i++) {
        const buf0 = await FindTicket(req.user.accountId);
        if (buf0 != "" && buf0.status == 200) {

            const Data = buf0.data;
            if (Data) {
                if (Data.ServerStatus != null && Data.ServerStatus != undefined) {
                    //  if (Data.ServerStatus == "Open") {
                    if (Data.IP != "") {

                        ServerIP = Data.IP;
                        PortServer = Data.Port;


                        break;
                    }
                    // }
                }
            }
        }
        else {
            return res.status(404).json({});
        }
    }

    if (ServerIP == "127.0.0.1") {
        return res.status(404).json({});
    }


    //  console.log("passed 2");

    return res.status(200).json({
        "id": req.params.sessionId,
        "ownerId": functions.MakeID().replace(/-/ig, "").toUpperCase(),
        "ownerName": "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
        "serverName": "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
        "serverAddress": ServerIP,
        "serverPort": PortServer,
        "maxPublicPlayers": 220,
        "openPublicPlayers": 175,
        "maxPrivatePlayers": 0,
        "openPrivatePlayers": 0,
        "attributes": {
            "REGION_s": "EU",
            "GAMEMODE_s": "FORTATHENA",
            "ALLOWBROADCASTING_b": true,
            "SUBREGION_s": "GB",
            "DCID_s": "FORTNITE-LIVEEUGCEC1C2E30UBRCORE0A-14840880",
            "tenant_s": "Fortnite",
            "MATCHMAKINGPOOL_s": "Any",
            "STORMSHIELDDEFENSETYPE_i": 0,
            "HOTFIXVERSION_i": 0,
            "PLAYLISTNAME_s": Playlist,
            "SESSIONKEY_s": functions.MakeID().replace(/-/ig, "").toUpperCase(),
            "TENANT_s": "Fortnite",
            "BEACONPORT_i": 15009
        },
        "publicPlayers": [],
        "privatePlayers": [],
        "totalPlayers": 45,
        "allowJoinInProgress": false,
        "shouldAdvertise": false,
        "isDedicated": false,
        "usesStats": false,
        "allowInvites": false,
        "usesPresence": false,
        "allowJoinViaPresence": true,
        "allowJoinViaPresenceFriendsOnly": false,
        "buildUniqueId": buildUniqueId[req.user.accountId] || "0",
        "lastUpdated": new Date().toISOString(),
        "started": false
    });
});

app.post("/fortnite/api/matchmaking/session/*/join", (req, res) => {
    res.status(204).end();
});

app.post("/fortnite/api/matchmaking/session/matchMakingRequest", (req, res) => {
    res.json([]);
});

module.exports = app;