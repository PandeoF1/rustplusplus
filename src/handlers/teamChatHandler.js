/*
    Copyright (C) 2022 Alexander Emanuelsson (alexemanuelol)

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.

    https://github.com/alexemanuelol/rustplusplus

*/

const DiscordMessages = require('../discordTools/discordMessages.js');

module.exports = async function (rustplus, client, message) {
    // Send message to Discord
    await DiscordMessages.sendTeamChatMessage(rustplus.guildId, message);

    // Track message in statistics database
    if (client.statisticsTracker) {
        try {
            client.statisticsTracker.trackChatMessage(
                rustplus.guildId,
                rustplus.serverId,
                message.steamId.toString(),
                message.name,
                message.message
            );
        } catch (error) {
            rustplus.log('ERROR', `Failed to track chat message: ${error.message}`);
        }
    }

    // Broadcast to WebUI in real-time
    if (client.webServer) {
        client.webServer.broadcastChatMessage(rustplus.guildId, {
            server_id: rustplus.serverId,
            steam_id: message.steamId.toString(),
            player_name: message.name,
            message: message.message,
            timestamp: Math.floor(Date.now() / 1000)
        });
    }
}