const express = require("express");
const app = express.Router();

const Friends = require("../model/friends");
const Profile = require("../model/profiles.js");
const profileManager = require("../structs/profile.js");
const error = require("../structs/error.js");
const functions = require("../structs/functions.js");
var Base64 = require('js-base64');
var sjcl = require('sjcl');
const fs = require("fs");
var fs1 = require('fs-extra');
const path = require("path");
const { VivoxToken, ChannelType } = require('vivox-token');
const { cachecustom, cacheGet, cacheSet, cacheDel, cacheit, generateRandomCode, verifyTokenAPI, bValidUsername, sendEmail, getExpirationTime, dateToUnixTime, dateToTimestamp } = require("../model/Utils.js");


const { verifyToken, verifyClient } = require("../tokenManager/tokenVerify.js");

global.giftReceived = {};



function vxGenerateToken(key, payload) {
    // Header is static - base64url encoded {}
    var base64urlHeader = base64URLEncode("{}"); // Can also be defined as a constant "e30"

    // Encode payload
    var base64urlPayload = base64URLEncode(payload);

    // Join segments to prepare for signing
    var segments = [base64urlHeader, base64urlPayload];
    var toSign = segments.join(".");

    // Sign token with key and SHA-256
    var hmac = new sjcl.misc.hmac(sjcl.codec.utf8String.toBits(key), sjcl.hash.sha256);
    signature = sjcl.codec.base64.fromBits(hmac.encrypt(toSign));
    var base64urlSigned = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/\=+$/, "");

    segments.push(base64urlSigned);

    return segments.join(".");
}

function base64URLEncode(value) {

    return Buffer.from(value, 'base64').toString('ascii');


    return Buffer.from(value).toString('base64').replace(/\+/g, "-").replace(/\//g, "_").replace(/\=+$/, "");
    // return Base64.encode(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/\=+$/, "");
}

app.post("/fortnite/api/game/v2/voice/:accountid/createLoginToken", async (req, res) => {


    var accountid = req.params.accountid;

    const issuer = "martin9374-fo28-dev";
    const secretKey = "quiz903";
    const domain = "mt1s.vivox.com";
    const adminUserID = "Martin9374-Fo28-dev-Admin";
    const vivoxToken = new VivoxToken(issuer, secretKey, domain, adminUserID);

    const loginToken = vivoxToken.login(accountid);

    return res.status(200).json({ token: loginToken });

    // return res.status(200).json( { token: "e30.eyJpc3MiOiJibGluZG1lbG9uLUFwcE5hbWUtZGV2IiwidnhhIjoibG9naW4iLCJ2eGkiOjkzMzAwMCwiZXhwIjoxNjAwMzQ5NDAwLCJmIjoic2lwOi5ibGluZG1lbG9uLUFwcE5hbWUtZGV2Lmplcmt5LkB0bGEudml2b3guY29tIn0.5FKsAQz7bRQGGlSZw-KIcCmft7Ic6nT3Ih-TbdYPWwI" } );
})

app.post("/fortnite/api/game/v2/profile/*/client/SetReceiveGiftsEnabled", cacheit(604800), verifyToken, async (req, res) => {
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    if (!await profileManager.validateProfile(req.query.profileId, profiles)) return error.createError(
        "errors.com.epicgames.modules.profiles.operation_forbidden",
        `Unable to find template configuration for profile ${req.query.profileId}`,
        [req.query.profileId], 12813, undefined, 403, res
    );

    let profile = profiles.profiles[req.query.profileId];

    if (req.query.profileId != "common_core") return error.createError(
        "errors.com.epicgames.modules.profiles.invalid_command",
        `SetReceiveGiftsEnabled is not valid on ${req.query.profileId} profile`,
        ["SetReceiveGiftsEnabled", req.query.profileId], 12801, undefined, 400, res
    );

    const memory = functions.GetVersionInfo(req);

    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
    let QueryRevision = req.query.rvn || -1;

    if (typeof req.body.bReceiveGifts != "boolean") return ValidationError("bReceiveGifts", "a boolean", res);

    profile.stats.attributes.allowed_to_receive_gifts = req.body.bReceiveGifts;

    ApplyProfileChanges.push({
        "changeType": "statModified",
        "name": "",
        "value": profile.stats.attributes.allowed_to_receive_gifts
    });

    if (ApplyProfileChanges.length > 0) {
        profile.rvn += 1;
        profile.commandRevision += 1;
        profile.updated = new Date().toISOString();

        await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });
    }

    if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    res.json({
        profileRevision: profile.rvn || 0,
        profileId: req.query.profileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});

app.post("/fortnite/api/game/v2/profile/*/client/GiftCatalogEntry", verifyToken, async (req, res) => {
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    if (!await profileManager.validateProfile(req.query.profileId, profiles)) return error.createError(
        "errors.com.epicgames.modules.profiles.operation_forbidden",
        `Unable to find template configuration for profile ${req.query.profileId}`,
        [req.query.profileId], 12813, undefined, 403, res
    );

    let profile = profiles.profiles[req.query.profileId];

    if (req.query.profileId != "common_core") return error.createError(
        "errors.com.epicgames.modules.profiles.invalid_command",
        `GiftCatalogEntry is not valid on ${req.query.profileId} profile`,
        ["GiftCatalogEntry", req.query.profileId], 12801, undefined, 400, res
    );

    const memory = functions.GetVersionInfo(req);

    let Notifications = [];
    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
    let QueryRevision = req.query.rvn || -1;
    let validGiftBoxes = [
        "GiftBox:gb_default",
        "GiftBox:gb_giftwrap1",
        "GiftBox:gb_giftwrap2",
        "GiftBox:gb_giftwrap3"
    ];

    let missingFields = checkFields(["offerId", "receiverAccountIds", "giftWrapTemplateId"], req.body);

    if (missingFields.fields.length > 0) return error.createError(
        "errors.com.epicgames.validation.validation_failed",
        `Validation Failed. [${missingFields.fields.join(", ")}] field(s) is missing.`,
        [`[${missingFields.fields.join(", ")}]`], 1040, undefined, 400, res
    );

    if (typeof req.body.offerId != "string") return ValidationError("offerId", "a string", res);
    if (!Array.isArray(req.body.receiverAccountIds)) return ValidationError("receiverAccountIds", "an array", res);
    if (typeof req.body.giftWrapTemplateId != "string") return ValidationError("giftWrapTemplateId", "a string", res);
    if (typeof req.body.personalMessage != "string") return ValidationError("personalMessage", "a string", res);

    if (req.body.personalMessage.length > 100) return error.createError(
        "errors.com.epicgames.string.length_check",
        `The personalMessage you provided is longer than 100 characters, please make sure your personal message is less than 100 characters long and try again.`,
        undefined, 16027, undefined, 400, res
    );

    if (!validGiftBoxes.includes(req.body.giftWrapTemplateId)) return error.createError(
        "errors.com.epicgames.giftbox.invalid",
        `The giftbox you provided is invalid, please provide a valid giftbox and try again.`,
        undefined, 16027, undefined, 400, res
    );

    if (req.body.receiverAccountIds.length < 1 || req.body.receiverAccountIds.length > 5) return error.createError(
        "errors.com.epicgames.item.quantity.range_check",
        `You need to atleast gift to 1 person and can not gift to more than 5 people.`,
        undefined, 16027, undefined, 400, res
    );

    if (checkIfDuplicateExists(req.body.receiverAccountIds)) return error.createError(
        "errors.com.epicgames.array.duplicate_found",
        `There are duplicate accountIds in receiverAccountIds, please remove the duplicates and try again.`,
        undefined, 16027, undefined, 400, res
    );

    let sender = await Friends.findOne({ accountId: req.user.accountId }).lean();

    for (let receiverId of req.body.receiverAccountIds) {
        if (typeof receiverId != "string") return error.createError(
            "errors.com.epicgames.array.invalid_string",
            `There is a non-string object inside receiverAccountIds, please provide a valid value and try again.`,
            undefined, 16027, undefined, 400, res
        );

        if (!sender.list.accepted.find(i => i.accountId == receiverId) && receiverId != req.user.accountId) return error.createError(
            "errors.com.epicgames.friends.no_relationship",
            `User ${req.user.accountId} is not friends with ${receiverId}`,
            [req.user.accountId, receiverId], 28004, undefined, 403, res
        );
    }

    if (!profile.items) profile.items = {};

    let findOfferId = functions.getOfferID(req.body.offerId);
    if (!findOfferId) return error.createError(
        "errors.com.epicgames.fortnite.id_invalid",
        `Offer ID (id: '${req.body.offerId}') not found`,
        [req.body.offerId], 16027, undefined, 400, res
    );

    switch (true) {
        case /^BR(Daily|Weekly)Storefront$/.test(findOfferId.name):
            if (findOfferId.offerId.prices[0].currencyType.toLowerCase() == "mtxcurrency") {
                let paid = false;
                let price = (findOfferId.offerId.prices[0].finalPrice) * req.body.receiverAccountIds.length;

                for (let key in profile.items) {
                    if (!profile.items[key].templateId.toLowerCase().startsWith("currency:mtx")) continue;

                    let currencyPlatform = profile.items[key].attributes.platform;
                    if ((currencyPlatform.toLowerCase() != profile.stats.attributes.current_mtx_platform.toLowerCase()) && (currencyPlatform.toLowerCase() != "shared")) continue;

                    if (profile.items[key].quantity < price) return error.createError(
                        "errors.com.epicgames.currency.mtx.insufficient",
                        `You can not afford this item (${price}), you only have ${profile.items[key].quantity}.`,
                        [`${price}`, `${profile.items[key].quantity}`], 1040, undefined, 400, res
                    );

                    profile.items[key].quantity -= price;

                    ApplyProfileChanges.push({
                        "changeType": "itemQuantityChanged",
                        "itemId": key,
                        "quantity": profile.items[key].quantity
                    });

                    paid = true;

                    break;
                }

                if (!paid && price > 0) return error.createError(
                    "errors.com.epicgames.currency.mtx.insufficient",
                    `You can not afford this item.`,
                    [], 1040, undefined, 400, res
                );
            }

            for (let receiverId of req.body.receiverAccountIds) {
                const receiverProfiles = await Profile.findOne({ accountId: receiverId });
                let athena = receiverProfiles.profiles["athena"];
                let common_core = receiverProfiles.profiles["common_core"];

                if (!athena.items) athena.items = {};

                if (!common_core.stats.attributes.allowed_to_receive_gifts) return error.createError(
                    "errors.com.epicgames.user.gift_disabled",
                    `User ${receiverId} has disabled receiving gifts.`,
                    [receiverId], 28004, undefined, 403, res
                );

                for (let itemGrant of findOfferId.offerId.itemGrants) {
                    for (let itemId in athena.items) {
                        if (itemGrant.templateId.toLowerCase() == athena.items[itemId].templateId.toLowerCase()) return error.createError(
                            "errors.com.epicgames.modules.gamesubcatalog.purchase_not_allowed",
                            `User ${receiverId} already owns this item.`,
                            [receiverId], 28004, undefined, 403, res
                        );
                    }
                }
            }

            for (let receiverId of req.body.receiverAccountIds) {
                const receiverProfiles = await Profile.findOne({ accountId: receiverId });
                let athena = receiverProfiles.profiles["athena"];
                let common_core = ((receiverId == req.user.accountId) ? profile : receiverProfiles.profiles["common_core"]);

                let giftBoxItemID = functions.MakeID();
                let giftBoxItem = {
                    "templateId": req.body.giftWrapTemplateId,
                    "attributes": {
                        "fromAccountId": req.user.accountId,
                        "lootList": [],
                        "params": {
                            "userMessage": req.body.personalMessage
                        },
                        "level": 1,
                        "giftedOn": new Date().toISOString()
                    },
                    "quantity": 1
                };

                if (!athena.items) athena.items = {};
                if (!common_core.items) common_core.items = {};

                for (let value of findOfferId.offerId.itemGrants) {
                    const ID = functions.MakeID();

                    const Item = {
                        "templateId": value.templateId,
                        "attributes": {
                            "item_seen": false,
                            "variants": [],
                        },
                        "quantity": 1
                    };

                    athena.items[ID] = Item;

                    giftBoxItem.attributes.lootList.push({
                        "itemType": Item.templateId,
                        "itemGuid": ID,
                        "itemProfile": "athena",
                        "quantity": 1
                    });
                }

                common_core.items[giftBoxItemID] = giftBoxItem;

                if (receiverId == req.user.accountId) ApplyProfileChanges.push({
                    "changeType": "itemAdded",
                    "itemId": giftBoxItemID,
                    "item": common_core.items[giftBoxItemID]
                });

                athena.rvn += 1;
                athena.commandRevision += 1;
                athena.updated = new Date().toISOString();

                common_core.rvn += 1;
                common_core.commandRevision += 1;
                common_core.updated = new Date().toISOString();

                await receiverProfiles.updateOne({ $set: { [`profiles.athena`]: athena, [`profiles.common_core`]: common_core } });

                global.giftReceived[receiverId] = true;

                functions.sendXmppMessageToId({
                    type: "com.epicgames.gift.received",
                    payload: {},
                    timestamp: new Date().toISOString()
                }, receiverId);
            }
            break;
    }

    if (ApplyProfileChanges.length > 0 && !req.body.receiverAccountIds.includes(req.user.accountId)) {
        profile.rvn += 1;
        profile.commandRevision += 1;
        profile.updated = new Date().toISOString();

        await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });
    }

    if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    res.json({
        profileRevision: profile.rvn || 0,
        profileId: req.query.profileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        notifications: Notifications,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});

app.post("/fortnite/api/game/v2/profile/*/client/RemoveGiftBox", verifyToken, async (req, res) => {
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    if (!await profileManager.validateProfile(req.query.profileId, profiles)) return error.createError(
        "errors.com.epicgames.modules.profiles.operation_forbidden",
        `Unable to find template configuration for profile ${req.query.profileId}`,
        [req.query.profileId], 12813, undefined, 403, res
    );

    let profile = profiles.profiles[req.query.profileId];

    if (req.query.profileId != "common_core" && req.query.profileId != "profile0") return error.createError(
        "errors.com.epicgames.modules.profiles.invalid_command",
        `RemoveGiftBox is not valid on ${req.query.profileId} profile`,
        ["RemoveGiftBox", req.query.profileId], 12801, undefined, 400, res
    );

    const memory = functions.GetVersionInfo(req);

    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
    let QueryRevision = req.query.rvn || -1;

    if (typeof req.body.giftBoxItemId == "string") {
        if (!profile.items[req.body.giftBoxItemId]) return error.createError(
            "errors.com.epicgames.fortnite.id_invalid",
            `Item (id: '${req.body.giftBoxItemId}') not found`,
            [req.body.giftBoxItemId], 16027, undefined, 400, res
        );

        if (!profile.items[req.body.giftBoxItemId].templateId.startsWith("GiftBox:")) return error.createError(
            "errors.com.epicgames.fortnite.id_invalid",
            `The specified item id is not a giftbox.`,
            [req.body.giftBoxItemId], 16027, undefined, 400, res
        );

        delete profile.items[req.body.giftBoxItemId];

        ApplyProfileChanges.push({
            "changeType": "itemRemoved",
            "itemId": req.body.giftBoxItemId
        });
    }

    if (Array.isArray(req.body.giftBoxItemIds)) {
        for (let giftBoxItemId of req.body.giftBoxItemIds) {
            if (typeof giftBoxItemId != "string") continue;
            if (!profile.items[giftBoxItemId]) continue;
            if (!profile.items[giftBoxItemId].templateId.startsWith("GiftBox:")) continue;

            delete profile.items[giftBoxItemId];

            ApplyProfileChanges.push({
                "changeType": "itemRemoved",
                "itemId": giftBoxItemId
            });
        }
    }

    if (ApplyProfileChanges.length > 0) {
        profile.rvn += 1;
        profile.commandRevision += 1;
        profile.updated = new Date().toISOString();

        await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });
    }

    if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    res.json({
        profileRevision: profile.rvn || 0,
        profileId: req.query.profileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});


// BUYING ITEMS
app.post("/fortnite/api/game/v2/profile/*/client/PurchaseCatalogEntry", verifyToken, async (req, res) => {
    const user = await Profile.findOne({ accountId: req.params['0'] });
    if (!user) {
        console.log("player just not found");
        return res.status(500).json({});
    }
    const profile = user.profiles["common_core"];
    if (!profile) return res.status(500).json({});

    const profileAthena = user.profiles["athena"];
    if (!profileAthena) return res.status(500).json({});

    const athena = user.profiles["athena"];

    const accid = user.accountId;
    // do not change any of these or you will end up breaking it
    var ApplyProfileChanges = [];
    var MultiUpdate = [];
    var Notifications = [];
    var BaseRevision = profile.rvn || 0;
    var QueryRevision = req.query.rvn || -1;
    var ItemExists = false;
    var AthenaModified = false
    var bcanbuy = false;
    let btellclientgiftbox = false;

    const catalog = functions.processCatalogForToday();

    if (req.body.offerId && req.query.profileId) {
        catalog.storefronts.forEach(async (value, a) => {
            // Battle pass

            if (req.body.purchaseQuantity) {
                if (req.body.purchaseQuantity <= 0) {
                    return res.status(500).json({});
                }
            }

            if (value.name.startsWith("BR")) {
                catalog.storefronts[a].catalogEntries.forEach(function (value, b) {
                    if (value.offerId == req.body.offerId) {
                        // Vbucks spending
                        if (catalog.storefronts[a].catalogEntries[b].prices[0].currencyType.toLowerCase() == "mtxcurrency") {
                            for (var key in profile.items) {
                                if (profile.items[key].templateId.toLowerCase().startsWith("currency:mtx")) {
                                    if (profile.items[key].attributes.platform.toLowerCase() == profile.stats.attributes.current_mtx_platform.toLowerCase() || profile.items[key].attributes.platform.toLowerCase() == "shared") {


                                        var NumberPrice = Number((catalog.storefronts[a].catalogEntries[b].prices[0].finalPrice) * req.body.purchaseQuantity || 1);
                                        // console.log("price check reall --> " + NumberPrice);
                                        // console.log("my v-bucks" + profile.items[key].quantity);


                                        if (profile.items[key].quantity >= NumberPrice) {

                                            bcanbuy = true;
                                            // console.log(" i have v-bucks to buy v5");
                                            // VBUKS NICE 
                                        }
                                        else {
                                            //  res.json([]);
                                            //  res.end();
                                            bcanbuy = false;
                                            console.log("[-] Pas assez de v-bucks check v2");

                                            //    return res.status(500).json({});
                                        }

                                        profile.items[key].quantity -= NumberPrice;
                                        if (profile.items[key].quantity <= 0) {
                                            profile.items[key].quantity = 0;
                                        }


                                        ApplyProfileChanges.push({
                                            "changeType": "itemQuantityChanged",
                                            "itemId": key,
                                            "quantity": profile.items[key].quantity
                                        })

                                        break;
                                    }
                                }
                            }
                        }

                        catalog.storefronts[a].catalogEntries[b].itemGrants.forEach(function (value, c) {
                            const ID = value.templateId;

                            if (bcanbuy == true) {
                                for (var key in athena.items) {
                                    if (value.templateId.toLowerCase() == athena.items[key].templateId.toLowerCase()) {
                                        ItemExists = true;
                                    }
                                }

                                if (ItemExists == false) {
                                    if (MultiUpdate.length == 0) {
                                        MultiUpdate.push({
                                            "profileRevision": athena.rvn || 0,
                                            "profileId": "athena",
                                            "profileChangesBaseRevision": athena.rvn || 0,
                                            "profileChanges": [],
                                            "profileCommandRevision": athena.commandRevision || 0,
                                        })
                                    }

                                    if (Notifications.length == 0) {
                                        Notifications.push({
                                            "type": "CatalogPurchase",
                                            "primary": true,
                                            "lootResult": {
                                                "items": []
                                            }
                                        })
                                    }

                                    let vvariatnstest = [];
                                    if (vvariatnstest && vvariatnstest != undefined) {
                                        vvariatnstest = value.variants;
                                        console.log(vvariatnstest)
                                    }

                                    const Item = {
                                        "templateId": value.templateId,
                                        "attributes": {
                                            "max_level_bonus": 0,
                                            "level": 1,
                                            "item_seen": false,
                                            "xp": 0,
                                            "variants": vvariatnstest,
                                            "favorite": false
                                        },
                                        "quantity": 1
                                    };

                                    athena.items[ID] = Item;

                                    MultiUpdate[0].profileChanges.push({
                                        "changeType": "itemAdded",
                                        "itemId": ID,
                                        "item": Item
                                    })

                                    Notifications[0].lootResult.items.push({
                                        "itemType": value.templateId,
                                        "itemGuid": ID,
                                        "itemProfile": "athena",
                                        "quantity": value.quantity
                                    })

                                    AthenaModified = true;
                                }

                                ItemExists = false;
                            }
                        })


                        try {
                            if (Notifications[0] && Notifications[0].lootResult && Notifications[0].lootResult.items) {
                                if (catalog.storefronts[a].catalogEntries[b].itemGrants.length != 0) {
                                    // Add to refunding tab
                                    var purchaseId = functions.MakeID();
                                    profile.stats.attributes.mtx_purchase_history.purchases.push({ "purchaseId": purchaseId, "offerId": `v2:/${purchaseId}`, "purchaseDate": new Date().toISOString(), "freeRefundEligible": false, "fulfillments": [], "lootResult": Notifications[0].lootResult.items, "totalMtxPaid": catalog.storefronts[a].catalogEntries[b].prices[0].finalPrice, "metadata": {}, "gameContext": "" })

                                    ApplyProfileChanges.push({
                                        "changeType": "statModified",
                                        "name": "mtx_purchase_history",
                                        "value": profile.stats.attributes.mtx_purchase_history
                                    })
                                }
                            }
                        } catch (error) {
                            console.error(error);
                            return res.status(500).json({});
                        }
                        profile.rvn += 1;
                        profile.commandRevision += 1;


                    }

                })

            }

            // Battle pass
            if (value.name.startsWith("BRSeason")) {
                //console.log("pass de combat ici");
                if (!Number.isNaN(Number(value.name.split("BRSeason")[1]))) {
                    var offer = value.catalogEntries.find(i => i.offerId == req.body.offerId);


                    if (offer) {
                        if (MultiUpdate.length == 0) {
                            MultiUpdate.push({
                                "profileRevision": athena.rvn || 0,
                                "profileId": "athena",
                                "profileChangesBaseRevision": athena.rvn || 0,
                                "profileChanges": [],
                                "profileCommandRevision": athena.commandRevision || 0,
                            })
                        }

                        catalog.storefronts[a].catalogEntries.forEach(function (value, b) {
                            if (value.offerId == req.body.offerId) {
                                // Vbucks checking
                                if (catalog.storefronts[a].catalogEntries[b].prices[0].currencyType.toLowerCase() == "mtxcurrency") {
                                    for (var key in profile.items) {
                                        if (profile.items[key].templateId.toLowerCase().startsWith("currency:mtx")) {
                                            if (profile.items[key].attributes.platform.toLowerCase() == profile.stats.attributes.current_mtx_platform.toLowerCase() || profile.items[key].attributes.platform.toLowerCase() == "shared") {


                                                var NumberPrice = Number((catalog.storefronts[a].catalogEntries[b].prices[0].finalPrice) * req.body.purchaseQuantity || 1);
                                                //     console.log("price22 --> " + NumberPrice);
                                                //     console.log("my v-bucks322" + profile.items[key].quantity);


                                                if (profile.items[key].quantity >= NumberPrice) {
                                                    // console.log(" i have v-bucks to buy");
                                                    //  bcanbuy = true;
                                                }
                                                else {
                                                    //  res.json([]);
                                                    //  res.end();
                                                    //  console.log("[-] Pas assez de v-bucks Check - Battle pass");
                                                    //  bcanbuy = false;
                                                }


                                                if (profile.items[key].quantity <= -1) {
                                                    //  bcanbuy = false;
                                                }

                                                break;

                                            }
                                        }
                                    }
                                }
                            }
                        })


                        var Season = value.name.split("BR")[1];
                        var SeasonNumber = Season.replace("Season", "");


                        let purchased_bp_offers = profileAthena.stats.attributes.purchased_bp_offers;
                        if (!purchased_bp_offers) {
                            profileAthena.stats.attributes.purchased_bp_offers = [];
                            purchased_bp_offers = profileAthena.stats.attributes.purchased_bp_offers;
                        }
                        let FoundSeason = purchased_bp_offers.find(
                            seasoninfo => seasoninfo.season && seasoninfo.season == Season
                        );
                        if (!FoundSeason) {
                            let SeasonGuy = {
                                "season": Season,
                                "season_num": Number(SeasonNumber) || 0,
                                "battlePassPurchased": false,
                                "battlePassTier": 1,
                                "battlePassXPBoost": 0,
                                "battlePassXPFriendBoost": 0
                            };
                            purchased_bp_offers.push(SeasonGuy);
                            FoundSeason = SeasonGuy;
                        }


                        const key_json = `BattlePass${Season}`;
                        let BattlePass = cacheGet(key_json);
                        if (BattlePass) {
                            BattlePass = BattlePass.body;
                        } else {
                            BattlePass = require(`./../responses/BattlePass/${Season}.json`);
                            cacheSet(key_json, { status: 200, body: BattlePass }, 1800);
                        }


                        //  var BattlePass = require(`./../responses/BattlePass/${Season}.json`);

                        //  console.log("hedssssssssllo " + Season);

                        if (BattlePass && bcanbuy) {
                            /*
                                                        var NameFile = "./BattlePassManagers/SeasonData_" + user.accountId + ".json";
                                                        var NameFile1 = "../BattlePassManagers/SeasonData_" + user.accountId + ".json";
                            
                                                        //    console.log("lmao!!!")
                            
                                                        try {
                            
                            
                            
                            
                                                            if (!fs.existsSync(path.resolve(__dirname, NameFile1))) {
                            
                            
                            
                                                                fs1.copySync(path.resolve(__dirname, '../BattlePassManagers/SeasonDataOriginale.json'), NameFile);
                            
                                                            }
                                                        } catch (err) {
                                                            console.error(err);
                            
                                                            return res.status(500).json({});
                                                        }*/

                            let SeasonData = FoundSeason;
                            //   var SeasonData = require(NameFile1);
                            // var SeasonData = require("./../responses/SeasonData.json");

                            if (BattlePass.battlePassOfferId == offer.offerId || BattlePass.battleBundleOfferId == offer.offerId) {
                                //  ::   console.log("bundle idk 1");
                                var lootList = [];
                                var EndingTier = SeasonData.battlePassTier;
                                SeasonData.battlePassPurchased = true;

                                if (BattlePass.battleBundleOfferId == offer.offerId) {
                                    //   console.log("bundle idk  == nezgros " + offer.offerId);

                                    SeasonData.battlePassTier += 25;
                                    if (SeasonData.battlePassTier > 100) SeasonData.battlePassTier = 100;
                                    EndingTier = SeasonData.battlePassTier;
                                }
                                else {
                                    //           console.log("non donc corrige : " + offer.offerId);

                                }

                                //                console.log("bundle idk 2");

                                for (var i = 0; i < EndingTier; i++) {
                                    var FreeTier = BattlePass.freeRewards[i] || {};
                                    var PaidTier = BattlePass.paidRewards[i] || {};

                                    for (var item in FreeTier) {
                                        //       console.log("FreeItem == " + item);
                                        if (item.toLowerCase() == "token:athenaseasonxpboost") {
                                            SeasonData.battlePassXPBoost += FreeTier[item];

                                            MultiUpdate[0].profileChanges.push({
                                                "changeType": "statModified",
                                                "name": "season_match_boost",
                                                "value": SeasonData.battlePassXPBoost
                                            })
                                        }

                                        if (item.toLowerCase() == "token:athenaseasonfriendxpboost") {
                                            SeasonData.battlePassXPFriendBoost += FreeTier[item];

                                            MultiUpdate[0].profileChanges.push({
                                                "changeType": "statModified",
                                                "name": "season_friend_match_boost",
                                                "value": SeasonData.battlePassXPFriendBoost
                                            })
                                        }

                                        if (item.toLowerCase().startsWith("currency:mtx")) {
                                            for (var key in profile.items) {
                                                if (profile.items[key].templateId.toLowerCase().startsWith("currency:mtx")) {
                                                    if (profile.items[key].attributes.platform.toLowerCase() == profile.stats.attributes.current_mtx_platform.toLowerCase() || profile.items[key].attributes.platform.toLowerCase() == "shared") {
                                                        profile.items[key].quantity += FreeTier[item];
                                                        break;
                                                    }
                                                }
                                            }
                                        }

                                        if (item.toLowerCase().startsWith("homebasebanner")) {
                                            for (var key in profile.items) {
                                                if (profile.items[key].templateId.toLowerCase() == item.toLowerCase()) {
                                                    profile.items[key].attributes.item_seen = false;
                                                    ItemExists = true;

                                                    ApplyProfileChanges.push({
                                                        "changeType": "itemAttrChanged",
                                                        "itemId": key,
                                                        "attributeName": "item_seen",
                                                        "attributeValue": profile.items[key].attributes.item_seen
                                                    })
                                                }
                                            }

                                            if (ItemExists == false) {
                                                var ItemID = item;
                                                var Item = { "templateId": item, "attributes": { "item_seen": false }, "quantity": 1 };

                                                profile.items[ItemID] = Item;

                                                ApplyProfileChanges.push({
                                                    "changeType": "itemAdded",
                                                    "itemId": ItemID,
                                                    "item": Item
                                                })
                                            }

                                            ItemExists = false;
                                        }

                                        if (item.toLowerCase().startsWith("athena")) {
                                            for (var key in athena.items) {
                                                if (athena.items[key].templateId.toLowerCase() == item.toLowerCase()) {
                                                    athena.items[key].attributes.item_seen = false;
                                                    ItemExists = true;

                                                    MultiUpdate[0].profileChanges.push({
                                                        "changeType": "itemAttrChanged",
                                                        "itemId": key,
                                                        "attributeName": "item_seen",
                                                        "attributeValue": athena.items[key].attributes.item_seen
                                                    })
                                                }
                                            }

                                            if (ItemExists == false) {
                                                let ItemName = item;
                                                var ItemID = item;

                                                var Item = { "templateId": item, "attributes": { "max_level_bonus": 0, "level": 1, "item_seen": false, "xp": 0, "variants": [], "favorite": false }, "quantity": FreeTier[item] }

                                                if (ItemName.toLowerCase() == "athenacharacter:cid_408_athena_commando_f_strawberrypilot") {
                                                    Item.attributes.variants = [
                                                        {
                                                            "channel": "Progressive",
                                                            "active": "Stage1",
                                                            "owned": [
                                                                "Stage1",
                                                                "Stage2",
                                                                "Stage3",
                                                                "Stage4",
                                                                "Stage5"
                                                            ]
                                                        },
                                                        {
                                                            "channel": "Material",
                                                            "active": "Mat1",
                                                            "owned": [
                                                                "Mat1",
                                                                "Mat2",
                                                                "Mat3",
                                                                "Mat4"
                                                            ]
                                                        },
                                                        {
                                                            "channel": "Particle",
                                                            "active": "Particle1",
                                                            "owned": [
                                                                "Particle1",
                                                                "Particle2",
                                                                "Particle3",
                                                                "Particle4"
                                                            ]
                                                        }]
                                                }
                                                else if (ItemName.toLowerCase() == "athenacharacter:character_vitalpsych") {
                                                    Item.attributes.variants = [
                                                        {
                                                            "channel": "Parts",
                                                            "active": "Stage1",
                                                            "owned": [
                                                                "Stage1",
                                                                "Stage2",
                                                                "Stage3",
                                                                "Stage4",
                                                                "Stage5"
                                                            ]
                                                        }]
                                                }

                                                athena.items[ItemID] = Item;

                                                MultiUpdate[0].profileChanges.push({
                                                    "changeType": "itemAdded",
                                                    "itemId": ItemID,
                                                    "item": Item
                                                })
                                            }

                                            ItemExists = false;
                                        }

                                        lootList.push({
                                            "itemType": item,
                                            "itemGuid": item,
                                            "quantity": FreeTier[item]
                                        })
                                    }

                                    for (var item in PaidTier) {
                                        //   console.log("PaidTier == " + item);

                                        if (item.toLowerCase() == "token:athenaseasonxpboost") {
                                            SeasonData.battlePassXPBoost += PaidTier[item];

                                            MultiUpdate[0].profileChanges.push({
                                                "changeType": "statModified",
                                                "name": "season_match_boost",
                                                "value": SeasonData.battlePassXPBoost
                                            })
                                        }

                                        if (item.toLowerCase() == "token:athenaseasonfriendxpboost") {
                                            SeasonData.battlePassXPFriendBoost += PaidTier[item];

                                            MultiUpdate[0].profileChanges.push({
                                                "changeType": "statModified",
                                                "name": "season_friend_match_boost",
                                                "value": SeasonData.battlePassXPFriendBoost
                                            })
                                        }

                                        if (item.toLowerCase().startsWith("currency:mtx")) {
                                            for (var key in profile.items) {
                                                if (profile.items[key].templateId.toLowerCase().startsWith("currency:mtx")) {
                                                    if (profile.items[key].attributes.platform.toLowerCase() == profile.stats.attributes.current_mtx_platform.toLowerCase() || profile.items[key].attributes.platform.toLowerCase() == "shared") {
                                                        profile.items[key].quantity += PaidTier[item];
                                                        break;
                                                    }
                                                }
                                            }
                                        }

                                        if (item.toLowerCase().startsWith("homebasebanner")) {
                                            for (var key in profile.items) {
                                                if (profile.items[key].templateId.toLowerCase() == item.toLowerCase()) {
                                                    profile.items[key].attributes.item_seen = false;
                                                    ItemExists = true;

                                                    ApplyProfileChanges.push({
                                                        "changeType": "itemAttrChanged",
                                                        "itemId": key,
                                                        "attributeName": "item_seen",
                                                        "attributeValue": profile.items[key].attributes.item_seen
                                                    })
                                                }
                                            }

                                            if (ItemExists == false) {
                                                var ItemID = item;
                                                var Item = { "templateId": item, "attributes": { "item_seen": false }, "quantity": 1 };

                                                profile.items[ItemID] = Item;

                                                ApplyProfileChanges.push({
                                                    "changeType": "itemAdded",
                                                    "itemId": ItemID,
                                                    "item": Item
                                                })
                                            }

                                            ItemExists = false;
                                        }

                                        if (item.toLowerCase().startsWith("athena")) {
                                            for (var key in athena.items) {
                                                if (athena.items[key].templateId.toLowerCase() == item.toLowerCase()) {
                                                    athena.items[key].attributes.item_seen = false;
                                                    ItemExists = true;

                                                    MultiUpdate[0].profileChanges.push({
                                                        "changeType": "itemAttrChanged",
                                                        "itemId": key,
                                                        "attributeName": "item_seen",
                                                        "attributeValue": athena.items[key].attributes.item_seen
                                                    })
                                                }
                                            }

                                            if (ItemExists == false) {
                                                let ItemName = item;
                                                var ItemID = item;

                                                var Item = { "templateId": item, "attributes": { "max_level_bonus": 0, "level": 1, "item_seen": false, "xp": 0, "variants": [], "favorite": false }, "quantity": PaidTier[item] }

                                                if (ItemName.toLowerCase() == "athenacharacter:cid_408_athena_commando_f_strawberrypilot") {
                                                    Item.attributes.variants = [
                                                        {
                                                            "channel": "Progressive",
                                                            "active": "Stage1",
                                                            "owned": [
                                                                "Stage1",
                                                                "Stage2",
                                                                "Stage3",
                                                                "Stage4",
                                                                "Stage5"
                                                            ]
                                                        },
                                                        {
                                                            "channel": "Material",
                                                            "active": "Mat1",
                                                            "owned": [
                                                                "Mat1",
                                                                "Mat2",
                                                                "Mat3",
                                                                "Mat4"
                                                            ]
                                                        },
                                                        {
                                                            "channel": "Particle",
                                                            "active": "Particle1",
                                                            "owned": [
                                                                "Particle1",
                                                                "Particle2",
                                                                "Particle3",
                                                                "Particle4"
                                                            ]
                                                        }]
                                                }
                                                else if (ItemName.toLowerCase() == "athenacharacter:character_vitalpsych") {
                                                    Item.attributes.variants = [
                                                        {
                                                            "channel": "Parts",
                                                            "active": "Stage1",
                                                            "owned": [
                                                                "Stage1",
                                                                "Stage2",
                                                                "Stage3",
                                                                "Stage4",
                                                                "Stage5"
                                                            ]
                                                        }]
                                                }


                                                athena.items[ItemID] = Item;

                                                MultiUpdate[0].profileChanges.push({
                                                    "changeType": "itemAdded",
                                                    "itemId": ItemID,
                                                    "item": Item
                                                })
                                            }

                                            ItemExists = false;
                                        }

                                        lootList.push({
                                            "itemType": item,
                                            "itemGuid": item,
                                            "quantity": PaidTier[item]
                                        })
                                    }
                                }

                                var GiftBoxID = functions.MakeID();
                                var GiftBox = { "templateId": Number(Season.split("Season")[1]) <= 4 ? "GiftBox:gb_battlepass" : "GiftBox:gb_battlepasspurchased", "attributes": { "max_level_bonus": 0, "fromAccountId": "", "lootList": lootList } }

                                if (Number(Season.split("Season")[1]) > 2) {
                                    profile.items[GiftBoxID] = GiftBox;
                                    btellclientgiftbox = true;

                                    ApplyProfileChanges.push({
                                        "changeType": "itemAdded",
                                        "itemId": GiftBoxID,
                                        "item": GiftBox
                                    })
                                }

                                MultiUpdate[0].profileChanges.push({
                                    "changeType": "statModified",
                                    "name": "book_purchased",
                                    "value": SeasonData.battlePassPurchased
                                })

                                MultiUpdate[0].profileChanges.push({
                                    "changeType": "statModified",
                                    "name": "book_level",
                                    "value": SeasonData.battlePassTier
                                })

                                AthenaModified = true;
                            }

                            if (BattlePass.tierOfferId == offer.offerId) {
                                var lootList = [];
                                var StartingTier = SeasonData.battlePassTier;
                                var EndingTier;
                                SeasonData.battlePassTier += req.body.purchaseQuantity || 1;
                                EndingTier = SeasonData.battlePassTier;

                                for (var i = StartingTier; i < EndingTier; i++) {
                                    var FreeTier = BattlePass.freeRewards[i] || {};
                                    var PaidTier = BattlePass.paidRewards[i] || {};

                                    for (var item in FreeTier) {
                                        //                         console.log("FreeTier2 == " + item);

                                        if (item.toLowerCase() == "token:athenaseasonxpboost") {
                                            SeasonData.battlePassXPBoost += FreeTier[item];

                                            MultiUpdate[0].profileChanges.push({
                                                "changeType": "statModified",
                                                "name": "season_match_boost",
                                                "value": SeasonData.battlePassXPBoost
                                            })
                                        }

                                        if (item.toLowerCase() == "token:athenaseasonfriendxpboost") {
                                            SeasonData.battlePassXPFriendBoost += FreeTier[item];

                                            MultiUpdate[0].profileChanges.push({
                                                "changeType": "statModified",
                                                "name": "season_friend_match_boost",
                                                "value": SeasonData.battlePassXPFriendBoost
                                            })
                                        }

                                        if (item.toLowerCase().startsWith("currency:mtx")) {
                                            for (var key in profile.items) {
                                                if (profile.items[key].templateId.toLowerCase().startsWith("currency:mtx")) {
                                                    if (profile.items[key].attributes.platform.toLowerCase() == profile.stats.attributes.current_mtx_platform.toLowerCase() || profile.items[key].attributes.platform.toLowerCase() == "shared") {
                                                        profile.items[key].quantity += FreeTier[item];
                                                        break;
                                                    }
                                                }
                                            }
                                        }

                                        if (item.toLowerCase().startsWith("homebasebanner")) {
                                            for (var key in profile.items) {
                                                if (profile.items[key].templateId.toLowerCase() == item.toLowerCase()) {
                                                    profile.items[key].attributes.item_seen = false;
                                                    ItemExists = true;

                                                    ApplyProfileChanges.push({
                                                        "changeType": "itemAttrChanged",
                                                        "itemId": key,
                                                        "attributeName": "item_seen",
                                                        "attributeValue": profile.items[key].attributes.item_seen
                                                    })
                                                }
                                            }

                                            if (ItemExists == false) {
                                                var ItemID = item;
                                                var Item = { "templateId": item, "attributes": { "item_seen": false }, "quantity": 1 };

                                                profile.items[ItemID] = Item;

                                                ApplyProfileChanges.push({
                                                    "changeType": "itemAdded",
                                                    "itemId": ItemID,
                                                    "item": Item
                                                })
                                            }

                                            ItemExists = false;
                                        }

                                        if (item.toLowerCase().startsWith("athena")) {
                                            for (var key in athena.items) {
                                                if (athena.items[key].templateId.toLowerCase() == item.toLowerCase()) {
                                                    athena.items[key].attributes.item_seen = false;
                                                    ItemExists = true;

                                                    MultiUpdate[0].profileChanges.push({
                                                        "changeType": "itemAttrChanged",
                                                        "itemId": key,
                                                        "attributeName": "item_seen",
                                                        "attributeValue": athena.items[key].attributes.item_seen
                                                    })
                                                }
                                            }

                                            if (ItemExists == false) {
                                                let ItemName = item;
                                                var ItemID = item;
                                                //         console.log("called  !!!");

                                                var Item = { "templateId": item, "attributes": { "max_level_bonus": 0, "level": 1, "item_seen": false, "xp": 0, "variants": [], "favorite": false }, "quantity": FreeTier[item] }

                                                if (ItemName.toLowerCase() == "athenacharacter:cid_408_athena_commando_f_strawberrypilot") {
                                                    Item.attributes.variants = [
                                                        {
                                                            "channel": "Progressive",
                                                            "active": "Stage1",
                                                            "owned": [
                                                                "Stage1",
                                                                "Stage2",
                                                                "Stage3",
                                                                "Stage4",
                                                                "Stage5"
                                                            ]
                                                        },
                                                        {
                                                            "channel": "Material",
                                                            "active": "Mat1",
                                                            "owned": [
                                                                "Mat1",
                                                                "Mat2",
                                                                "Mat3",
                                                                "Mat4"
                                                            ]
                                                        },
                                                        {
                                                            "channel": "Particle",
                                                            "active": "Particle1",
                                                            "owned": [
                                                                "Particle1",
                                                                "Particle2",
                                                                "Particle3",
                                                                "Particle4"
                                                            ]
                                                        }]
                                                }
                                                else if (ItemName.toLowerCase() == "athenacharacter:character_vitalpsych") {
                                                    console.log("called2322 !!!");

                                                    Item.attributes.variants = [
                                                        {
                                                            "channel": "Parts",
                                                            "active": "Stage1",
                                                            "owned": [
                                                                "Stage1",
                                                                "Stage2",
                                                                "Stage3",
                                                                "Stage4",
                                                                "Stage5"
                                                            ]
                                                        }]
                                                }

                                                //    var ItemID = functions.MakeID();
                                                //   var Item = { "templateId": item, "attributes": { "max_level_bonus": 0, "level": 1, "item_seen": false, "xp": 0, "variants": [], "favorite": false }, "quantity": FreeTier[item] }

                                                athena.items[ItemID] = Item;

                                                MultiUpdate[0].profileChanges.push({
                                                    "changeType": "itemAdded",
                                                    "itemId": ItemID,
                                                    "item": Item
                                                })
                                            }

                                            ItemExists = false;
                                        }

                                        lootList.push({
                                            "itemType": item,
                                            "itemGuid": item,
                                            "quantity": FreeTier[item]
                                        })
                                    }

                                    for (var item in PaidTier) {
                                        //      console.log("PaidTier2 == " + item);

                                        if (item.toLowerCase() == "token:athenaseasonxpboost") {
                                            SeasonData.battlePassXPBoost += PaidTier[item];

                                            MultiUpdate[0].profileChanges.push({
                                                "changeType": "statModified",
                                                "name": "season_match_boost",
                                                "value": SeasonData.battlePassXPBoost
                                            })
                                        }

                                        if (item.toLowerCase() == "token:athenaseasonfriendxpboost") {
                                            SeasonData.battlePassXPFriendBoost += PaidTier[item];

                                            MultiUpdate[0].profileChanges.push({
                                                "changeType": "statModified",
                                                "name": "season_friend_match_boost",
                                                "value": SeasonData.battlePassXPFriendBoost
                                            })
                                        }

                                        if (item.toLowerCase().startsWith("currency:mtx")) {
                                            for (var key in profile.items) {
                                                if (profile.items[key].templateId.toLowerCase().startsWith("currency:mtx")) {
                                                    if (profile.items[key].attributes.platform.toLowerCase() == profile.stats.attributes.current_mtx_platform.toLowerCase() || profile.items[key].attributes.platform.toLowerCase() == "shared") {
                                                        profile.items[key].quantity += PaidTier[item];
                                                        break;
                                                    }
                                                }
                                            }
                                        }


                                        if (item == "CosmeticVariantToken:vtid_202_rooster_styleb") {
                                            for (var key in athena.items) {
                                                if (athena.items[key].templateId == "AthenaCharacter:cid_403_athena_commando_m_rooster") {
                                                    console.log("added 111111111 !");
                                                    athena.items[key].attributes.variants = [
                                                        {
                                                            "channel": "Parts",
                                                            "active": "Stage1",
                                                            "owned": [
                                                                "Stage1",
                                                                "Stage2"
                                                            ]
                                                        }]


                                                    MultiUpdate[0].profileChanges.push({
                                                        "changeType": "itemAttrChanged",
                                                        "itemId": key,
                                                        "attributeName": "variants",
                                                        "attributeValue": athena.items[key].attributes.variants
                                                    });



                                                    console.log("added done !");

                                                }
                                            }
                                        }

                                        if (item.toLowerCase().startsWith("homebasebanner")) {
                                            for (var key in profile.items) {
                                                if (profile.items[key].templateId.toLowerCase() == item.toLowerCase()) {
                                                    profile.items[key].attributes.item_seen = false;
                                                    ItemExists = true;

                                                    ApplyProfileChanges.push({
                                                        "changeType": "itemAttrChanged",
                                                        "itemId": key,
                                                        "attributeName": "item_seen",
                                                        "attributeValue": profile.items[key].attributes.item_seen
                                                    })
                                                }
                                            }

                                            if (ItemExists == false) {
                                                var ItemID = item;
                                                var Item = { "templateId": item, "attributes": { "item_seen": false }, "quantity": 1 };

                                                profile.items[ItemID] = Item;

                                                ApplyProfileChanges.push({
                                                    "changeType": "itemAdded",
                                                    "itemId": ItemID,
                                                    "item": Item
                                                })
                                            }

                                            ItemExists = false;
                                        }

                                        if (item.toLowerCase().startsWith("athena")) {
                                            for (var key in athena.items) {
                                                if (athena.items[key].templateId.toLowerCase() == item.toLowerCase()) {
                                                    athena.items[key].attributes.item_seen = false;
                                                    ItemExists = true;

                                                    MultiUpdate[0].profileChanges.push({
                                                        "changeType": "itemAttrChanged",
                                                        "itemId": key,
                                                        "attributeName": "item_seen",
                                                        "attributeValue": athena.items[key].attributes.item_seen
                                                    })
                                                }
                                            }

                                            if (ItemExists == false) {
                                                var ItemID = item;
                                                var Item = { "templateId": item, "attributes": { "max_level_bonus": 0, "level": 1, "item_seen": false, "xp": 0, "variants": [], "favorite": false }, "quantity": PaidTier[item] }

                                                athena.items[ItemID] = Item;

                                                MultiUpdate[0].profileChanges.push({
                                                    "changeType": "itemAdded",
                                                    "itemId": ItemID,
                                                    "item": Item
                                                })
                                            }

                                            ItemExists = false;
                                        }

                                        lootList.push({
                                            "itemType": item,
                                            "itemGuid": item,
                                            "quantity": PaidTier[item]
                                        })
                                    }
                                }

                                var GiftBoxID = functions.MakeID();
                                var GiftBox = { "templateId": "GiftBox:gb_battlepass", "attributes": { "max_level_bonus": 0, "fromAccountId": "", "lootList": lootList } }

                                if (Number(Season.split("Season")[1]) > 2) {
                                    profile.items[GiftBoxID] = GiftBox;
                                    btellclientgiftbox = true;
                                    ApplyProfileChanges.push({
                                        "changeType": "itemAdded",
                                        "itemId": GiftBoxID,
                                        "item": GiftBox
                                    })
                                }

                                MultiUpdate[0].profileChanges.push({
                                    "changeType": "statModified",
                                    "name": "book_level",
                                    "value": SeasonData.battlePassTier
                                })

                                AthenaModified = true;
                            }


                            profileAthena.stats.attributes.season_num = Number(SeasonNumber);
                            profileAthena.stats.attributes.book_level = SeasonData.battlePassTier;
                            profileAthena.stats.attributes.book_purchased = SeasonData.battlePassPurchased;
                            profileAthena.stats.attributes.season_match_boost = SeasonData.battlePassXPBoost;
                            profileAthena.stats.attributes.season_friend_match_boost = SeasonData.battlePassXPFriendBoost;

                            /*
                                                        try {
                            
                                                            if (fs.existsSync(path.resolve(__dirname, NameFile1))) {
                                                                // CHAPTER 2
                                                             
                            
                                                                fs.writeFileSync(NameFile, JSON.stringify(SeasonData, null, 2));
                                                            }
                                                        } catch (err) {
                                                            console.error(err);
                                                            return;
                                                        }
                            */
                            //       fs.writeFileSync("./responses/SeasonData.json", JSON.stringify(SeasonData, null, 2));
                        }
                    }
                }
            }
        })
    }








    if (AthenaModified == true) {
        profileAthena.rvn += 1;
        profileAthena.commandRevision += 1;

        if (MultiUpdate[0]) {
            MultiUpdate[0].profileRevision = profileAthena.rvn || 0;
            MultiUpdate[0].profileCommandRevision = profileAthena.commandRevision || 0;
        }

        await user.updateOne({ $set: { "profiles.athena": profileAthena } });
        await user.updateOne({ $set: { "profiles.common_core": profile } });
    }

    if (AthenaModified == false) {
        profile.rvn += 1;
        profile.commandRevision += 1;

        await user.updateOne({ $set: { "profiles.common_core": profile } });
    }

    if (QueryRevision != BaseRevision) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    if (btellclientgiftbox) {
        functions.sendXmppMessageToId({
            type: "com.epicgames.gift.received",
            payload: {},
            timestamp: new Date().toISOString()
        }, accid);
    }

    res.status(200).json({
        "profileRevision": profile.rvn || 0,
        "profileId": req.query.profileId || "profile0",
        "profileChangesBaseRevision": BaseRevision,
        "profileChanges": ApplyProfileChanges,
        "notifications": Notifications,
        "profileCommandRevision": 0,
        "serverTime": new Date().toISOString(),
        "multiUpdate": MultiUpdate,
        "responseVersion": 1
    })
    res.end();
});


//app.post("/fortnite/api/game/v2/profile/*/client/PurchaseCatalogEntry", verifyToken, async (req, res) => {
/*

  const profiles = await Profile.findOne({ accountId: req.user.accountId });

  if (!await profileManager.validateProfile(req.query.profileId, profiles)) return error.createError(
      "errors.com.epicgames.modules.profiles.operation_forbidden",
      `Unable to find template configuration for profile ${req.query.profileId}`,
      [req.query.profileId], 12813, undefined, 403, res
  );

  let profile = profiles.profiles[req.query.profileId];
  let athena = profiles.profiles["athena"];

  if (req.query.profileId != "common_core" && req.query.profileId != "profile0") return error.createError(
      "errors.com.epicgames.modules.profiles.invalid_command",
      `PurchaseCatalogEntry is not valid on ${req.query.profileId} profile`,
      ["PurchaseCatalogEntry", req.query.profileId], 12801, undefined, 400, res
  );

  let MultiUpdate = [{
      "profileRevision": athena.rvn || 0,
      "profileId": "athena",
      "profileChangesBaseRevision": athena.rvn || 0,
      "profileChanges": [],
      "profileCommandRevision": athena.commandRevision || 0,
  }];

  const memory = functions.GetVersionInfo(req);

  let Notifications = [];
  let ApplyProfileChanges = [];
  let BaseRevision = profile.rvn;
  let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
  let QueryRevision = req.query.rvn || -1;

  let missingFields = checkFields(["offerId"], req.body);

  if (missingFields.fields.length > 0) return error.createError(
      "errors.com.epicgames.validation.validation_failed",
      `Validation Failed. [${missingFields.fields.join(", ")}] field(s) is missing.`,
      [`[${missingFields.fields.join(", ")}]`], 1040, undefined, 400, res
  );

  if (typeof req.body.offerId != "string") return ValidationError("offerId", "a string", res);
  if (typeof req.body.purchaseQuantity != "number") return ValidationError("purchaseQuantity", "a number", res);
  if (req.body.purchaseQuantity < 1) return error.createError(
      "errors.com.epicgames.validation.validation_failed",
      `Validation Failed. 'purchaseQuantity' is less than 1.`,
      ['purchaseQuantity'], 1040, undefined, 400, res
  );

  if (!profile.items) profile.items = {};
  if (!athena.items) athena.items = {};

  let findOfferId = functions.getOfferID(req.body.offerId);
  if (!findOfferId) return error.createError(
      "errors.com.epicgames.fortnite.id_invalid",
      `Offer ID (id: '${req.body.offerId}') not found`,
      [req.body.offerId], 16027, undefined, 400, res
  );

  switch (true) {
      case /^BR(Daily|Weekly|Season)Storefront$/.test(findOfferId.name):
          Notifications.push({
              "type": "CatalogPurchase",
              "primary": true,
              "lootResult": {
                  "items": []
              }
          });

          for (let value of findOfferId.offerId.itemGrants) {
              const ID = value.templateId;

              for (let itemId in athena.items) {
                  if (value.templateId.toLowerCase() == athena.items[itemId].templateId.toLowerCase()) return error.createError(
                      "errors.com.epicgames.offer.already_owned",
                      `You have already bought this item before.`,
                      undefined, 1040, undefined, 400, res
                  );
              }

              const Item = {
                  "templateId": value.templateId,
                  "attributes": {
                      "item_seen": false,
                      "variants": [],
                  },
                  "quantity": 1
              };

              athena.items[ID] = Item;

              MultiUpdate[0].profileChanges.push({
                  "changeType": "itemAdded",
                  "itemId": ID,
                  "item": athena.items[ID]
              });

              Notifications[0].lootResult.items.push({
                  "itemType": Item.templateId,
                  "itemGuid": ID,
                  "itemProfile": "athena",
                  "quantity": 1
              });
          }

          if (findOfferId.offerId.prices[0].currencyType.toLowerCase() == "mtxcurrency") {
              let paid = false;

              for (let key in profile.items) {
                  if (!profile.items[key].templateId.toLowerCase().startsWith("currency:mtx")) continue;

                  let currencyPlatform = profile.items[key].attributes.platform;
                  if ((currencyPlatform.toLowerCase() != profile.stats.attributes.current_mtx_platform.toLowerCase()) && (currencyPlatform.toLowerCase() != "shared")) continue;

                  if (profile.items[key].quantity < findOfferId.offerId.prices[0].finalPrice) return error.createError(
                      "errors.com.epicgames.currency.mtx.insufficient",
                      `You can not afford this item (${findOfferId.offerId.prices[0].finalPrice}), you only have ${profile.items[key].quantity}.`,
                      [`${findOfferId.offerId.prices[0].finalPrice}`, `${profile.items[key].quantity}`], 1040, undefined, 400, res
                  );

                  profile.items[key].quantity -= findOfferId.offerId.prices[0].finalPrice;

                  ApplyProfileChanges.push({
                      "changeType": "itemQuantityChanged",
                      "itemId": key,
                      "quantity": profile.items[key].quantity
                  });

                  paid = true;

                  break;
              }

              if (!paid && findOfferId.offerId.prices[0].finalPrice > 0) return error.createError(
                  "errors.com.epicgames.currency.mtx.insufficient",
                  `You can not afford this item (${findOfferId.offerId.prices[0].finalPrice}).`,
                  [`${findOfferId.offerId.prices[0].finalPrice}`], 1040, undefined, 400, res
              );
          }

          if (MultiUpdate[0].profileChanges.length > 0) {
              athena.rvn += 1;
              athena.commandRevision += 1;
              athena.updated = new Date().toISOString();

              MultiUpdate[0].profileRevision = athena.rvn;
              MultiUpdate[0].profileCommandRevision = athena.commandRevision;
          }
          break;
  }

  if (ApplyProfileChanges.length > 0) {
      profile.rvn += 1;
      profile.commandRevision += 1;
      profile.updated = new Date().toISOString();

      await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile, [`profiles.athena`]: athena } });
  }

  if (QueryRevision != ProfileRevisionCheck) {
      ApplyProfileChanges = [{
          "changeType": "fullProfileUpdate",
          "profile": profile
      }];
  }

  res.json({
      profileRevision: profile.rvn || 0,
      profileId: req.query.profileId,
      profileChangesBaseRevision: BaseRevision,
      profileChanges: ApplyProfileChanges,
      notifications: Notifications,
      profileCommandRevision: profile.commandRevision || 0,
      serverTime: new Date().toISOString(),
      multiUpdate: MultiUpdate,
      responseVersion: 1
  });
});
*/
app.post("/fortnite/api/game/v2/profile/*/client/MarkItemSeen", verifyToken, async (req, res) => {
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    if (!await profileManager.validateProfile(req.query.profileId, profiles)) return error.createError(
        "errors.com.epicgames.modules.profiles.operation_forbidden",
        `Unable to find template configuration for profile ${req.query.profileId}`,
        [req.query.profileId], 12813, undefined, 403, res
    );

    let profile = profiles.profiles[req.query.profileId];

    const memory = functions.GetVersionInfo(req);

    if (req.query.profileId == "athena") profile.stats.attributes.season_num = memory.season;

    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
    let QueryRevision = req.query.rvn || -1;

    let missingFields = checkFields(["itemIds"], req.body);

    if (missingFields.fields.length > 0) return error.createError(
        "errors.com.epicgames.validation.validation_failed",
        `Validation Failed. [${missingFields.fields.join(", ")}] field(s) is missing.`,
        [`[${missingFields.fields.join(", ")}]`], 1040, undefined, 400, res
    );

    if (!Array.isArray(req.body.itemIds)) return ValidationError("itemIds", "an array", res);

    if (!profile.items) profile.items = {};

    for (let i in req.body.itemIds) {
        if (!profile.items[req.body.itemIds[i]]) continue;

        profile.items[req.body.itemIds[i]].attributes.item_seen = true;

        ApplyProfileChanges.push({
            "changeType": "itemAttrChanged",
            "itemId": req.body.itemIds[i],
            "attributeName": "item_seen",
            "attributeValue": true
        });
    }

    if (ApplyProfileChanges.length > 0) {
        profile.rvn += 1;
        profile.commandRevision += 1;
        profile.updated = new Date().toISOString();

        await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });
    }

    if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    res.json({
        profileRevision: profile.rvn || 0,
        profileId: req.query.profileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});

app.post("/fortnite/api/game/v2/profile/*/client/SetItemFavoriteStatusBatch", verifyToken, async (req, res) => {
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    if (!await profileManager.validateProfile(req.query.profileId, profiles)) return error.createError(
        "errors.com.epicgames.modules.profiles.operation_forbidden",
        `Unable to find template configuration for profile ${req.query.profileId}`,
        [req.query.profileId], 12813, undefined, 403, res
    );

    if (req.query.profileId != "athena") return error.createError(
        "errors.com.epicgames.modules.profiles.invalid_command",
        `SetItemFavoriteStatusBatch is not valid on ${req.query.profileId} profile`,
        ["SetItemFavoriteStatusBatch", req.query.profileId], 12801, undefined, 400, res
    );

    let profile = profiles.profiles[req.query.profileId];

    const memory = functions.GetVersionInfo(req);

    if (req.query.profileId == "athena") profile.stats.attributes.season_num = memory.season;

    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
    let QueryRevision = req.query.rvn || -1;

    let missingFields = checkFields(["itemIds", "itemFavStatus"], req.body);

    if (missingFields.fields.length > 0) return error.createError(
        "errors.com.epicgames.validation.validation_failed",
        `Validation Failed. [${missingFields.fields.join(", ")}] field(s) is missing.`,
        [`[${missingFields.fields.join(", ")}]`], 1040, undefined, 400, res
    );

    if (!Array.isArray(req.body.itemIds)) return ValidationError("itemIds", "an array", res);
    if (!Array.isArray(req.body.itemFavStatus)) return ValidationError("itemFavStatus", "an array", res);

    if (!profile.items) profile.items = {};

    for (let i in req.body.itemIds) {
        if (!profile.items[req.body.itemIds[i]]) continue;
        if (typeof req.body.itemFavStatus[i] != "boolean") continue;

        profile.items[req.body.itemIds[i]].attributes.favorite = req.body.itemFavStatus[i];

        ApplyProfileChanges.push({
            "changeType": "itemAttrChanged",
            "itemId": req.body.itemIds[i],
            "attributeName": "favorite",
            "attributeValue": profile.items[req.body.itemIds[i]].attributes.favorite
        });
    }

    if (ApplyProfileChanges.length > 0) {
        profile.rvn += 1;
        profile.commandRevision += 1;
        profile.updated = new Date().toISOString();

        await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });
    }

    if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    res.json({
        profileRevision: profile.rvn || 0,
        profileId: req.query.profileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});

app.post("/fortnite/api/game/v2/profile/*/client/SetBattleRoyaleBanner", verifyToken, async (req, res) => {
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    if (!await profileManager.validateProfile(req.query.profileId, profiles)) return error.createError(
        "errors.com.epicgames.modules.profiles.operation_forbidden",
        `Unable to find template configuration for profile ${req.query.profileId}`,
        [req.query.profileId], 12813, undefined, 403, res
    );

    if (req.query.profileId != "athena") return error.createError(
        "errors.com.epicgames.modules.profiles.invalid_command",
        `SetBattleRoyaleBanner is not valid on ${req.query.profileId} profile`,
        ["SetBattleRoyaleBanner", req.query.profileId], 12801, undefined, 400, res
    );

    let profile = profiles.profiles[req.query.profileId];

    const memory = functions.GetVersionInfo(req);

    if (req.query.profileId == "athena") profile.stats.attributes.season_num = memory.season;

    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
    let QueryRevision = req.query.rvn || -1;

    let missingFields = checkFields(["homebaseBannerIconId", "homebaseBannerColorId"], req.body);

    if (missingFields.fields.length > 0) return error.createError(
        "errors.com.epicgames.validation.validation_failed",
        `Validation Failed. [${missingFields.fields.join(", ")}] field(s) is missing.`,
        [`[${missingFields.fields.join(", ")}]`], 1040, undefined, 400, res
    );

    if (typeof req.body.homebaseBannerIconId != "string") return ValidationError("homebaseBannerIconId", "a string", res);
    if (typeof req.body.homebaseBannerColorId != "string") return ValidationError("homebaseBannerColorId", "a string", res);

    let bannerProfileId = memory.build < 3.5 ? "profile0" : "common_core";

    let HomebaseBannerIconID = "";
    let HomebaseBannerColorID = "";

    if (!profiles.profiles[bannerProfileId].items) profiles.profiles[bannerProfileId].items = {};

    for (let itemId in profiles.profiles[bannerProfileId].items) {
        let templateId = profiles.profiles[bannerProfileId].items[itemId].templateId;

        if (templateId.toLowerCase() == `HomebaseBannerIcon:${req.body.homebaseBannerIconId}`.toLowerCase()) { HomebaseBannerIconID = itemId; continue; }
        if (templateId.toLowerCase() == `HomebaseBannerColor:${req.body.homebaseBannerColorId}`.toLowerCase()) { HomebaseBannerColorID = itemId; continue; }

        if (HomebaseBannerIconID && HomebaseBannerColorID) break;
    }

    if (!HomebaseBannerIconID) return error.createError(
        "errors.com.epicgames.fortnite.item_not_found",
        `Banner template 'HomebaseBannerIcon:${req.body.homebaseBannerIconId}' not found in profile`,
        [`HomebaseBannerIcon:${req.body.homebaseBannerIconId}`], 16006, undefined, 400, res
    );

    if (!HomebaseBannerColorID) return error.createError(
        "errors.com.epicgames.fortnite.item_not_found",
        `Banner template 'HomebaseBannerColor:${req.body.homebaseBannerColorId}' not found in profile`,
        [`HomebaseBannerColor:${req.body.homebaseBannerColorId}`], 16006, undefined, 400, res
    );

    if (!profile.items) profile.items = {};

    let activeLoadoutId = profile.stats.attributes.loadouts[profile.stats.attributes.active_loadout_index];

    profile.stats.attributes.banner_icon = req.body.homebaseBannerIconId;
    profile.stats.attributes.banner_color = req.body.homebaseBannerColorId;

    profile.items[activeLoadoutId].attributes.banner_icon_template = req.body.homebaseBannerIconId;
    profile.items[activeLoadoutId].attributes.banner_color_template = req.body.homebaseBannerColorId;

    ApplyProfileChanges.push({
        "changeType": "statModified",
        "name": "banner_icon",
        "value": profile.stats.attributes.banner_icon
    });

    ApplyProfileChanges.push({
        "changeType": "statModified",
        "name": "banner_color",
        "value": profile.stats.attributes.banner_color
    });

    if (ApplyProfileChanges.length > 0) {
        profile.rvn += 1;
        profile.commandRevision += 1;
        profile.updated = new Date().toISOString();

        await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });
    }

    if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    res.json({
        profileRevision: profile.rvn || 0,
        profileId: req.query.profileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});

app.post("/fortnite/api/game/v2/profile/*/client/EquipBattleRoyaleCustomization", verifyToken, async (req, res) => {
    const ProfileId = req.query.profileId;
    if (!ProfileId) return res.status(404).json({});

    const profiles = await Profile.findOne({ accountId: req.user.accountId }).select(`profiles.${ProfileId}`);

    /*await Profile.findOne({ accountId: req.user.accountId }).select(`profiles.${ProfileId}`);*/
    //console.log(profiles);
    //await Profile.findOne({ accountId: req.user.accountId });
    /*
        if (!await profileManager.validateProfile(ProfileId, profiles)) return error.createError(
            "errors.com.epicgames.modules.profiles.operation_forbidden",
            `Unable to find template configuration for profile ${ProfileId}`,
            [ProfileId], 12813, undefined, 403, res
        );*/

    if (ProfileId != "athena") return error.createError(
        "errors.com.epicgames.modules.profiles.invalid_command",
        `EquipBattleRoyaleCustomization is not valid on ${ProfileId} profile`,
        ["EquipBattleRoyaleCustomization", ProfileId], 12801, undefined, 400, res
    );

    let profile = profiles.profiles[ProfileId];

    const memory = functions.GetVersionInfo(req);

    if (ProfileId == "athena") profile.stats.attributes.season_num = memory.season;

    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
    let QueryRevision = req.query.rvn || -1;
    const specialCosmetics = [
        "AthenaCharacter:cid_random",
        "AthenaBackpack:bid_random",
        "AthenaPickaxe:pickaxe_random",
        "AthenaGlider:glider_random",
        "AthenaSkyDiveContrail:trails_random",
        "AthenaItemWrap:wrap_random",
        "AthenaMusicPack:musicpack_random",
        "AthenaLoadingScreen:lsid_random"
    ];

    let missingFields = checkFields(["slotName"], req.body);

    if (missingFields.fields.length > 0) return error.createError(
        "errors.com.epicgames.validation.validation_failed",
        `Validation Failed. [${missingFields.fields.join(", ")}] field(s) is missing.`,
        [`[${missingFields.fields.join(", ")}]`], 1040, undefined, 400, res
    );

    if (typeof req.body.itemToSlot != "string") return ValidationError("itemToSlot", "a string", res);
    if (typeof req.body.slotName != "string") return ValidationError("slotName", "a string", res);

    if (!profile.items) profile.items = {};

    if (!profile.items[req.body.itemToSlot] && req.body.itemToSlot) {
        let item = req.body.itemToSlot;

        if (!specialCosmetics.includes(item)) {
            return error.createError(
                "errors.com.epicgames.fortnite.id_invalid",
                `Item (id: '${req.body.itemToSlot}') not found`,
                [req.body.itemToSlot], 16027, undefined, 400, res
            );
        } else {
            if (!item.startsWith(`Athena${req.body.slotName}:`)) return error.createError(
                "errors.com.epicgames.fortnite.id_invalid",
                `Cannot slot item of type ${item.split(":")[0]} in slot of category ${req.body.slotName}`,
                [item.split(":")[0], req.body.slotName], 16027, undefined, 400, res
            );
        }
    }

    if (profile.items[req.body.itemToSlot]) {
        if (!profile.items[req.body.itemToSlot].templateId.startsWith(`Athena${req.body.slotName}:`)) return error.createError(
            "errors.com.epicgames.fortnite.id_invalid",
            `Cannot slot item of type ${profile.items[req.body.itemToSlot].templateId.split(":")[0]} in slot of category ${req.body.slotName}`,
            [profile.items[req.body.itemToSlot].templateId.split(":")[0], req.body.slotName], 16027, undefined, 400, res
        );

        let Variants = req.body.variantUpdates;

        if (Array.isArray(Variants)) {
            for (let i in Variants) {
                if (typeof Variants[i] != "object") continue;
                if (!Variants[i].channel) continue;
                if (!Variants[i].active) continue;

                let index = profile.items[req.body.itemToSlot].attributes.variants.findIndex(x => x.channel == Variants[i].channel);

                if (index == -1) continue;
                if (!profile.items[req.body.itemToSlot].attributes.variants[index].owned.includes(Variants[i].active)) continue;

                profile.items[req.body.itemToSlot].attributes.variants[index].active = Variants[i].active;
            }

            ApplyProfileChanges.push({
                "changeType": "itemAttrChanged",
                "itemId": req.body.itemToSlot,
                "attributeName": "variants",
                "attributeValue": profile.items[req.body.itemToSlot].attributes.variants
            });
        }
    }

    let slotNames = ["Character", "Backpack", "Pickaxe", "Glider", "SkyDiveContrail", "MusicPack", "LoadingScreen"];

    let activeLoadoutId = profile.stats.attributes.loadouts[profile.stats.attributes.active_loadout_index];
    let templateId = profile.items[req.body.itemToSlot] ? profile.items[req.body.itemToSlot].templateId : req.body.itemToSlot;

    switch (req.body.slotName) {
        case "Dance":
            if (!profile.items[activeLoadoutId].attributes.locker_slots_data.slots[req.body.slotName]) break;

            if (typeof req.body.indexWithinSlot != "number") return ValidationError("indexWithinSlot", "a number", res);

            if (req.body.indexWithinSlot >= 0 && req.body.indexWithinSlot <= 5) {
                profile.stats.attributes.favorite_dance[req.body.indexWithinSlot] = req.body.itemToSlot;
                profile.items[activeLoadoutId].attributes.locker_slots_data.slots.Dance.items[req.body.indexWithinSlot] = templateId;

                ApplyProfileChanges.push({
                    "changeType": "statModified",
                    "name": "favorite_dance",
                    "value": profile.stats.attributes["favorite_dance"]
                });
            }
            break;

        case "ItemWrap":
            if (!profile.items[activeLoadoutId].attributes.locker_slots_data.slots[req.body.slotName]) break;

            if (typeof req.body.indexWithinSlot != "number") return ValidationError("indexWithinSlot", "a number", res);

            switch (true) {
                case req.body.indexWithinSlot >= 0 && req.body.indexWithinSlot <= 7:
                    profile.stats.attributes.favorite_itemwraps[req.body.indexWithinSlot] = req.body.itemToSlot;
                    profile.items[activeLoadoutId].attributes.locker_slots_data.slots.ItemWrap.items[req.body.indexWithinSlot] = templateId;

                    ApplyProfileChanges.push({
                        "changeType": "statModified",
                        "name": "favorite_itemwraps",
                        "value": profile.stats.attributes["favorite_itemwraps"]
                    });
                    break;

                case req.body.indexWithinSlot == -1:
                    for (let i = 0; i < 7; i++) {
                        profile.stats.attributes.favorite_itemwraps[i] = req.body.itemToSlot;
                        profile.items[activeLoadoutId].attributes.locker_slots_data.slots.ItemWrap.items[i] = templateId;
                    }

                    ApplyProfileChanges.push({
                        "changeType": "statModified",
                        "name": "favorite_itemwraps",
                        "value": profile.stats.attributes["favorite_itemwraps"]
                    });
                    break;
            }
            break;

        default:
            if (!slotNames.includes(req.body.slotName)) break;
            if (profile.items[activeLoadoutId] && profile.items[activeLoadoutId].attributes && !profile.items[activeLoadoutId].attributes.locker_slots_data.slots[req.body.slotName]) break;

            if (req.body.slotName == "Pickaxe" || req.body.slotName == "Glider") {
                if (!req.body.itemToSlot) return error.createError(
                    "errors.com.epicgames.fortnite.id_invalid",
                    `${req.body.slotName} can not be empty.`,
                    [req.body.slotName], 16027, undefined, 400, res
                );
            }

            profile.stats.attributes[(`favorite_${req.body.slotName}`).toLowerCase()] = req.body.itemToSlot;
            profile.items[activeLoadoutId].attributes.locker_slots_data.slots[req.body.slotName].items = [templateId];

            ApplyProfileChanges.push({
                "changeType": "statModified",
                "name": (`favorite_${req.body.slotName}`).toLowerCase(),
                "value": profile.stats.attributes[(`favorite_${req.body.slotName}`).toLowerCase()]
            });
            break;
    }

    if (ApplyProfileChanges.length > 0) {
        profile.rvn += 1;
        profile.commandRevision += 1;
        profile.updated = new Date().toISOString();

        await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });
        /* Profile.updateOne(
            { accountId: req.user.accountId }, 
            { $set: { [`profiles.${ProfileId}`]: profile } }
          );*/
    }

    if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    return res.json({
        profileRevision: profile.rvn || 0,
        profileId: ProfileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});

app.post("/fortnite/api/game/v2/profile/*/client/SetCosmeticLockerBanner", verifyToken, async (req, res) => {
    const profiles = await Profile.findOne({ accountId: req.user.accountId });

    if (!await profileManager.validateProfile(req.query.profileId, profiles)) return error.createError(
        "errors.com.epicgames.modules.profiles.operation_forbidden",
        `Unable to find template configuration for profile ${req.query.profileId}`,
        [req.query.profileId], 12813, undefined, 403, res
    );

    if (req.query.profileId != "athena") return error.createError(
        "errors.com.epicgames.modules.profiles.invalid_command",
        `SetCosmeticLockerBanner is not valid on ${req.query.profileId} profile`,
        ["SetCosmeticLockerBanner", req.query.profileId], 12801, undefined, 400, res
    );

    let profile = profiles.profiles[req.query.profileId];

    const memory = functions.GetVersionInfo(req);

    if (req.query.profileId == "athena") profile.stats.attributes.season_num = memory.season;

    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
    let QueryRevision = req.query.rvn || -1;

    let missingFields = checkFields(["bannerIconTemplateName", "bannerColorTemplateName", "lockerItem"], req.body);

    if (missingFields.fields.length > 0) return error.createError(
        "errors.com.epicgames.validation.validation_failed",
        `Validation Failed. [${missingFields.fields.join(", ")}] field(s) is missing.`,
        [`[${missingFields.fields.join(", ")}]`], 1040, undefined, 400, res
    );

    if (typeof req.body.lockerItem != "string") return ValidationError("lockerItem", "a string", res);
    if (typeof req.body.bannerIconTemplateName != "string") return ValidationError("bannerIconTemplateName", "a string", res);
    if (typeof req.body.bannerColorTemplateName != "string") return ValidationError("bannerColorTemplateName", "a string", res);

    if (!profile.items) profile.items = {};

    if (!profile.items[req.body.lockerItem]) return error.createError(
        "errors.com.epicgames.fortnite.id_invalid",
        `Item (id: '${req.body.lockerItem}') not found`,
        [req.body.lockerItem], 16027, undefined, 400, res
    );

    if (profile.items[req.body.lockerItem].templateId.toLowerCase() != "cosmeticlocker:cosmeticlocker_athena") return error.createError(
        "errors.com.epicgames.fortnite.id_invalid",
        `lockerItem id is not a cosmeticlocker`,
        ["lockerItem"], 16027, undefined, 400, res
    );

    let bannerProfileId = "common_core";

    let HomebaseBannerIconID = "";
    let HomebaseBannerColorID = "";

    if (!profiles.profiles[bannerProfileId].items) profiles.profiles[bannerProfileId].items = {};

    for (let itemId in profiles.profiles[bannerProfileId].items) {
        let templateId = profiles.profiles[bannerProfileId].items[itemId].templateId;

        if (templateId.toLowerCase() == `HomebaseBannerIcon:${req.body.bannerIconTemplateName}`.toLowerCase()) { HomebaseBannerIconID = itemId; continue; }
        if (templateId.toLowerCase() == `HomebaseBannerColor:${req.body.bannerColorTemplateName}`.toLowerCase()) { HomebaseBannerColorID = itemId; continue; }

        if (HomebaseBannerIconID && HomebaseBannerColorID) break;
    }

    if (!HomebaseBannerIconID) return error.createError(
        "errors.com.epicgames.fortnite.item_not_found",
        `Banner template 'HomebaseBannerIcon:${req.body.bannerIconTemplateName}' not found in profile`,
        [`HomebaseBannerIcon:${req.body.bannerIconTemplateName}`], 16006, undefined, 400, res
    );

    if (!HomebaseBannerColorID) return error.createError(
        "errors.com.epicgames.fortnite.item_not_found",
        `Banner template 'HomebaseBannerColor:${req.body.bannerColorTemplateName}' not found in profile`,
        [`HomebaseBannerColor:${req.body.bannerColorTemplateName}`], 16006, undefined, 400, res
    );

    profile.items[req.body.lockerItem].attributes.banner_icon_template = req.body.bannerIconTemplateName;
    profile.items[req.body.lockerItem].attributes.banner_color_template = req.body.bannerColorTemplateName;

    profile.stats.attributes.banner_icon = req.body.bannerIconTemplateName;
    profile.stats.attributes.banner_color = req.body.bannerColorTemplateName;

    ApplyProfileChanges.push({
        "changeType": "itemAttrChanged",
        "itemId": req.body.lockerItem,
        "attributeName": "banner_icon_template",
        "attributeValue": profile.items[req.body.lockerItem].attributes.banner_icon_template
    });

    ApplyProfileChanges.push({
        "changeType": "itemAttrChanged",
        "itemId": req.body.lockerItem,
        "attributeName": "banner_color_template",
        "attributeValue": profile.items[req.body.lockerItem].attributes.banner_color_template
    });

    if (ApplyProfileChanges.length > 0) {
        profile.rvn += 1;
        profile.commandRevision += 1;
        profile.updated = new Date().toISOString();

        await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });
    }

    if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    res.json({
        profileRevision: profile.rvn || 0,
        profileId: req.query.profileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});

app.post("/fortnite/api/game/v2/profile/*/client/SetCosmeticLockerSlot", verifyToken, async (req, res) => {
    try {
        const profiles = await Profile.findOne({ accountId: req.user.accountId });

        if (!profiles || !await profileManager.validateProfile(req.query.profileId, profiles)) {
            return createError(
                "errors.com.epicgames.modules.profiles.operation_forbidden",
                `Unable to find template configuration for profile ${req.query.profileId}`,
                [req.query.profileId], 12813, undefined, 403, res
            );
        }

        if (req.query.profileId !== "athena") {
            return createError(
                "errors.com.epicgames.modules.profiles.invalid_command",
                `SetCosmeticLockerSlot is not valid on ${req.query.profileId} profile`,
                ["SetCosmeticLockerSlot", req.query.profileId], 12801, undefined, 400, res
            );
        }

        const profile = profiles.profiles[req.query.profileId];
        const memory = functions.GetVersionInfo(req);

        if (req.query.profileId === "athena") {
            profile.stats.attributes.season_num = memory.season;
        }

        let ApplyProfileChanges = [];
        const BaseRevision = profile.rvn;
        const ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
        const QueryRevision = req.query.rvn || -1;
        const specialCosmetics = [
            "AthenaCharacter:cid_random",
            "AthenaBackpack:bid_random",
            "AthenaPickaxe:pickaxe_random",
            "AthenaGlider:glider_random",
            "AthenaSkyDiveContrail:trails_random",
            "AthenaItemWrap:wrap_random",
            "AthenaMusicPack:musicpack_random",
            "AthenaLoadingScreen:lsid_random"
        ];

        const missingFields = checkFields(["category", "lockerItem"], req.body);

        if (missingFields.fields.length > 0) {
            return createError(
                "errors.com.epicgames.validation.validation_failed",
                `Validation Failed. [${missingFields.fields.join(", ")}] field(s) is missing.`,
                [`[${missingFields.fields.join(", ")}]`], 1040, undefined, 400, res
            );
        }

        if (typeof req.body.itemToSlot !== "string") return ValidationError("itemToSlot", "a string", res);
        if (typeof req.body.slotIndex !== "number") return ValidationError("slotIndex", "a number", res);
        if (typeof req.body.lockerItem !== "string") return ValidationError("lockerItem", "a string", res);
        if (typeof req.body.category !== "string") return ValidationError("category", "a string", res);

        if (!profile.items) profile.items = {};

        let itemToSlotID = "";

        if (req.body.itemToSlot) {
            for (const itemId in profile.items) {
                if (profile.items[itemId].templateId.toLowerCase() === req.body.itemToSlot.toLowerCase()) {
                    itemToSlotID = itemId;
                    break;
                }
            }
        }

        if (!profile.items[req.body.lockerItem]) {
            return createError(
                "errors.com.epicgames.fortnite.id_invalid",
                `Item (id: '${req.body.lockerItem}') not found`,
                [req.body.lockerItem], 16027, undefined, 400, res
            );
        }

        if (profile.items[req.body.lockerItem].templateId.toLowerCase() !== "cosmeticlocker:cosmeticlocker_athena") {
            return createError(
                "errors.com.epicgames.fortnite.id_invalid",
                `lockerItem id is not a cosmeticlocker`,
                ["lockerItem"], 16027, undefined, 400, res
            );
        }

        if (!profile.items[itemToSlotID] && req.body.itemToSlot) {
            const item = req.body.itemToSlot;

            if (!specialCosmetics.includes(item)) {
                return createError(
                    "errors.com.epicgames.fortnite.id_invalid",
                    `Item (id: '${req.body.itemToSlot}') not found`,
                    [req.body.itemToSlot], 16027, undefined, 400, res
                );
            } else if (!item.startsWith(`Athena${req.body.category}:`)) {
                return createError(
                    "errors.com.epicgames.fortnite.id_invalid",
                    `Cannot slot item of type ${item.split(":")[0]} in slot of category ${req.body.category}`,
                    [item.split(":")[0], req.body.category], 16027, undefined, 400, res
                );
            }
        }

        if (profile.items[itemToSlotID]) {
            if (!profile.items[itemToSlotID].templateId.startsWith(`Athena${req.body.category}:`)) {
                return createError(
                    "errors.com.epicgames.fortnite.id_invalid",
                    `Cannot slot item of type ${profile.items[itemToSlotID].templateId.split(":")[0]} in slot of category ${req.body.category}`,
                    [profile.items[itemToSlotID].templateId.split(":")[0], req.body.category], 16027, undefined, 400, res
                );
            }

            const Variants = req.body.variantUpdates;

            if (Array.isArray(Variants)) {
                for (const variant of Variants) {
                    if (typeof variant !== "object" || !variant.channel || !variant.active) continue;

                    const index = profile.items[itemToSlotID].attributes.variants.findIndex(x => x.channel === variant.channel);

                    if (index === -1 || !profile.items[itemToSlotID].attributes.variants[index].owned.includes(variant.active)) continue;

                    profile.items[itemToSlotID].attributes.variants[index].active = variant.active;
                }

                ApplyProfileChanges.push({
                    "changeType": "itemAttrChanged",
                    "itemId": itemToSlotID,
                    "attributeName": "variants",
                    "attributeValue": profile.items[itemToSlotID].attributes.variants
                });
            }
        }

        const slotData = profile.items[req.body.lockerItem].attributes.locker_slots_data.slots;
        const category = req.body.category;
        const slotIndex = req.body.slotIndex;

        switch (category) {
            case "Dance":
                if (slotData.Dance && slotIndex >= 0 && slotIndex <= 5) {
                    slotData.Dance.items[slotIndex] = req.body.itemToSlot;
                    profile.stats.attributes.favorite_dance[slotIndex] = itemToSlotID || req.body.itemToSlot;

                    ApplyProfileChanges.push({
                        "changeType": "itemAttrChanged",
                        "itemId": req.body.lockerItem,
                        "attributeName": "locker_slots_data",
                        "attributeValue": slotData
                    });
                }
                break;

            case "ItemWrap":
                if (slotData.ItemWrap) {
                    if (slotIndex >= 0 && slotIndex <= 7) {
                        slotData.ItemWrap.items[slotIndex] = req.body.itemToSlot;
                        profile.stats.attributes.favorite_itemwraps[slotIndex] = itemToSlotID || req.body.itemToSlot;
                    } else if (slotIndex === -1) {
                        for (let i = 0; i < 7; i++) {
                            slotData.ItemWrap.items[i] = req.body.itemToSlot;
                            profile.stats.attributes.favorite_itemwraps[i] = itemToSlotID || req.body.itemToSlot;
                        }
                    }

                    ApplyProfileChanges.push({
                        "changeType": "itemAttrChanged",
                        "itemId": req.body.lockerItem,
                        "attributeName": "locker_slots_data",
                        "attributeValue": slotData
                    });
                }
                break;

            default:
                if (slotData[category]) {
                    if ((category === "Pickaxe" || category === "Glider") && !req.body.itemToSlot) {
                        return createError(
                            "errors.com.epicgames.fortnite.id_invalid",
                            `${category} cannot be empty.`,
                            [category], 16027, undefined, 400, res
                        );
                    }

                    slotData[category].items = [req.body.itemToSlot];
                    profile.stats.attributes[`favorite_${category.toLowerCase()}`] = itemToSlotID || req.body.itemToSlot;

                    ApplyProfileChanges.push({
                        "changeType": "itemAttrChanged",
                        "itemId": req.body.lockerItem,
                        "attributeName": "locker_slots_data",
                        "attributeValue": slotData
                    });
                }
                break;
        }

        if (ApplyProfileChanges.length > 0) {
            profile.rvn += 1;
            profile.commandRevision += 1;
            profile.updated = new Date().toISOString();

            await profiles.updateOne({ accountId: req.user.accountId, [`profiles.${req.query.profileId}`]: profile });
        }

        if (QueryRevision !== ProfileRevisionCheck) {
            ApplyProfileChanges = [{
                "changeType": "fullProfileUpdate",
                "profile": profile
            }];
        }

        res.json({
            profileRevision: profile.rvn || 0,
            profileId: req.query.profileId,
            profileChangesBaseRevision: BaseRevision,
            profileChanges: ApplyProfileChanges,
            profileCommandRevision: profile.commandRevision || 0,
            serverTime: new Date().toISOString(),
            responseVersion: 1
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post("/fortnite/api/game/v2/profile/*/client/:operation", verifyToken, async (req, res) => {
    const accountId = req.user.accountId;

    let profiles = null;

    if (req.params.operation != "SetMatchmakingBansViewed") {
        profiles = await Profile.findOne({ accountId: accountId }).lean();
    }
    else {
        profiles = await Profile.findOne({ accountId: accountId });
    }

    if (!await profileManager.validateProfile(req.query.profileId, profiles)) return error.createError(
        "errors.com.epicgames.modules.profiles.operation_forbidden",
        `Unable to find template configuration for profile ${req.query.profileId}`,
        [req.query.profileId], 12813, undefined, 403, res
    );

    let profile = profiles.profiles[req.query.profileId];

    if (profile.rvn == profile.commandRevision) {
        profile.rvn += 1;

        if (req.query.profileId == "athena") {
            if (!profile.stats.attributes.last_applied_loadout) profile.stats.attributes.last_applied_loadout = profile.stats.attributes.loadouts[0];
        }

        await profiles.updateOne({ $set: { [`profiles.${req.query.profileId}`]: profile } });
    }

    const memory = functions.GetVersionInfo(req);

    if (req.query.profileId == "athena") profile.stats.attributes.season_num = memory.season;

    let MultiUpdate = [];

    if ((req.query.profileId == "common_core") && global.giftReceived[accountId]) {
        global.giftReceived[accountId] = false;

        let athena = profiles.profiles["athena"];

        MultiUpdate = [{
            "profileRevision": athena.rvn || 0,
            "profileId": "athena",
            "profileChangesBaseRevision": athena.rvn || 0,
            "profileChanges": [{
                "changeType": "fullProfileUpdate",
                "profile": athena
            }],
            "profileCommandRevision": athena.commandRevision || 0,
        }];
    }

    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let ProfileRevisionCheck = (memory.build >= 12.20) ? profile.commandRevision : profile.rvn;
    let QueryRevision = req.query.rvn || -1;

    switch (req.params.operation) {
        case "SetMatchmakingBansViewed": break;
        case "QueryProfile": break;
        case "ClientQuestLogin": break;
        case "RefreshExpeditions": break;
        case "GetMcpTimeForLogin": break;
        case "IncrementNamedCounterStat": break;
        case "SetHardcoreModifier": break;
        case "SetMtxPlatform": break;
        case "BulkEquipBattleRoyaleCustomization": break;

        default:
            error.createError(
                "errors.com.epicgames.fortnite.operation_not_found",
                `Operation ${req.params.operation} not valid`,
                [req.params.operation], 16035, undefined, 404, res
            );
            return;
    }

    if (QueryRevision != ProfileRevisionCheck) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    if (req.params.operation == "SetMatchmakingBansViewed") {
        const bannedlist = path.join(
            __dirname,
            "..", "userslogs", "WebServer", "Bannedlist.json"
        );

        // CACHING ACCOUNT IPS TO AVOID SENDING USELESS REQUEST
        const BannedListJson = JSON.parse(await fs.readFileSync(bannedlist, "utf-8"));

        if (BannedListJson) {
            const DateNow = new Date();

            const Sanctions = BannedListJson.Sanctions;
            for (let i = 0; i < Sanctions.length; i++) {
                if (Sanctions[i].accountId && Sanctions[i].bSanctionEnded != undefined && Sanctions[i].bSanctionEnded === false && Sanctions[i].accountId === req.user.accountId) {
                    const ExpireDateStr = Sanctions[i].ExpireDate;
                    if (ExpireDateStr != "") {
                        const DateResetPlay = new Date(ExpireDateStr);
                        if (DateResetPlay < DateNow) {
                            if (profiles) {
                                const common_core = profiles.profiles["common_core"];
                                if (common_core) {
                                    const attributes = common_core.stats.attributes;
                                    if (attributes) {
                                        const ban_status = attributes.ban_status;
                                        if (ban_status && ban_status.bRequiresUserAck == true) {
                                            ban_status.bRequiresUserAck = false;
                                            ban_status.banStartTimeUtc = "";
                                            ban_status.BanDurationDays = Number(0);
                                            ban_status.bBanHasStarted = false;

                                            common_core.updated = DateNow.toISOString();
                                            common_core.rvn++;

                                            await profiles.updateOne({ $set: { [`profiles.common_core`]: common_core } });

                                            functions.sendXmppMessageToId({
                                                type: "com.epicgames.gift.received",
                                                payload: {},
                                                timestamp: DateNow
                                            }, req.user.accountId);
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }


    }

    return res.json({
        profileRevision: profile.rvn || 0,
        profileId: req.query.profileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        multiUpdate: MultiUpdate,
        responseVersion: 1
    });

});


app.post("/fortnite/api/game/v2/profile/:accountId/dedicated_server/:operation", async (req, res) => {

    // console.log(req.originalUrl || req.url);
    // console.log(req.query);
    /*
    let [user, profile] = await Promise.all([
     User.findOne({ accountId: AccountId }).lean(),
     Profile.findOne({ accountId: AccountId })
         .lean()
         .select('profiles.athena.stats profiles.common_core.stats') // Sélectionnez les champs souhaités
 ]);*/

    const ProfileId = req.query.profileId;
    if (!ProfileId) return res.status(404).json({});

    const profiles = await Profile.findOne({ accountId: req.params.accountId }).lean().select(`profiles.${ProfileId}`);
    //  const profiles = await Profile.findOne({ accountId: req.params.accountId }).lean();
    if (!profiles) return res.status(404).json({});

    const profile = profiles.profiles[ProfileId];
    /*
        if (profile.items) {
            profile.items = {};
        }
    */
    let ApplyProfileChanges = [];
    let BaseRevision = profile.rvn;
    let QueryRevision = req.query.rvn || -1;

    if (QueryRevision != BaseRevision) {
        ApplyProfileChanges = [{
            "changeType": "fullProfileUpdate",
            "profile": profile
        }];
    }

    return res.json({
        profileRevision: profile.rvn || 0,
        profileId: ProfileId,
        profileChangesBaseRevision: BaseRevision,
        profileChanges: ApplyProfileChanges,
        profileCommandRevision: profile.commandRevision || 0,
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
});

function checkFields(fields, body) {
    let missingFields = { fields: [] };

    fields.forEach(field => {
        if (!body[field]) missingFields.fields.push(field);
    });

    return missingFields;
}

function ValidationError(field, type, res) {
    return error.createError(
        "errors.com.epicgames.validation.validation_failed",
        `Validation Failed. '${field}' is not ${type}.`,
        [field], 1040, undefined, 400, res
    );
}

function checkIfDuplicateExists(arr) {
    return new Set(arr).size !== arr.length
}

module.exports = app;
