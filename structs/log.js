function backend() {
    let msg = "";

    for (let i in backend.arguments) {
        msg += `${i == "0" ? "" : " "}${backend.arguments[i]}`;
    }

    console.log(`\x1b[32mBACKEND\x1b[0m: ${msg}`);
}

function bot() {
    let msg = "";

    for (let i in bot.arguments) {
        msg += `${i == "0" ? "" : " "}${bot.arguments[i]}`;
    }

    console.log(`\x1b[33mBOT\x1b[0m: ${msg}`);
}

function xmpp() {
    let msg = "";

    for (let i in xmpp.arguments) {
        msg += `${i == "0" ? "" : " "}${xmpp.arguments[i]}`;
    }

    console.log(`\x1b[34mXMPP\x1b[0m: ${msg}`);
}

function error() {
    let msg = "";

    for (let i in error.arguments) {
        msg += `${i == "0" ? "" : " "}${error.arguments[i]}`;
    }

    console.log(`\x1b[31mERROR\x1b[0m: ${msg}`);
}

function discord() {
    const resetCode = "\x1b[0m"; // Reset to default color

    // Different color codes to simulate a purple-blue gradient
    const gradientColors = [
        "\x1b[38;5;135m", // Light purple
        "\x1b[38;5;141m", // Purple
        "\x1b[38;5;99m",  // Light blue
        "\x1b[38;5;105m", // Medium blue
        "\x1b[38;5;63m",  // Deeper blue
        "\x1b[38;5;69m",  // Deeper purple
        "\x1b[38;5;63m",  // Deeper blue
        "\x1b[38;5;105m", // Medium blue
        "\x1b[38;5;99m",  // Light blue
        "\x1b[38;5;141m", // Purple
    ];

    const discordText = "DISCORD";
    let discordColored = "";

    // Apply each color to the corresponding letter in "DISCORD"
    for (let i = 0; i < discordText.length; i++) {
        discordColored += `${gradientColors[i]}${discordText[i]}`;
    }
    
    discordColored += resetCode; // Reset at the end

    let msg = "";
    for (let i in discord.arguments) {
        msg += `${i == "0" ? "" : " "}${discord.arguments[i]}`;
    }

    console.log(`${discordColored}: ${msg}`);
}

function mongo() {
    const resetCode = "\x1b[0m"; // Reset to default color

    // New color codes to simulate a lime-to-white gradient
    const gradientColors = [
        "\x1b[38;5;154m", // Lime green
        "\x1b[38;5;190m", // Lighter lime
        "\x1b[38;5;191m", // Very light lime
        "\x1b[38;5;229m", // Pale yellow-green
        "\x1b[38;5;230m", // Off-white
        "\x1b[38;5;231m", // White
        "\x1b[38;5;230m", // Off-white
        "\x1b[38;5;229m", // Pale yellow-green
        "\x1b[38;5;191m", // Very light lime
        "\x1b[38;5;190m", // Lighter lime
    ];

    const mongoText = "MongoDB";
    let mongoColored = "";

    // Apply each color to the corresponding letter in "MONGO"
    for (let i = 0; i < mongoText.length; i++) {
        mongoColored += `${gradientColors[i]}${mongoText[i]}`;
    }
    
    mongoColored += resetCode; // Reset at the end

    let msg = "";
    for (let i in mongo.arguments) {
        msg += `${i == "0" ? "" : " "}${mongo.arguments[i]}`;
    }

    console.log(`${mongoColored}: ${msg}`);
}


module.exports = {
    backend,
    bot,
    xmpp,
    error,
    discord,
    mongo
}