const http = require('http'); http.createServer((req, res) => { res.writeHead(200); res.end('Bot działa online!'); }).listen(process.env.PORT || 3000);
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const silnik = require('./silnik.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildPresences
    ]
});

// Rejestracja czystych modułów z pliku silnik.js
silnik.uruchomStatystyki(client);
silnik.uruchomWeryfikacje(client);
silnik.uruchomSystemy(client);

// Obsługa wyłącznie komendy administracyjnej !topka
client.on('messageCreate', async (msg) => {
    if (msg.author.bot || !msg.guild) return;
    const tresc = msg.content.toLowerCase();

    if (tresc === '!topka') {
        if (!msg.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        try { await msg.delete(); } catch(e) {}
        
        const emb = new EmbedBuilder()
            .setTitle('🏆 RANKING AKTYWNOŚCI SERWERA')
            .setDescription('Inicjalizacja rankingu...')
            .setColor('#FFD700');
            
        const wyslana = await msg.channel.send({ embeds: [emb] });
        console.log(`\n📌 WKLEJ TO ID DO PLIKU KONFIG.JS POD WIADOMOSC_ID: ${wyslana.id}\n`);
    }
});

client.once('clientReady', async () => {
    console.log(`🤖 Silnik bota zalogowany pomyślnie jako ${client.user.tag}!`);
});

client.login("MTU2ODI1MDk0NjEzODY3NzM4OQ.GSA2GQ.Tryn3ByGPxnH6vrkvS8HbsPbG7ipLifyrotjZo");

