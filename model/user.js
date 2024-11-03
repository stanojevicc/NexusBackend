const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        created: { type: Date, required: true },
        banned: { type: Boolean, default: false },
        discord_linked: { type: Boolean, default: false},
        discordId: { type: String, required: false, default: "" },
        accountId: { type: String, required: true, unique: true },
        username: { type: String, required: true, unique: true },
        username_lower: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        token: { type: String, required: true },
        bconfirmed_email: { type: Boolean, default: false },
        Coins: { type: Number, default: 0 },
        EmailData: { type: Object, default: {} },
        Notifications: { type: Array, default: [] },
        Coins: { type: Number, default: 0 },
        PrefLang: { type: String, default: "en" },
        email_confirm: { type: Boolean, default: false },
        last_emailchange: { type: Date, default: "" },
        last_passwordchange: { type: Date, default: "" },
        last_usernamechange: { type: Date, default: "" },
        lastEmailChange: { type: String, default: "NO_CURRENT_DATA" },
        lastPasswordChange: { type: String, default: "NO_CURRENT_DATA" },
        lastUsernameChange: { type: String, default: "NO_CURRENT_DATA" },
        nextUsernameChange: { type: String, default: "NO_CURRENT_DATA" },
        sub_expire: { type: String, default: "NO_CURRENT_DATA" },
        sub_tokens: { type: Number, default: 0 },
        sub_value: { type: Number, default: 0 }
    },
    {
        collection: "users"
    }
)

const model = mongoose.model('UserSchema', UserSchema);

module.exports = model;