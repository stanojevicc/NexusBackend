const express = require("express");
const fs = require("fs");
const app = express.Router();
const Profile = require("../model/profiles.js");
const profileManager = require("../structs/profile.js");
const error = require("../structs/error.js");
const functions = require("../structs/functions.js");
const User = require("../model/user.js");
const path = require("path");
const { grantVBucks } = require("../Cosmos/Functions/grantVBucks");
const { LoadSeasonProfile } = require("../Cosmos/Functions/LoadSeasonProfile");
const { verifyToken, verifyClient } = require("../tokenManager/tokenVerify.js");

const config = JSON.parse(fs.readFileSync("./Config/config.json").toString());

function getTopN(arr, prop, n) {
  // clone before sorting, to preserve the original array
  var clone = arr.slice(0);

  // sort descending
  clone.sort(function (x, y) {
    if (x[prop] == y[prop]) return 0;
    else if (parseInt(x[prop]) < parseInt(y[prop])) return 1;
    else return -1;
  });

  return clone.slice(0, n || 1);
}

app.post("/fortnite/api/game/v2/chat/*/*/*/pc", (req, res) => {
  let resp = config.chat.EnableGlobalChat ? { "GlobalChatRooms": [{ "roomName": "lawinserverglobal" }] } : {};

  res.json(resp);
});

app.post("/fortnite/api/game/v2/tryPlayOnPlatform/account/*", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(true);
});

app.get("/launcher/api/public/distributionpoints/", (req, res) => {
  res.json({
    "distributions": [
      "https://download.epicgames.com/",
      "https://download2.epicgames.com/",
      "https://download3.epicgames.com/",
      "https://download4.epicgames.com/",
      "https://epicgames-download1.akamaized.net/"
    ]
  });
});

app.get("/waitingroom/api/waitingroom", (req, res) => {
  res.status(204);
  res.end();
});


app.get("/socialban/api/public/v1/*", (req, res) => {
  res.json({
    "bans": [],
    "warnings": []
  });
});

app.get("/fortnite/api/game/v2/events/tournamentandhistory/*/EU/WindowsClient", (req, res) => {
  res.json({});
});


app.get("/statsproxy/api/statsv2/account/:accountId", (req, res) => {
  res.json({
    "startTime": 0,
    "endTime": 0,
    "stats": {},
    "accountId": req.params.accountId
  });
});



app.post("/fortnite/api/feedback/*", (req, res) => {
  res.status(200);
  res.end();
});

app.post("/fortnite/api/statsv2/query", (req, res) => {
  res.json([]);
});

app.post("/statsproxy/api/statsv2/query", (req, res) => {
  res.json([]);
});

app.post("/fortnite/api/game/v2/events/v2/setSubgroup/*", (req, res) => {
  res.status(204);
  res.end();
});

app.get("/fortnite/api/game/v2/enabled_features", (req, res) => {
  res.json([]);
});
/*
app.get("/api/v1/events/Fortnite/download/:accountId", async (req, res) => {
  const events = JSON.parse(fs.readFileSync(path.join(__dirname, "../responses/events.json"), "utf8"));
  return res.status(200).json(events);

});
*/


app.get("/fortnite/api/game/v2/twitch/*", (req, res) => {
  res.status(200);
  res.end();
});

app.get("/fortnite/api/game/v2/world/info", (req, res) => {
  res.json({});
});

app.post("/fortnite/api/game/v2/chat/*/recommendGeneralChatRooms/pc", (req, res) => {
  res.json({});
});

app.get("/fortnite/api/receipts/v1/account/*/receipts", (req, res) => {
  res.json([]);
});

app.get("/fortnite/api/game/v2/leaderboards/cohort/*", (req, res) => {
  res.json([]);
});


app.get("/fortnite/api/game/v2/privacy/account/:accountId", (req, res) => {

  const accountId = req.params.accountId;
  if (!accountId) return res.json({});

  res.json({
    "accountId": accountId,
    "optOutOfPublicLeaderboards": true
  })
});


app.post("/datarouter/api/v1/public/data", (req, res) => {

  //grantVBucks(req, res);
  //console.log(req.body);
  LoadSeasonProfile(req, res);

   res.status(204);
   res.end();
});

module.exports = app;