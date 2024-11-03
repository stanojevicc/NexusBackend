const express = require("express");
const app = express.Router();

const error = require("../structs/error.js");

const { verifyToken, verifyClient } = require("../tokenManager/tokenVerify.js");
const User = require("../model/user.js");
const { cachecustom, cacheGet, cacheSet, cacheDel, cacheit, generateRandomCode, verifyTokenAPI, bValidUsername, sendEmail, getExpirationTime, dateToUnixTime, dateToTimestamp } = require("../model/Utils.js");

app.get("/account/api/public/account", async (req, res) => {
    let response = [];

    if (typeof req.query.accountId == "string") {
        let user = await User.findOne({ accountId: req.query.accountId, banned: false }).lean();

        if (user) {
            response.push({
                id: user.accountId,
                displayName: user.username,
                externalAuths: {}
            });
        }
    }

    if (Array.isArray(req.query.accountId)) {
        let users = await User.find({ accountId: { $in: req.query.accountId }, banned: false }).lean();

        if (users) {
            for (let user of users) {
                if (response.length >= 100) break;

                response.push({
                    id: user.accountId,
                    displayName: user.username,
                    externalAuths: {}
                });
            }
        }
    }

    res.json(response);
});

app.get("/account/api/public/account/displayName/:displayName", async (req, res) => {
    let user = await User.findOne({ username_lower: req.params.displayName.toLowerCase(), banned: false }).lean();
    if (!user) return error.createError(
        "errors.com.epicgames.account.account_not_found",
        `Sorry, we couldn't find an account for ${req.params.displayName}`,
        [req.params.displayName], 18007, undefined, 404, res
    );

    res.json({
        id: user.accountId,
        displayName: user.username,
        externalAuths: {}
    });
});

app.get("/persona/api/public/account/lookup", cacheit(240), async (req, res) => {
    if (typeof req.query.q != "string" || !req.query.q) return error.createError(
        "errors.com.epicgames.bad_request",
        "Required String parameter 'q' is invalid or not present",
        undefined, 1001, undefined, 400, res
    );

    let user = await User.findOne({ username_lower: req.query.q.toLowerCase(), banned: false }).lean();
    if (!user) return error.createError(
        "errors.com.epicgames.account.account_not_found",
        `Sorry, we couldn't find an account for ${req.query.q}`,
        [req.query.q], 18007, undefined, 404, res
    );

    res.json({
        id: user.accountId,
        displayName: user.username,
        externalAuths: {}
    });
});

app.get("/api/v1/search/:accountId", cacheit(240), async (req, res) => {
    let response = [];

    if (typeof req.query.prefix != "string" || !req.query.prefix) return error.createError(
        "errors.com.epicgames.bad_request",
        "Required String parameter 'prefix' is invalid or not present",
        undefined, 1001, undefined, 400, res
    );

    let users = await User.find({ username_lower: new RegExp(`^${req.query.prefix.toLowerCase()}`), banned: false }).lean();

    for (let user of users) {
        if (response.length >= 100) break;

        response.push({
            accountId: user.accountId,
            matches: [
                {
                    "value": user.username,
                    "platform": "epic"
                }
            ],
            matchType: req.query.prefix.toLowerCase() == user.username_lower ? "exact" : "prefix",
            epicMutuals: 0,
            sortPosition: response.length
        });
    }

    res.json(response);
});

app.get("/account/api/public/account/:accountId", cacheit(240), verifyToken, (req, res) => {

    if (req.user.accountId == "ICantPickToTry") {
        let Memory_CurrentAccountID = "ICantPickToTry";
        res.json({
            "id": req.params.accountId,
            "displayName": Memory_CurrentAccountID,
            "name": "Lawin",
            "email": Memory_CurrentAccountID + "@feur.com",
            "failedLoginAttempts": 0,
            "lastLogin": new Date().toISOString(),
            "numberOfDisplayNameChanges": 0,
            "ageGroup": "UNKNOWN",
            "headless": false,
            "country": "US",
            "lastName": "Server",
            "preferredLanguage": "en",
            "canUpdateDisplayName": false,
            "tfaEnabled": false,
            "emailVerified": true,
            "minorVerified": false,
            "minorExpected": false,
            "minorStatus": "NOT_MINOR",
            "cabinedMode": false,
            "hasHashedEmail": false
        })
    }
    else {
        res.json({
            id: req.user.accountId,
            displayName: req.user.username,
            name: "Lunar",
            email: `[hidden]@${req.user.email.split("@")[1]}`,
            failedLoginAttempts: 0,
            lastLogin: new Date().toISOString(),
            numberOfDisplayNameChanges: 0,
            ageGroup: "UNKNOWN",
            headless: false,
            country: "US",
            lastName: "Server",
            preferredLanguage: "en",
            canUpdateDisplayName: false,
            tfaEnabled: false,
            emailVerified: true,
            minorVerified: false,
            minorExpected: false,
            minorStatus: "UNKNOWN"
        });
    }
});

app.get("/account/api/public/account/*/externalAuths", (req, res) => {
    res.json([]);
});

module.exports = app;