const WebSocket = require("ws").Server;
const XMLBuilder = require("xmlbuilder");
const XMLParser = require("xml-parser");
const express = require("express");
const app = express();
var https = require('https');
const fs = require("fs");
const fs1 = require('fs').promises; // Assurez-vous d'utiliser la version promesse de fs

const Profile = require("../model/profiles.js");
const User = require("../model/user.js");
const WebSocketo = require('ws');
const path = require("path");
const Analystic = require("../model/Analystics");

const log = require("../structs/log.js");
const functions = require("../structs/functions.js");
const Friends = require("../model/friends.js");

const port = 443;

const { calculerDifference, cacheit, generateRandomCode, verifyTokenAPI, cacheDel, cacheSet, cacheGet } = require("../model/Utils.js");



//let global.ACHeartElem = {};

global.ACHeartElem = {};


/*
var options = {
    key: fs.readFileSync('./localhost.decrypted.key'),
    cert: fs.readFileSync('./localhost.crt')
  };
const wss = new WebSocket({ server: https.createServer(options, function(req,res)
    {
        app.handle( req, res );
    }).listen(port) });
*/
//

const options = {
    key: fs.readFileSync('./key.key'),
    cert: fs.readFileSync('./cert.cert'),
    requestCert: false, // Désactive la vérification client
    rejectUnauthorized: false // Accepter les connexions SSL invalides
};

//  const server = https.createServer(options);
const wss = new WebSocket({
    server:
        https.createServer(options, app).listen(port)
});

app.listen(80, () => {
    console.log('Serveur non sécurisé WS écoute sur le port 80');
});


//const wss = new WebSocket({ server: }})
//const wss = new WebSocket({ server: app.listen(port) });

const matchmaker = require("../matchmaker/matchmaker.js");

global.xmppDomain = "prod.ol.epicgames.com";

global.Clients = [];

// multi user chat rooms (global chat/party chat)
global.MUCs = {};


app.get("/GetAcHeartBeat/:accountid", async (req, res) => {

    const AccountId = req.params.accountid;
    if (!AccountId) return res.status(500).json({ error: "bad" });


    let bInvalidated = true;

    if (global.Clients.length > 0) {
        // const ClientAccount = global.ACHeartElem[AccountId];
        let ClientAccount = global.ACHeartElem[AccountId];
        if (!ClientAccount) {
            ClientAccount = { accountid: AccountId, LastClientHeartbeat: new Date(), bInvalidated: false };
            global.ACHeartElem[AccountId] = ClientAccount;
        }
        //  console.log(ClientAccount);
        if (ClientAccount) {
            const LastHearbeatDate = new Date(ClientAccount.LastClientHeartbeat);
            // if (LastHearbeatDate < DateNow) {
            if (ClientAccount.bInvalidated != undefined)
                bInvalidated = ClientAccount.bInvalidated;

            if (ClientAccount.bBanned != undefined) {
                ClientAccount.bInvalidated = true;
                bInvalidated = true;
            }

            const timeSinceLastHeartbeat = Date.now() - LastHearbeatDate;
            if (timeSinceLastHeartbeat >= 100 * 1000) { // 100 secondes en millisecondes
                ClientAccount.bInvalidated = true;
                ClientAccount.KeyHeart = null;
                bInvalidated = true;
            }
        }
    }


    return res.status(200).json({ bInvalidated: bInvalidated });



})

app.get("/GetParty/:accountid/:playlist", cacheit(30), async (req, res) => {

    const AccountId = req.params.accountid;
    const playlist = req.params.playlist;
    if (!AccountId || !playlist) return res.status(500).json({ error: "bad" });

    // console.time('User Time');
    // console.time('Total Time');
    /*
        let [user, profile] = await Promise.all([
            User.findOne({ accountId: AccountId }).lean(),
            Profile.findOne({ accountId: AccountId }).lean()
          ]);*/

    let [user, profile] = await Promise.all([
        User.findOne({ accountId: AccountId }).lean(),
        Profile.findOne({ accountId: AccountId })
            .lean()
            .select('profiles.athena.stats profiles.common_core.stats') // Sélectionnez les champs souhaités
    ]);
    // console.log(profile);


    //   let user = await User.findOne({ accountId: AccountId }).lean();
    if (!user) return res.status(500).json({ error: "bad account not found" });

    //let profile = await Profile.findOne({ accountId: AccountId }).lean();
    if (!profile) return res.status(500).json({ error: "bad account not found" });
    //   console.timeEnd('User Time');


    let bFill = true;
    const DateNow = new Date();
    let DaysToWait = "";
    let bCanPlay = true;
    let bPaid = false;
    const Level = Number(profile.profiles.athena.stats.attributes.level);
    let superChargedXP = Number(profile.profiles.athena.stats.attributes.superChargedXP);
    if (!superChargedXP || superChargedXP == undefined) {
        superChargedXP = 0;
    }


    if (profile.profiles["common_core"].stats.attributes.Last_bFillOption !== undefined)
        bFill = profile.profiles["common_core"].stats.attributes.Last_bFillOption;

    let bAddNewSuperCharged = true;
    const ResetDatesuperChargedXP = new Date(profile.profiles.athena.stats.attributes.ResetDatesuperChargedXP);
    // console.log(ResetDatesuperChargedXP);
    if (ResetDatesuperChargedXP != undefined && !isNaN(ResetDatesuperChargedXP)) {
        if (DateNow > ResetDatesuperChargedXP) {
            // console.log("la date de maintenant et plus que resetdate")
            //bAddNewSuperCharged = false;
            //console.log("DateToCheck= " + ResetDatesuperChargedXP + ":CurrentDate= " + DateNow);
        }
        else {
            bAddNewSuperCharged = false;
            // console.log("DateToCheck2= " + ResetDatesuperChargedXP + ":CurrentDate= " + DateNow);
        }
    }


    const key = "RestrictionGameModeCache-" + "GetParty";
    let RestrictionGameInfo = cacheGet(key);
    if (RestrictionGameInfo) {
        RestrictionGameInfo = RestrictionGameInfo.body;
        // console.log("cached found ok");

    }
    else {/*
        const ResInfoPath = path.join(
            __dirname,
            "..", "userslogs", "RestrictionGameMode.json"
        );*/

        RestrictionGameInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "userslogs", "RestrictionGameMode.json"), "utf-8"));

        cacheSet(key, { status: 200, body: RestrictionGameInfo }, 300);
    }

    // console.timeEnd('Total Time');

    //return res.status(200).json({});


    let bBoostAddication = false;
    let bUpdateFile = false;
    let updateFields = {};

    let bFoundHwidInfo = false;
    if (user.HwidInformations)
        bFoundHwidInfo = true;



    // CACHING ACCOUNT IPS TO AVOID SENDING USELESS REQUEST
    //  const RestrictionGameInfo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "userslogs", "RestrictionGameMode.json"), "utf-8"));

    //console.log("bAddNewSuperCharged: " + bAddNewSuperCharged);
    if (bAddNewSuperCharged) {
        if (RestrictionGameInfo) {
            const BoostAdictionInfo = RestrictionGameInfo.BoostAdiction;
            if (BoostAdictionInfo) {
                const BoostResetHourUTC = BoostAdictionInfo.ResetHourUTC;
                const XPResetGive = BoostAdictionInfo.XPResetGive;

                let ResetXPHourUTC = new Date();
                ResetXPHourUTC.setUTCHours(BoostResetHourUTC, 0, 0, 0);

                // console.log("ResetXPHourUTC: " + ResetXPHourUTC);

                const XPsuperChargedToGive = XPResetGive - superChargedXP;
                if (XPsuperChargedToGive > 0) {
                    superChargedXP = XPsuperChargedToGive;
                    //  console.log("ResetXPHourUTC:" + ResetXPHourUTC + ":superChargedXP:" + XPsuperChargedToGive);
                    updateFields["profiles.athena.stats.attributes.ResetDatesuperChargedXP"] = ResetXPHourUTC;
                    updateFields["profiles.athena.stats.attributes.superChargedXP"] = XPsuperChargedToGive;

                    // Mettre à jour le profil dans la base de données
                    /*  Profile.updateOne(
                          { accountId: AccountId },
                          {
                              $set: {
                                  "profiles.athena.stats.attributes.ResetDatesuperChargedXP": ResetXPHourUTC,
                                  "profiles.athena.stats.attributes.superChargedXP": XPsuperChargedToGive
                              }
                          },
                          { strict: false }
                      );*/
                }
            }
        }
    }


    const sub_value = Number(user.sub_value);
    const sub_expire = user.sub_expire;
    if (sub_expire != "NO_CURRENT_DATA" || sub_expire != "None") {
        //  if (!isNaN(sub_expire)) {
        let DateExpire = new Date(sub_expire);
        if (DateNow < DateExpire) {
            bPaid = true;
        }
        //}
    }

    if (RestrictionGameInfo) {
        const Info = RestrictionGameInfo.Infos;
        if (Info) {
            const PlaylistInfo = Info[playlist]
            if (PlaylistInfo) {
                //  console.log(PlaylistInfo);
                let PlayerInfo = profile.profiles.athena.stats.attributes.RestrictionInfo;
                if (!PlayerInfo) {
                    PlayerInfo = { "Logs": [], "BoostAddiction": { Entries: 0, "ResetDate": "" } };
                }
                if (PlayerInfo) {
                    /*   if (!PlayersInfos[AccountId]) {
                           PlayersInfos[AccountId] = { accountId: AccountId, "Logs": [], "BoostAddiction": { Entries: 0, "ResetDate": "" } };
                       }*/
                    // const PlayerInfo = PlayersInfos[AccountId];
                    if (PlayerInfo) {

                        let LogPlayerPlaylist = null;

                        const logs = PlayerInfo.Logs;
                        for (let i = 0; i < logs.length; i++) {
                            if (logs[i].Playlist && logs[i].Playlist === playlist) {
                                LogPlayerPlaylist = logs[i];
                                break;
                            }
                        }
                        if (!LogPlayerPlaylist) {
                            bUpdateFile = true;
                            LogPlayerPlaylist = logs.push({
                                "Playlist": playlist,
                                "Entries": 1,
                                // "LastDate": "",
                                "ResetDate": ""
                            });
                        }

                        if (LogPlayerPlaylist) {
                            if (Number(LogPlayerPlaylist.Entries) >= Number(PlaylistInfo.MaxFreePlay)) {
                                if (LogPlayerPlaylist.ResetDate == "") {
                                    let currentDateToModif = new Date();
                                    currentDateToModif.setDate(currentDateToModif.getDate() + PlaylistInfo.ResetNextDays);
                                    LogPlayerPlaylist.ResetDate = currentDateToModif.toISOString();
                                    bUpdateFile = true;
                                }
                                //  const DateLastPlayed = new Date(LogPlayerPlaylist.LastDate);
                                const DateResetPlay = new Date(LogPlayerPlaylist.ResetDate);
                                if (DateResetPlay < DateNow) {
                                    bCanPlay = true;
                                    LogPlayerPlaylist.Entries = 1;
                                    LogPlayerPlaylist.ResetDate = "";
                                    bUpdateFile = true;
                                }
                                else {
                                    DaysToWait = calculerDifference(DateNow, DateResetPlay);
                                    bCanPlay = false;
                                }
                            }
                            else {
                                LogPlayerPlaylist.Entries++;
                                bUpdateFile = true;
                            }

                            if (bUpdateFile) {
                                updateFields["profiles.athena.stats.attributes.RestrictionInfo"] = PlayerInfo;

                                //  await fs1.writeFile(ResInfoPath, JSON.stringify(RestrictionGameInfo, null, 2));
                            }
                        }
                    }
                }
            }
        }
    }

    bUpdateFile = false;
    /*
            const BoostAdictionInfo = RestrictionGameInfo.BoostAdiction;
            if (BoostAdictionInfo) {
                if (BoostAdictionInfo.bEnable) {
                    const PlayersInfos = RestrictionGameInfo.Players;
                    if (PlayersInfos) {
                        if (!PlayersInfos[AccountId]) {
                            PlayersInfos[AccountId] = { accountId: AccountId, "Logs": [], "BoostAddiction": { Entries: 0, "ResetDate": "" } };
                        }
                        const PlayerInfo = PlayersInfos[AccountId];
                        if (PlayerInfo) {
                            const BoostAddication = PlayerInfo.BoostAddiction;
                            if (BoostAddication) {
                                if (Number(BoostAddication.Entries) >= Number(BoostAdictionInfo.MaxGame)) {
                                    if (BoostAddication.ResetDate == "") {
                                        let currentDateToModif = new Date();
                                        currentDateToModif.setUTCHours(currentDateToModif, 0, 0, 0);
    
                                        //let currentDateToModif = new Date();
                                        // currentDateToModif.setHours(currentDateToModif.getHours() + BoostAdictionInfo.ResetNextHours);
                                        BoostAddication.ResetDate = currentDateToModif;
                                        bUpdateFile = true;
                                    }
                                    //  const DateLastPlayed = new Date(LogPlayerPlaylist.LastDate);
                                    const DateResetPlay = new Date(BoostAddication.ResetDate);
                                    if (DateResetPlay < DateNow) {
                                        bBoostAddication = true;
                                        BoostAddication.Entries = 1;
                                        BoostAddication.ResetDate = "";
                                        bUpdateFile = true;
                                    g}
                                    else {
                                        bBoostAddication = false
                                    }
                                }
                                else {
                                    BoostAddication.Entries++;
                                    bBoostAddication = true;
                                    bUpdateFile = true;
                                }
    
                                if (bUpdateFile)
                                    await fs1.writeFile(ResInfoPath, JSON.stringify(RestrictionGameInfo, null, 2));
                            }
                        }
                    }
                }
            }
        }*/


    let bInvalidated = false;

    if (global.Clients.length > 0) {
        const ClientAccount = global.Clients.find(i => i.accountId && i.accountId == AccountId);
        if (ClientAccount && ClientAccount.LastClientHeartbeat != undefined) {
            // const LastHearbeatDate = new Date(ClientAccount.LastClientHeartbeat);
            // if (LastHearbeatDate < DateNow) {
            if (ClientAccount.bInvalidated != undefined)
                bInvalidated = ClientAccount.bInvalidated;
            //}
        }
    }


    // Si tu veux vérifier que l'objet a plus d'un champ
    if (Object.keys(updateFields).length > 0) {
        // Exécuter seulement si updateFields a au moins un élément
        Profile.updateOne(
            { accountId: AccountId },
            {
                $set: updateFields
            },
            { strict: false },
            function (err, res) {
                if (err) {
                    console.error(err);
                } else {
                    //   console.log("Update successful:", res);
                }
            }
        );
    }
    // console.log("DaysToWait : " + DaysToWait);

    // console.timeEnd('Total Time');

    let AllGroups = global.MUCs;

    var obj = AllGroups;
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
        let CurrentGroup = obj[keys[i]];
        if (!CurrentGroup) continue;
        var keys2 = CurrentGroup.members;
        for (var d = 0; d < keys2.length; d++) {
            {
                let CurrentMember = keys2[d];
                if (CurrentMember) {
                    const CurrentMemberAccountID = CurrentMember.accountId;
                    if (!CurrentMemberAccountID) continue;

                    if (CurrentMemberAccountID == AccountId) {
                        return res.status(200).json({ party: keys[i], size: keys2.length, bFoundHwidInfo, error: "success", Level, Last_bFillOption: bFill, bPaid, sub_value, DaysToWait, bCanPlay, bBoostAddication, bInvalidated, superChargedXP });
                    }
                    //   console.log("AccoutnID OF PARTY: " + CurrentMember.accountId);
                }
            }
        }
    }

    return res.status(200).json({ error: "bad not in a group", bFoundHwidInfo, Level, Last_bFillOption: bFill, bPaid, sub_value, DaysToWait, bCanPlay, bBoostAddication, bInvalidated, superChargedXP });
})
app.get("/GetParty2", async (req, res) => {

    let AllGroups = global.MUCs;

    return res.status(200).json({ ok: AllGroups });
})

const minutesAddHear = Number(1);

app.post("/fortnite/:accountid/:key/frienderschat", async (req, res) => {

    const accountid = req.params.accountid;
    const Key = Number(req.params.key);
    const AddCheck = Number(48);

    const expectedAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
    const userAgent = req.headers['user-agent'] || "";

    if (accountid) {
        if (global.Clients.length > 0) {
            let ClientAccount = global.ACHeartElem[accountid];
            if (!ClientAccount) {
                ClientAccount = { accountid: accountid, LastClientHeartbeat: new Date(), bInvalidated: false };
                global.ACHeartElem[accountid] = ClientAccount;
            }
            if (ClientAccount) {
                if (ClientAccount.bBanned != undefined) {
                    return res.status(500).json({ message: "success" });
                }

                const keyRnd = Math.floor(Math.random() * (56000 - 5 + 1)) + 5;

                if (Key != AddCheck || userAgent != expectedAgent) {
                    console.log("hear on server failed for : " + accountid + ":" + Key + ": normallyshould:" + AddCheck);

                    return res.status(200).json({ success: keyRnd, soumise: 50 });
                }

                /*
                                let KeyHeart = ClientAccount.KeyHeart;
                                if (KeyHeart != undefined && KeyHeart != null) {
                                    if (Key != undefined && !isNaN(Key)) {
                                        //console.log(Key);
                                        if (Number(Key) != Number(KeyHeart) + AddCheck) {
                                            console.log("hear on server failed for : " + accountid + ":" + Key + ": normallyshould:" + KeyHeart);
                
                                            return res.status(500).json({ message: "success" });
                                        }
                                    }
                                }*/

                //console.log("hear on server success : " + Key);
                //let DateAdd = new Date();
                const DateAdde = new Date();

                //   DateAdd.setMinutes(DateAdd.getMinutes() + minutesAddHear);
                KeyHeart = Number(keyRnd);
                ClientAccount.KeyHeart = Number(keyRnd);
                ClientAccount.LastClientHeartbeat = DateAdde;
                ClientAccount.bInvalidated = false;

                return res.status(200).json({ success: keyRnd, soumise: Number(minutesAddHear * 60 - 5) });
            }
        }
    }

    /*
        // console.log("received: " + accountid);
        if (accountid) {
            
            if (global.Clients.length > 0) {
                const ClientAccount = global.Clients.find(i => i.accountId && i.accountId == accountid);
                if (ClientAccount) {
    
                    const AddCheck = Number(48);
    
                    if (ClientAccount.bBanned != undefined) {
                        return res.status(500).json({ message: "success" });
                    }
    
    
                    let KeyHeart = ClientAccount.KeyHeart;
                    if (KeyHeart != undefined && KeyHeart != null) {
                        if (Key != undefined && !isNaN(Key)) {
                            //console.log(Key);
                            if (Number(Key) != Number(KeyHeart) + AddCheck) {
                                  console.log("hear on server failed for : " + accountid);
    
                                return res.status(500).json({ message: "success" });
                            }
                        }
                    }
    
                    //console.log("hear on server success : " + Key);
                    //let DateAdd = new Date();
                    const DateAdde = new Date();
    
                    //   DateAdd.setMinutes(DateAdd.getMinutes() + minutesAddHear);
                    const keyRnd = Math.floor(Math.random() * (56000 - 5 + 1)) + 5;
                    KeyHeart = Number(keyRnd);
                    ClientAccount.KeyHeart = Number(keyRnd);
                    ClientAccount.LastClientHeartbeat = DateAdde;
    
    
                    return res.status(200).json({ success: keyRnd, soumise: Number(minutesAddHear * 60 - 5) });
                }
            }
        }*/
    return res.status(500).json({ message: "bad" });
})


async function VerifyHeartbeat() {

    let DateNow = new Date();
    let DateAdd = new Date();
    DateAdd.setMinutes(DateAdd.getMinutes() + minutesAddHear);

    if (global.Clients.length > 0) {
        for (let i = 0; i < global.Clients.length; i++) {
            const client = global.Clients[i];
            if (!client) continue;

            const resource = client.resource;
            if (!resource) continue;

            if (client.bInvalidated == undefined)
                client.bInvalidated = false;

            const bWindows = resource.includes(":WIN:");
            if (!bWindows) continue;

            // client.bInvalidated = false;

            // continue;
            /*
                        const LastClientHeartbeat = client.LastClientHeartbeat;
                        if (!LastClientHeartbeat || LastClientHeartbeat == undefined) {
                            // WE SKIP FOR THIS TIME
                            // const KeyNumberRnd = Math.floor(Math.random() * (56000 - 5 + 1)) + 5;
                            client.LastClientHeartbeat = DateNow;
                            client.ErrorHeart = Number(0);
                            client.bInvalidated = false;
                            // client.KeyHeartbeat = Number(KeyNumberRnd);
                            continue;
                        }
            
                        const timeSinceLastHeartbeat = Date.now() - LastClientHeartbeat;
            
                        if (timeSinceLastHeartbeat >= 2 * 60 * 1000) { // 2 minutes en millisecondes
                            const accid = client.accountId;
            
                            console.log('Aucun heartbeat reçu depuis plus de 2 minutes ! ' + accid);
                            client.bInvalidated = true;
                            client.KeyHeart = null;
            
            
                            /*
                                            let refreshToken = global.refreshTokens.findIndex(i => i.accountId == accid);
                                            if (refreshToken != -1) global.refreshTokens.splice(refreshToken, 1);
                            
                                            let accessToken = global.accessTokens.findIndex(i => i.accountId == accid);
                                            if (accessToken != -1) {
                                                global.accessTokens.splice(accessToken, 1);
                            
                                                let xmppClient = global.Clients.find(client => client.accountId == accid);
                                                if (xmppClient) xmppClient.client.close();
                                            }
            
                            // Action en cas d'absence de communication
                        } else {
                            //     console.log('Communication normale');
                        }
            
            
                        //   client.LastClientHeartbeat = "nigger";
                        //     console.log(client);
            
                        //   const EvaluatedKeyCheck = Number(client.KeyHeartbeat) + 46;
                        /*
                                    const LastHearbeatDate = new Date(LastClientHeartbeat);
                                    if (LastHearbeatDate < DateNow && client.accountId) {
                                        client.ErrorHeart++;
                                        console.log("LastHearbeatDate:" + LastHearbeatDate.toISOString());
                        
                                        if (Number(client.ErrorHeart) > 1) {
                                            client.bInvalidated = true;
                        
                                            console.log("Client is Invalidated");
                                            const targetUser = await User.findOne({ accountId: client.accountId }).lean();
                                            if (!targetUser) continue;
                        
                                            let refreshToken = global.refreshTokens.findIndex(i => i.accountId == targetUser.accountId);
                                            if (refreshToken != -1) global.refreshTokens.splice(refreshToken, 1);
                        
                                            let accessToken = global.accessTokens.findIndex(i => i.accountId == targetUser.accountId);
                                            if (accessToken != -1) {
                                                global.accessTokens.splice(accessToken, 1);
                        
                                                let xmppClient = global.Clients.find(client => client.accountId == targetUser.accountId);
                                                if (xmppClient) xmppClient.client.close();
                                            }
                                        }
                                        else {
                                            client.bInvalidated = false;
                                            client.LastClientHeartbeat = DateAdd.toISOString();
                                            console.log("Client is Invalidated but retrying later");
                                        }
                                    }*/
        }


        const Version = "Launcher";
        let AnalysticBuild = await Analystic.findOne({ version: Version });
        if (!AnalysticBuild) {
            try {
                AnalysticBuild = await Analystic.create({ created: DateNow, last_update: DateNow, version: Version, document: { version: Version } });
            } catch (err) {
                console.log(err);
                return;
            };
        }


        const Document = AnalysticBuild.document;

        let DocumentPicks = Document.DocumentPicks;
        if (!DocumentPicks) {
            Document.DocumentPicks = {
                "Last_HighCount_Date": "",
                "Last_HighCount": 0,
                "Old_HighCount_Date": "",
                "Old_HighCount": 0,
            }
            DocumentPicks = Document.DocumentPicks;
        }

        let Events = Document.events;
        if (!Events) {
            Document.events = [];
            Events = Document.events;
        }

        if (DocumentPicks) {
            const OnlineNowCount = Number(global.Clients.length);
            const Last_HighCount = Number(DocumentPicks.Last_HighCount);
            if (OnlineNowCount > Last_HighCount) {
                DocumentPicks.Old_HighCount = Last_HighCount;
                DocumentPicks.Old_HighCount_Date = DocumentPicks.Last_HighCount_Date;

                DocumentPicks.Last_HighCount = OnlineNowCount;
                DocumentPicks.Last_HighCount_Date = DateNow;

                if (!DocumentPicks.History)
                    DocumentPicks.History = [];

                const NewRecord = {
                    Date: DateNow,
                    NewCount: OnlineNowCount
                }

                DocumentPicks.History.push(NewRecord);


                await AnalysticBuild.updateOne({ $set: { "last_update": DateNow, "document": Document } }, { strict: false });
            }
        }
    }
}

//setInterval(VerifyHeartbeat, 1 * 60 * 1000 + 10 * 1000);

//setInterval(VerifyHeartbeat, 10 * 1000);

app.get("/allaparty", (req, res) => {
    res.type("application/json");

    let data = JSON.stringify({
        "Partys": {
            "All": global.MUCs
        }
    }, null, 2);

    res.send(data);
});


app.get("/clientsreal", (req, res) => {
    res.type("application/json");

    let data = JSON.stringify({
        "amount": global.Clients.length,
        "clients": global.Clients.map(i => i.displayName)
    }, null, 2);

    res.send(data);
});

wss.on('listening', () => {
    log.xmpp(`XMPP and Matchmaker started listening on port ${port}`);
});

wss.on('connection', async (ws, req) => {
    ws.on('error', () => { });

    // Start matchmaker if it's not connecting for xmpp.
    if (ws.protocol.toLowerCase() != "xmpp") return matchmaker(ws, req);

    let joinedMUCs = [];
    let accountId = "";
    let displayName = "";
    let token = "";
    let jid = "";
    let resource = "";
    let ID = "";
    let Authenticated = false;
    let clientExists = false;
    let connectionClosed = false;

    ws.on('message', async (message) => {
        if (Buffer.isBuffer(message)) message = message.toString();

        const msg = XMLParser(message);
        if (!msg || !msg.root || !msg.root.name) return Error(ws);

        switch (msg.root.name) {
            case "open":
                if (!ID) ID = functions.MakeID();

                ws.send(XMLBuilder.create("open")
                    .attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-framing")
                    .attribute("from", global.xmppDomain)
                    .attribute("id", ID)
                    .attribute("version", "1.0")
                    .attribute("xml:lang", "en").toString());

                if (Authenticated) {
                    ws.send(XMLBuilder.create("stream:features").attribute("xmlns:stream", "http://etherx.jabber.org/streams")
                        .element("ver").attribute("xmlns", "urn:xmpp:features:rosterver").up()
                        .element("starttls").attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-tls").up()
                        .element("bind").attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-bind").up()
                        .element("compression").attribute("xmlns", "http://jabber.org/features/compress")
                        .element("method", "zlib").up().up()
                        .element("session").attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-session").up().toString());
                } else {
                    ws.send(XMLBuilder.create("stream:features").attribute("xmlns:stream", "http://etherx.jabber.org/streams")
                        .element("mechanisms").attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-sasl")
                        .element("mechanism", "PLAIN").up().up()
                        .element("ver").attribute("xmlns", "urn:xmpp:features:rosterver").up()
                        .element("starttls").attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-tls").up()
                        .element("compression").attribute("xmlns", "http://jabber.org/features/compress")
                        .element("method", "zlib").up().up()
                        .element("auth").attribute("xmlns", "http://jabber.org/features/iq-auth").up().toString());
                }
                break;

            case "auth":
                if (!ID) return;
                if (accountId) return;
                if (!msg.root.content) return Error(ws);
                if (!functions.DecodeBase64(msg.root.content).includes("\u0000")) return Error(ws);

                let decodedBase64 = functions.DecodeBase64(msg.root.content).split("\u0000");

                let object = global.accessTokens.find(i => i.token == decodedBase64[2]);
                if (!object) return Error(ws);

                if (global.Clients.find(i => i.accountId == object.accountId)) return Error(ws);

                let user = await User.findOne({ accountId: object.accountId }).lean();
                if (!user) return Error(ws);

                accountId = user.accountId;
                displayName = user.username;
                token = object.token;

                if (decodedBase64 && accountId && displayName && token && decodedBase64.length == 3) {
                    Authenticated = true;
                    log.xmpp(`An xmpp client with the displayName ${displayName} has logged in.`);

                    ws.send(XMLBuilder.create("success").attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-sasl").toString());
                } else return Error(ws);
                break;

            case "iq":
                if (!ID) return;

                switch (msg.root.attributes.id) {
                    case "_xmpp_bind1":
                        if (resource || !accountId) return;
                        if (!msg.root.children.find(i => i.name == "bind")) return;

                        if (global.Clients.find(i => i.accountId == accountId)) return Error(ws);

                        let findResource = msg.root.children.find(i => i.name == "bind").children.find(i => i.name == "resource");

                        if (!findResource) return;
                        if (!findResource.content) return;

                        resource = findResource.content;
                        jid = `${accountId}@${global.xmppDomain}/${resource}`;

                        ws.send(XMLBuilder.create("iq")
                            .attribute("to", jid)
                            .attribute("id", "_xmpp_bind1")
                            .attribute("xmlns", "jabber:client")
                            .attribute("type", "result")
                            .element("bind")
                            .attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-bind")
                            .element("jid", jid).up().up().toString());
                        break;

                    case "_xmpp_session1":
                        if (!clientExists) return Error(ws);

                        ws.send(XMLBuilder.create("iq")
                            .attribute("to", jid)
                            .attribute("from", global.xmppDomain)
                            .attribute("id", "_xmpp_session1")
                            .attribute("xmlns", "jabber:client")
                            .attribute("type", "result").toString());

                        await getPresenceFromFriends(ws, accountId, jid);
                        break;

                    default:
                        if (!clientExists) return Error(ws);

                        ws.send(XMLBuilder.create("iq")
                            .attribute("to", jid)
                            .attribute("from", global.xmppDomain)
                            .attribute("id", msg.root.attributes.id)
                            .attribute("xmlns", "jabber:client")
                            .attribute("type", "result").toString());
                }
                break;

            case "message":
                if (!clientExists) return Error(ws);

                let findBody = msg.root.children.find(i => i.name == "body");

                if (!findBody || !findBody.content) return;

                let body = findBody.content;

                switch (msg.root.attributes.type) {
                    case "chat":
                        if (!msg.root.attributes.to) return;
                        if (body.length >= 300) return;

                        let receiver = global.Clients.find(i => i.jid.split("/")[0] == msg.root.attributes.to);

                        if (!receiver) return;
                        if (receiver.accountId == accountId) return;

                        receiver.client.send(XMLBuilder.create("message")
                            .attribute("to", receiver.jid)
                            .attribute("from", jid)
                            .attribute("xmlns", "jabber:client")
                            .attribute("type", "chat")
                            .element("body", body).up().toString());
                        return;

                    case "groupchat":
                        if (!msg.root.attributes.to) return;
                        if (body.length >= 300) return;

                        let roomName = msg.root.attributes.to.split("@")[0];

                        let MUC = global.MUCs[roomName];
                        if (!MUC) return;

                        if (!MUC.members.find(i => i.accountId == accountId)) return;

                        MUC.members.forEach(member => {
                            let ClientData = global.Clients.find(i => i.accountId == member.accountId);
                            if (!ClientData) return;

                            ClientData.client.send(XMLBuilder.create("message")
                                .attribute("to", ClientData.jid)
                                .attribute("from", getMUCmember(roomName, displayName, accountId, resource))
                                .attribute("xmlns", "jabber:client")
                                .attribute("type", "groupchat")
                                .element("body", body).up().toString());
                        });
                        return;
                }

                if (isJSON(body)) {
                    let bodyJSON = JSON.parse(body);

                    if (Array.isArray(bodyJSON)) return;
                    if (typeof bodyJSON.type != "string") return;
                    if (!msg.root.attributes.to) return;
                    if (!msg.root.attributes.id) return;

                    // ::   console.log(bodyJSON);

                    const payload = bodyJSON.payload;
                    //§§   console.log(payload);
                    if (bodyJSON.type == "com.epicgames.party.memberpromoted") {
                        if (payload) {
                            const partyId = payload.partyId;
                            if (partyId) {
                                const promotedMemberUserId = payload.promotedMemberUserId;
                                if (global.MUCs && promotedMemberUserId) {
                                    //   console.log(partyId);
                                    const PartyIdNew = global.MUCs["Party-" + partyId];
                                    if (PartyIdNew) {
                                        PartyIdNew.LeaderId = promotedMemberUserId;
                                    }
                                }
                            }

                        }
                    }

                    sendXmppMessageToClient(jid, msg, body);
                }
                break;

            case "presence":
                if (!clientExists) return Error(ws);

                switch (msg.root.attributes.type) {
                    case "unavailable":
                        if (!msg.root.attributes.to) return;

                        if (msg.root.attributes.to.endsWith(`@muc.${global.xmppDomain}`) || msg.root.attributes.to.split("/")[0].endsWith(`@muc.${global.xmppDomain}`)) {
                            if (!msg.root.attributes.to.toLowerCase().startsWith("party-")) return;

                            let roomName = msg.root.attributes.to.split("@")[0];

                            if (!global.MUCs[roomName]) return;

                            let memberIndex = global.MUCs[roomName].members.findIndex(i => i.accountId == accountId);
                            if (memberIndex != -1) {
                                global.MUCs[roomName].members.splice(memberIndex, 1);
                                joinedMUCs.splice(joinedMUCs.indexOf(roomName), 1);
                            }

                            ws.send(XMLBuilder.create("presence")
                                .attribute("to", jid)
                                .attribute("from", getMUCmember(roomName, displayName, accountId, resource))
                                .attribute("xmlns", "jabber:client")
                                .attribute("type", "unavailable")
                                .element("x").attribute("xmlns", "http://jabber.org/protocol/muc#user")
                                .element("item")
                                .attribute("nick", getMUCmember(roomName, displayName, accountId, resource).replace(`${roomName}@muc.${global.xmppDomain}/`, ""))
                                .attribute("jid", jid)
                                .attribute("role", "none").up()
                                .element("status").attribute("code", "110").up()
                                .element("status").attribute("code", "100").up()
                                .element("status").attribute("code", "170").up().up().toString());
                            return;
                        }
                        break;

                    default:
                        if (msg.root.children.find(i => i.name == "muc:x") || msg.root.children.find(i => i.name == "x")) {
                            if (!msg.root.attributes.to) return;

                            let roomName = msg.root.attributes.to.split("@")[0];

                            if (!global.MUCs[roomName]) global.MUCs[roomName] = { members: [] };

                            if (global.MUCs[roomName].members.find(i => i.accountId == accountId)) return;

                            if (global.MUCs[roomName].members.length <= 0) {
                                global.MUCs[roomName].LeaderId = accountId;
                            }
                            global.MUCs[roomName].members.push({ accountId: accountId, Id: global.MUCs[roomName].members.length + 1 });


                            joinedMUCs.push(roomName);

                            ws.send(XMLBuilder.create("presence")
                                .attribute("to", jid)
                                .attribute("from", getMUCmember(roomName, displayName, accountId, resource))
                                .attribute("xmlns", "jabber:client")
                                .element("x").attribute("xmlns", "http://jabber.org/protocol/muc#user")
                                .element("item")
                                .attribute("nick", getMUCmember(roomName, displayName, accountId, resource).replace(`${roomName}@muc.${global.xmppDomain}/`, ""))
                                .attribute("jid", jid)
                                .attribute("role", "participant")
                                .attribute("affiliation", "none").up()
                                .element("status").attribute("code", "110").up()
                                .element("status").attribute("code", "100").up()
                                .element("status").attribute("code", "170").up()
                                .element("status").attribute("code", "201").up().up().toString());

                            global.MUCs[roomName].members.forEach(member => {
                                let ClientData = global.Clients.find(i => i.accountId == member.accountId);
                                if (!ClientData) return;

                                ws.send(XMLBuilder.create("presence")
                                    .attribute("from", getMUCmember(roomName, ClientData.displayName, ClientData.accountId, ClientData.resource))
                                    .attribute("to", jid)
                                    .attribute("xmlns", "jabber:client")
                                    .element("x")
                                    .attribute("xmlns", "http://jabber.org/protocol/muc#user")
                                    .element("item")
                                    .attribute("nick", getMUCmember(roomName, ClientData.displayName, ClientData.accountId, ClientData.resource).replace(`${roomName}@muc.${global.xmppDomain}/`, ""))
                                    .attribute("jid", ClientData.jid)
                                    .attribute("role", "participant")
                                    .attribute("affiliation", "none").up().up().toString());

                                if (accountId == ClientData.accountId) return;

                                ClientData.client.send(XMLBuilder.create("presence")
                                    .attribute("from", getMUCmember(roomName, displayName, accountId, resource))
                                    .attribute("to", ClientData.jid)
                                    .attribute("xmlns", "jabber:client")
                                    .element("x")
                                    .attribute("xmlns", "http://jabber.org/protocol/muc#user")
                                    .element("item")
                                    .attribute("nick", getMUCmember(roomName, displayName, accountId, resource).replace(`${roomName}@muc.${global.xmppDomain}/`, ""))
                                    .attribute("jid", jid)
                                    .attribute("role", "participant")
                                    .attribute("affiliation", "none").up().up().toString());
                            });
                            return;
                        }
                }

                let findStatus = msg.root.children.find(i => i.name == "status");

                if (!findStatus || !findStatus.content) return;
                if (!isJSON(findStatus.content)) return;
                if (Array.isArray(JSON.parse(findStatus.content))) return;

                let status = findStatus.content;
                let away = msg.root.children.find(i => i.name == "show") ? true : false;

                await updatePresenceForFriends(ws, status, away, false);
                functions.getPresenceFromUser(accountId, accountId, false);
                break;
        }

        if (!clientExists && !connectionClosed) {
            if (accountId && displayName && token && jid && ID && resource && Authenticated) {
                global.Clients.push({
                    client: ws,
                    accountId: accountId,
                    displayName: displayName,
                    token: token,
                    jid: jid,
                    resource: resource,
                    lastPresenceUpdate: {
                        away: false,
                        status: "{}"
                    }
                });

                clientExists = true;
            }
        }
    });

    ws.on('close', () => { connectionClosed = true; clientExists = false; RemoveClient(ws, joinedMUCs); });
});

function Error(ws) {
    return;
    ws.send(XMLBuilder.create("close").attribute("xmlns", "urn:ietf:params:xml:ns:xmpp-framing").toString());
    ws.close();
}

function RemoveClient(ws, joinedMUCs) {
    let clientIndex = global.Clients.findIndex(i => i.client == ws);
    let client = global.Clients[clientIndex];

    if (clientIndex == -1) return;

    let ClientStatus = JSON.parse(client.lastPresenceUpdate.status);

    updatePresenceForFriends(ws, "{}", false, true);

    global.Clients.splice(clientIndex, 1);

    for (let roomName of joinedMUCs) {
        if (global.MUCs[roomName]) {
            let memberIndex = global.MUCs[roomName].members.findIndex(i => i.accountId == client.accountId);

            if (memberIndex != -1) global.MUCs[roomName].members.splice(memberIndex, 1);
        }
    }

    let partyId = "";

    try {
        switch (true) {
            case (!ClientStatus.Properties): break;
            case (isObject(ClientStatus.Properties)): {
                for (let key in ClientStatus.Properties) {
                    if (key.toLowerCase().startsWith("party.joininfo")) {
                        if (isObject(ClientStatus.Properties[key])) partyId = ClientStatus.Properties[key].partyId;
                    }
                }
            }
        }
    } catch { }

    if (partyId && typeof partyId == "string") {
        global.Clients.forEach(ClientData => {
            if (client.accountId == ClientData.accountId) return;

            ClientData.client.send(XMLBuilder.create("message")
                .attribute("id", functions.MakeID().replace(/-/ig, "").toUpperCase())
                .attribute("from", client.jid)
                .attribute("xmlns", "jabber:client")
                .attribute("to", ClientData.jid)
                .element("body", JSON.stringify({
                    "type": "com.epicgames.party.memberexited",
                    "payload": {
                        "partyId": partyId,
                        "memberId": client.accountId,
                        "wasKicked": false
                    },
                    "timestamp": new Date().toISOString()
                })).up().toString());
        });
    }

    log.xmpp(`An xmpp client with the displayName ${client.displayName} has logged out.`);
}

async function getPresenceFromFriends(ws, accountId, jid) {
    let friends = await Friends.findOne({ accountId: accountId }).lean();
    if (!friends) return;

    let accepted = friends.list.accepted;

    accepted.forEach(friend => {
        let ClientData = global.Clients.find(i => i.accountId == friend.accountId);
        if (!ClientData) return;

        let xml = XMLBuilder.create("presence")
            .attribute("to", jid)
            .attribute("xmlns", "jabber:client")
            .attribute("from", ClientData.jid)
            .attribute("type", "available")

        if (ClientData.lastPresenceUpdate.away) xml = xml.element("show", "away").up().element("status", ClientData.lastPresenceUpdate.status).up();
        else xml = xml.element("status", ClientData.lastPresenceUpdate.status).up();

        ws.send(xml.toString());
    });
}

async function updatePresenceForFriends(ws, body, away, offline) {
    let SenderIndex = global.Clients.findIndex(i => i.client == ws);
    let SenderData = global.Clients[SenderIndex];

    if (SenderIndex == -1) return;

    global.Clients[SenderIndex].lastPresenceUpdate.away = away;
    global.Clients[SenderIndex].lastPresenceUpdate.status = body;

    let friends = await Friends.findOne({ accountId: SenderData.accountId }).lean();
    let accepted = friends.list.accepted;

    accepted.forEach(friend => {
        let ClientData = global.Clients.find(i => i.accountId == friend.accountId);
        if (!ClientData) return;

        let xml = XMLBuilder.create("presence")
            .attribute("to", ClientData.jid)
            .attribute("xmlns", "jabber:client")
            .attribute("from", SenderData.jid)
            .attribute("type", offline ? "unavailable" : "available");

        if (away) xml = xml.element("show", "away").up().element("status", body).up();
        else xml = xml.element("status", body).up();

        ClientData.client.send(xml.toString());
    });
}

function sendXmppMessageToClient(senderJid, msg, body) {
    if (typeof body == "object") body = JSON.stringify(body);

    let receiver = global.Clients.find(i => i.jid.split("/")[0] == msg.root.attributes.to || i.jid == msg.root.attributes.to);
    if (!receiver) return;

    receiver.client.send(XMLBuilder.create("message")
        .attribute("from", senderJid)
        .attribute("id", msg.root.attributes.id)
        .attribute("to", receiver.jid)
        .attribute("xmlns", "jabber:client")
        .element("body", `${body}`).up().toString());
}

function getMUCmember(roomName, displayName, accountId, resource) {
    return `${roomName}@muc.${global.xmppDomain}/${encodeURI(displayName)}:${accountId}:${resource}`;
}

function isObject(value) {
    if (typeof value == "object" && !Array.isArray(value)) return true;
    else return false;
}

function isJSON(str) {
    try {
        JSON.parse(str)
    } catch (err) {
        return false;
    }
    return true;
}