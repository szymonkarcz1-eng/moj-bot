const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const fs = require('fs'); const path = require('path'); const k = require('./konfig.js');
const plikPoziomow = path.join(__dirname, 'poziomy.json'); const plikRaportu = path.join(__dirname, 'raport_dnia.json');
const czasStartuBota = Date.now(); const cooldownXP = new Map(); const voiceWejscia = new Map(); let clientCache;

function wczytajPoziomy() { return fs.existsSync(plikPoziomow) ? JSON.parse(fs.readFileSync(plikPoziomow, 'utf-8')) : {}; }
function zapiszPoziomy(dane) { fs.writeFileSync(plikPoziomow, JSON.stringify(dane, null, 4)); }
function wczytajRaport() { return fs.existsSync(plikRaportu) ? JSON.parse(fs.readFileSync(plikRaportu, 'utf-8')) : { nowi: [], wyszli: [], kary: [], wiadomosci: 0, usuniete: 0, voiceCzas: {}, voiceOsoby: [] }; }
function zapiszRaport(dane) { fs.writeFileSync(plikRaportu, JSON.stringify(dane, null, 4)); }

function emitLog(typ, tresc, embedData = null) {
    if (!clientCache) return; const id = k.KANALY_LOGOW[typ]; if (!id) return; const ch = clientCache.channels.cache.get(id); if (!ch) return;
    if (embedData) { ch.send({ embeds: [new EmbedBuilder(embedData).setTimestamp()] }); } else { ch.send(tresc); }
}

async function aktualizujKanałyStatystyk() {
    if (!clientCache) return;
    clientCache.guilds.cache.forEach(async (guild) => {
        try {
            await guild.members.fetch({ withPresences: true });
            const wszyscy = guild.memberCount; const boty = guild.members.cache.filter(m => m.user.bot).size; const ludzie = wszyscy - boty;
            const online = guild.members.cache.filter(m => !m.user.bot && (m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd')).size;
            const offline = ludzie - online; let naVoice = 0; guild.channels.cache.filter(c => c.type === 2).forEach(vc => { naVoice += vc.members.size; });
            const diffMs = Date.now() - czasStartuBota; const dni = Math.floor(diffMs / (1000 * 60 * 60 * 24)); const godz = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)); const min = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            const chE = guild.channels.cache.get(k.STATYSTYKI_KANALY['EKIPA']); if (chE) await chE.setName(`👥 Ekipa: ${ludzie}`).catch(() => {});
            const chO = guild.channels.cache.get(k.STATYSTYKI_KANALY['ONLINE']); if (chO) await chO.setName(`🟢 Online: ${online}`).catch(() => {});
            const chOf = guild.channels.cache.get(k.STATYSTYKI_KANALY['OFFLINE']); if (chOf) await chOf.setName(`⚫ Offline: ${offline}`).catch(() => {});
            const chV = guild.channels.cache.get(k.STATYSTYKI_KANALY['NA_VOICE']); if (chV) await chV.setName(`🎙️ Na voice: ${naVoice}`).catch(() => {});
            const chD = guild.channels.cache.get(k.STATYSTYKI_KANALY['DZIALA']); if (chD) await chD.setName(`🕒 Działa · ${dni > 0 ? dni + 'd ' : ''}${godz}h ${min}m`).catch(() => {});
        } catch (e) {}
    });
}

async function aktualizujTabliceTopki() {
    if (!clientCache) return;
    clientCache.guilds.cache.forEach(async (guild) => {
        try {
            const ch = guild.channels.cache.get(k.TOPKA_KONFIGURACJA['KANAL_ID']); if (!ch) return;
            try {
                const stare = await ch.messages.fetch({ limit: 10 });
                stare.forEach(async (m) => { if(m.author.id === clientCache.user.id) await m.delete().catch(() => {}); });
            } catch(e) {}
            const db = wczytajPoziomy();
            const sorted = db && Object.keys(db).length > 0 ? Object.keys(db).map(id => ({ id, ...db[id] })).sort((a, b) => (b.poziom * 10000 + b.xp) - (a.poziom * 10000 + a.xp)).slice(0, 5) : [];
            let txt = ""; const medale = ['🥇', '🥈', '🥉', '✨', '✨'];
            if (sorted.length === 0) { txt = "*Brak danych (napisz coś na dowolnym kanale czatu, aby tu trafić!)*"; } 
            else { sorted.forEach((g, i) => { txt += `${medale[i]} **#${i + 1}** <@${g.id}> — \`Poziom ${g.poziom}\` (${g.xp} XP)\n`; }); }
            await ch.send({ embeds: [new EmbedBuilder().setTitle('🏆 RANKING AKTYWNOŚCI SERWERA').setDescription('Oto 5 najaktywniejszych osób na naszym serwerze!').setColor('#FFD700').addFields({ name: '🔥 GRACZE', value: txt }).setTimestamp()] });
        } catch (e) {}
    });
}
async function sprawdzAwans(userId, guild) {
    let db = wczytajPoziomy(); if (!db[userId]) return;
    let awansowal = false;
    // Pętla odejmuje XP wymagane na dany poziom - dzięki temu licznik resetuje się i startuje od 0
    while (db[userId].xp >= (db[userId].poziom * 250) + 350) {
        db[userId].xp -= (db[userId].poziom * 250) + 350;
        db[userId].poziom += 1; awansowal = true;
    }
    if (awansowal) {
        zapiszPoziomy(db); const ch = guild.channels.cache.get(k.ID_KANALU_AWANSOW);
        if (ch) ch.send({ embeds: [new EmbedBuilder().setTitle('🆙 AWANS!').setDescription(`<@${userId}> zdobył **${db[userId].poziom} poziom**! 🌟`).setColor('#FFD700')] });
        if (k.KONFIGURACJA_RANG[db[userId].poziom]) { try { const m = await guild.members.fetch(userId); const r = guild.roles.cache.get(k.KONFIGURACJA_RANG[db[userId].poziom]); if (m && r) await m.roles.add(r); } catch (e) {} }
        await aktualizujTabliceTopki();
    }
}

module.exports = {
    konfiguracja: k,
    uruchomStatystyki: function(client) { clientCache = client; try { aktualizujKanałyStatystyk(); } catch(e) {} try { aktualizujTabliceTopki(); } catch(e) {} },
    uruchomWeryfikacje: function(client) {
        clientCache = client;
        client.on('messageCreate', async (msg) => {
            if (msg.author.bot || !msg.guild) return; if (msg.content.toLowerCase() === '!weryfikacja') {
                if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return; try { await msg.delete(); } catch(e) {}
                await msg.channel.send({ embeds: [new EmbedBuilder().setTitle('🛡️ Weryfikacja').setDescription('Kliknij przycisk poniżej.').setColor('#2b2d31')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('start_weryfikacja').setLabel('Zweryfikuj się').setStyle(ButtonStyle.Success).setEmoji('🔒'))] });
            }
        });
        client.on('interactionCreate', async (i) => {
            if (!i.isButton() || i.customId !== 'start_weryfikacja') return;
            if (i.member.roles.cache.has(k.ID_ROLI_WERYFIKACJI)) return i.reply({ content: 'Jesteś już zweryfikowany!', ephemeral: true });
            const l1 = Math.floor(Math.random() * 10) + 2; const l2 = Math.floor(Math.random() * 9) + 2; const w = l1 + l2;
            await i.deferReply({ ephemeral: true }); await i.editReply({ embeds: [new EmbedBuilder().setTitle('🛡️ Test CAPTCHA').setDescription(`Rozwiąż zadanie i wpisz wynik na czacie w 45s:\n\n# Ile to jest: \`${l1} + ${l2}\`?`).setColor('#1199ff')] });
            const col = i.channel.createMessageCollector({ filter: (m) => m.author.id === i.user.id, time: 45000, max: 1 });
            col.on('collect', async (msg) => {
                try { await msg.delete(); } catch(e) {}
                if (parseInt(msg.content.trim()) === w) {
                    const rW = i.guild.roles.cache.get(k.ID_ROLI_WERYFIKACJI); const rS = i.guild.roles.cache.get(k.ID_ROLI_STARTOWEGO);
                    if (rW) await i.member.roles.add(rW); if (rS && i.member.roles.cache.has(k.ID_ROLI_STARTOWEGO)) await i.member.roles.remove(rS);
                    await i.followUp({ content: '🎉 Weryfikacja pomyślna!', ephemeral: true });
                    emitLog('CZLONKOW', null, { title: '✅ Zweryfikowano', description: `${i.user} przeszedł test.`, color: 0x00ff00 });
                } else {
                    await i.followUp({ content: '❌ Błędny kod. Spróbuj ponownie klikając przycisk.', ephemeral: true });
                    emitLog('CZLONKOW', null, { title: '❌ Błąd weryfikacji', description: `${i.user} podał zły wynik.`, color: 0xff0000 });
                }
            });
        });
    },
    uruchomSystemy: function(client) {
        clientCache = client;
        client.on('guildMemberAdd', async (m) => {
            let r = wczytajRaport(); r.nowi.push(m.user.tag); zapiszRaport(r);
            emitLog('CZLONKOW', null, { title: '📥 Wejście', description: `${m} (${m.user.tag})`, color: 0x00ff77 });
            try { const rs = m.guild.roles.cache.get(k.ID_ROLI_STARTOWEGO); if (rs) await m.roles.add(rs); } catch (e) {}
            await aktualizujKanałyStatystyk();
        });
        client.on('guildMemberRemove', async (m) => {
            let r = wczytajRaport(); r.wyszli.push(m.user.tag); zapiszRaport(r);
            emitLog('CZLONKOW', null, { title: '📤 Wyjście', description: `${m.user.tag} opuścił serwer.`, color: 0xff0055 });
            await aktualizujKanałyStatystyk();
        });
        client.on('messageCreate', async (msg) => {
            if (msg.author.bot || !msg.guild) return; const tresc = msg.content.toLowerCase();
            if (tresc === '!ticket') {
                if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return; try { await msg.delete(); } catch(e) {}
                await msg.channel.send({ embeds: [new EmbedBuilder().setTitle('📩 Centrum Pomocy').setDescription('Otwórz zgłoszenie przyciskiem.').setColor('#5865F2')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('otworz_ticket').setLabel('Otwórz zgłoszenie').setStyle(ButtonStyle.Primary).setEmoji('📩'))] });
            }
            if (tresc === '!poziom') {
                const db = wczytajPoziomy(); const p = db[msg.author.id] || { xp: 0, poziom: 0 };
                msg.reply({ embeds: [new EmbedBuilder().setTitle(`📊 Profil: ${msg.author.username}`).setColor('#00ffcc').addFields({ name: '⭐ Poziom', value: `\`${p.poziom}\``, inline: true }, { name: '✨ XP', value: `\`${p.xp} / ${(p.poziom * 250) + 350} XP\``, inline: true })] });
            }
        });
        client.on('interactionCreate', async (i) => {
            if (!i.isButton()) return;
            if (i.customId === 'otworz_ticket') {
                await i.deferReply({ ephemeral: true }); const nazwa = `ticket-${i.user.username}`;
                if (i.guild.channels.cache.find(c => c.name === nazwa.toLowerCase())) return i.editReply({ content: '❌ Masz już zgłoszenie!', ephemeral: true });
                try {
                    const ch = await i.guild.channels.create({ name: nazwa, type: 0, parent: k.ID_KATEGORII_TICKETOW, permissionOverwrites: [{ id: i.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }, { id: k.ID_ROLI_ADMINISTRACJI, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }] });
                    await ch.send({ content: `${i.user} | <@&${k.ID_ROLI_ADMINISTRACJI}>`, embeds: [new EmbedBuilder().setTitle('🎫 Ticket').setDescription('Opisz swój problem. Zamknij przez 🔒.').setColor('#5865F2')], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('zamknij_ticket').setLabel('Zamknij').setStyle(ButtonStyle.Danger).setEmoji('🔒'))] });
                    await i.editReply({ content: `✅ Stworzono! Kanał: ${ch}`, ephemeral: true });
                } catch(e) {}
            }
            if (i.customId === 'zamknij_ticket') {
                await i.reply({ content: '🔒 Zamykanie za 5 sekund...' });
                try {
                    const messages = await i.channel.messages.fetch({ limit: 100 }); let arch = `📑 ARCHIWUM: ${i.channel.name}\n\n`;
                    Array.from(messages.values()).reverse().forEach(m => { arch += `[${m.createdAt.toLocaleTimeString()}] ${m.author.tag}: ${m.content}\n`; });
                    emitLog('ARCHIWUM', `📑 Archiwum z kanału **${i.channel.name}**.`);
                    const c = i.guild.channels.cache.get(k.KANALY_LOGOW['ARCHIWUM']); if (c) await c.send({ files: [new AttachmentBuilder(Buffer.from(arch, 'utf-8'), { name: `archive-${i.channel.name}.txt` })] });
                } catch(e) {}
                setTimeout(async () => { try { await i.channel.delete(); } catch(e) {} }, 5000);
            }
        });
        client.on('messageDelete', (m) => { if (m.author?.bot || !m.guild) return; let r = wczytajRaport(); r.usuniete += 1; zapiszRaport(r); emitLog('WIADOMOSCI', null, { title: '🗑️ Usunięto', description: `**Autor:** ${m.author}\n**Treść:** \`${m.content || 'Brak'}\``, color: 0xffaa00 }); });
        client.on('messageUpdate', (oldM, newM) => { if (oldM.author?.bot || oldM.content === newM.content) return; emitLog('WIADOMOSCI', null, { title: '✏️ Edycja', description: `**Autor:** ${oldM.author}\n**Przed:** \`${oldM.content}\`\n**Po:** \`${newM.content}\``, color: 0x3399ff }); });
        client.on('guildBanAdd', (b) => { let r = wczytajRaport(); r.kary.push(`Ban: ${b.user.tag}`); zapiszRaport(r); emitLog('MODERACJI', `🔨 **Ban:** ${b.user.tag}`); });
        client.on('voiceStateUpdate', async (oldState, newState) => {
            if (newState.member?.user.bot) return; const userId = newState.member?.id; if (!userId) return;
            if (newState.channelId === k.ID_KANALU_STARTOWEGO) {
                try {
                    const nowy = await newState.guild.channels.create({ name: `🔊 Pokój ${newState.member.user.username}`, type: 2, parent: k.ID_KATEGORII_POKOJOW, permissionOverwrites: [{ id: newState.member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers] }] });
                    await newState.member.voice.setChannel(nowy);
                } catch(e) {}
            }
            if (oldState.channel && oldState.channel.parentId === k.ID_KATEGORII_POKOJOW && oldState.channelId !== k.ID_KANALU_STARTOWEGO) { if (oldState.channel.members.size === 0) { try { await oldState.channel.delete(); } catch(e) {} } }
            let r = wczytajRaport();
            if (!oldState.channelId && newState.channelId) { voiceWejscia.set(userId, Date.now()); if (!r.voiceOsoby.includes(userId)) r.voiceOsoby.push(userId); zapiszRaport(r); emitLog('GLOSOWE', `🔊 ${newState.member.user.tag} wszedł do voice.`); }
            else if (oldState.channelId && !newState.channelId) { if (voiceWejscia.has(userId)) { r.voiceCzas[userId] = (r.voiceCzas[userId] || 0) + (Date.now() - voiceWejscia.get(userId)); voiceWejscia.delete(userId); zapiszRaport(r); } emitLog('GLOSOWE', `🔇 ${oldState.member.user.tag} wyszedł z voice.`); }
            await aktualizujKanałyStatystyk();
        });
        client.on('messageCreate', async (message) => {
            if (message.author.bot || !message.guild) return; if (cooldownXP.has(message.author.id) && Date.now() - cooldownXP.get(message.author.id) < 60000) return; cooldownXP.set(message.author.id, Date.now());
            let db = wczytajPoziomy(); if (!db[message.author.id]) db[message.author.id] = { xp: 0, poziom: 0 }; db[message.author.id].xp += Math.floor(Math.random() * 8) + 5; zapiszPoziomy(db);
            let r = wczytajRaport(); r.wiadomosci += 1; zapiszRaport(r); await sprawdzAwans(message.author.id, message.guild);
        });
        setInterval(async () => {
            let db = wczytajPoziomy(); client.guilds.cache.forEach(guild => { guild.channels.cache.filter(c => c.type === 2).forEach(vc => { vc.members.forEach(m => { if (m.user.bot || m.voice.selfMute || m.voice.selfDeaf) return; if (!db[m.id]) db[m.id] = { xp: 0, poziom: 0 }; db[m.id].xp += Math.floor(Math.random() * 5) + 3; sprawdzAwans(m.id, guild); }); }); }); zapiszPoziomy(db);
            const teraz = new Date(); if (teraz.getMinutes() % 5 === 0) { try { await aktualizujKanałyStatystyk(); } catch(e) {} try { await aktualizujTabliceTopki(); } catch(e) {} }
            if (teraz.getHours() === 0 && teraz.getMinutes() === 0) {
                const r = wczytajRaport(); let ms = 0; for (const id in r.voiceCzas) { ms += r.voiceCzas[id]; }
                const dni = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
                const embed = new EmbedBuilder().setTitle(`📋 Raport dnia · ${dni[teraz.getDay()]}`).setColor('#2b2d31').addFields({ name: '👤 Nowi', value: r.nowi.length > 0 ? r.nowi.join(', ') : 'nikt' }, { name: '🚪 Wyszli', value: r.wyszli.length > 0 ? r.wyszli.join(', ') : 'nikt' }, { name: '🔨 Kary', value: r.kary.length > 0 ? r.kary.join('\n') : 'brak' }, { name: '🔊 Voice', value: `\`${(ms / (1000 * 60 * 60)).toFixed(1)} h\``, inline: true }, { name: '💬 Czat', value: `\`${r.wiadomosci}\``, inline: true });
                const c = client.channels.cache.get(k.KANALY_LOGOW['MODERACJI']); if (c) c.send({ embeds: [embed] });
                fs.writeFileSync(plikRaportu, JSON.stringify({ nowi: [], wyszli: [], kary: [], wiadomosci: 0, usuniete: 0, voiceCzas: {}, voiceOsoby: [] }, null, 4));
            }
        }, 60000);
    }
};
