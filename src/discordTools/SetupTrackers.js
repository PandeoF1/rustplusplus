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

const DiscordMessages = require('./discordMessages.js');
const DiscordTools = require('./discordTools.js');

module.exports = async (client, guild) => {
    const instance = client.getInstance(guild.id);

    // Solo limpiar el canal global si hay trackers que lo usan
    const globalTrackersExist = Object.values(instance.trackers).some(t => !t.channelId);
    if (globalTrackersExist && instance.channelId.trackers) {
        await DiscordTools.clearTextChannel(guild.id, instance.channelId.trackers, 100);
    }

    for (const trackerId in instance.trackers) {
        const tracker = instance.trackers[trackerId];
        // Si el tracker tiene su propio canal, limpiarlo antes de enviar el nuevo mensaje
        if (tracker.channelId) {
            await DiscordTools.clearTextChannel(guild.id, tracker.channelId, 100);
        }
        await DiscordMessages.sendTrackerMessage(guild.id, trackerId);
    }
}