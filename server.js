const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" } });
const { WebcastPushConnection } = require('tiktok-live-connector');
const fs = require('fs'); 
const path = require('path'); 
const setupGameEvents = require('./gameEvents'); 

const pathData = path.join(__dirname, 'data.json');
const pathCatalogo = path.join(__dirname, 'catalogo_regalos.json'); 

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html'))); 

app.get('/vista_conexion', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_conexion.html')));
app.get('/vista_versus', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_versus.html')));
app.get('/vista_versus_unidades', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_versus_unidades.html')));
app.get('/vista_regalos', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_regalos.html')));
app.get('/vista_racha_versus', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_racha_versus.html')));
app.get('/vista_bolita_globos', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_bolita_globos.html')));
app.get('/vista_meta_likes', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_meta_likes.html')));
app.get('/vista_top_likes', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_top_likes.html')));
app.get('/vista_top_donadores', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_top_donadores.html')));
app.get('/vista_backup', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_backup.html')));
app.get('/vista_sociales', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_sociales.html')));
app.get('/vista_wins_ruleta', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_wins_ruleta.html')));

app.get('/vista_salon_fama', (req, res) => res.sendFile(path.join(__dirname, 'vistas', 'vista_salon_fama.html')));
app.get('/salon_fama', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'salon_fama.html')));

app.get('/versus', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'versus.html'))); 
app.get('/versus_unidades', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'versus_unidades.html'))); 
app.get('/pop_regalos', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'pop_regalos.html'))); 
app.get('/racha_versus', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'racha_versus.html')));
app.get('/meta_likes', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'meta_likes.html')));
app.get('/top_likes', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'top_likes.html')));
app.get('/top_donadores', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'top_donadores.html')));

// 🌟 NUEVA RUTA: OVERLAY DE TOP GUERREROS
app.get('/top_guerreros', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'top_guerreros.html')));

app.get('/ultimo_seguidor', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'ultimo_seguidor.html')));
app.get('/ultimo_quiereme', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'ultimo_quiereme.html')));
app.get('/wins_ruleta', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'wins_ruleta.html')));

let topDonators = {};
let topSorted = [];
let teamSalvar = { total: 0, donators: {} };
let teamReiniciar = { total: 0, donators: {} };
let teamSalvarUnidades = { total: 0 };
let teamReiniciarUnidades = { total: 0 };
let lastDonatorSalvarUnid = { name: 'ESPERANDO', avatar: '' };
let lastDonatorReiniciarUnid = { name: 'ESPERANDO', avatar: '' };

let catalogoGlobal = [];
let currentTotalLikes = 0; 
let userTeams = {}; 

let ultimoSeguidorData = { name: "ESPERANDO...", avatar: "https://via.placeholder.com/150/222/fff?text=?" };
let ultimoQuieremeData = { name: "ESPERANDO...", avatar: "https://via.placeholder.com/150/222/fff?text=?" };
let recentFollowers = new Set(); 

let estadoWins = { actuales: 0, meta: 5 };
const ruletaSpunUsers = new Set();
const processedSpins = new Set(); 

const regalosEq1Defecto = [{ id: 6064, name: "GG", diamonds: 1 }, { id: 9947, name: "BFF Necklace", diamonds: 10 }];
const regalosEq2Defecto = [{ id: 5655, name: "Rose", diamonds: 1 }, { id: 8913, name: "Rosa", diamonds: 10 }];

let configGlobal = {
    username: "", historial: [],
    equipo1: { nombre: "SALVAR", sub: "GG", color: "#00ff66", regalos: regalosEq1Defecto, joinWords: "chicos, heroes, salvar, 1" },
    equipo2: { nombre: "REINICIAR", sub: "ROSA", color: "#ff003c", regalos: regalosEq2Defecto, joinWords: "chicas, villanos, reiniciar, 2" },
    unidades: {
        equipo1: { nombre: "SALVAR", nombreSingular: "CAPIBARA", nombrePlural: "CAPIBARAS", color: "#00ff66", imgUnidad: "", regalos: [] },
        equipo2: { nombre: "REINICIAR", nombreSingular: "DONA", nombrePlural: "DONAS", color: "#ff003c", imgUnidad: "", regalos: [] },
        enableCountdown: true, countdownSeconds: 30,
        battleStyle: { fontFamily: "'Luckiest Guy', cursive", textStroke: 2, shadowOpacity: 1.0, shadowDistance: 4, colorL1: "#ffd700", sizeL1: 30, colorL2: "#ff003c", sizeL2: 45, colorTimer: "#ffffff", sizeTimer: 140 }
    },
    enableCountdown: true, countdownSeconds: 30, showTopText: true, showDonatorCoins: true,
    showEmoticons: true, roundGifts: true, showTopDonators: true,
    regalosDisponibles: [],
    rachaVersus: { salvadas: {}, reinicios: {}, showName: true, showCount: true, showCoins: true, continuousMode: true },
    bolita: { multiplicador: 2, chatWord: "globos, jugar", chatGlobos: 1, chatCooldown: 60, likesMeta: 50, likesGlobos: 1, followGlobos: 5, followCooldown: 300, allowFree: true, quiereMeGlobos: 60 },
    metaLikes: { active: false, firstGoal: 0, step: 20000, prefixText: "A los", actionText: "REINICIO", currentGoal: 20000, style: { fontSize: 45, color: "#ffffff", shadowColor: "#ff003c", fontFamily: "'Luckiest Guy', cursive" } },
    topLikes: { currentRound: {}, mirrorMode: false },
    topVIP: { currentRound: {}, recordHistorico: {}, displayLimit: 2, mirrorMode: false },
    sociales: { followRequiresChat: false, followChatWord: "yo" },
    winsRuleta: { regalosSumar: [], regalosRestar: [], cooldown: 3600, probabilidad: 50 },
    salonFama: { record: {}, displayLimit: 5, alignment: 'left' }
};

if (fs.existsSync(pathData)) {
    try { 
        let guardado = JSON.parse(fs.readFileSync(pathData, 'utf8')); 
        configGlobal = { ...configGlobal, ...guardado };

        if(!configGlobal.equipo1.joinWords) configGlobal.equipo1.joinWords = "chicos, heroes, salvar, 1";
        if(!configGlobal.equipo2.joinWords) configGlobal.equipo2.joinWords = "chicas, villanos, reiniciar, 2";
        if(!configGlobal.rachaVersus) configGlobal.rachaVersus = { salvadas: {}, reinicios: {}, showName: true, showCount: true, showCoins: true, continuousMode: true };
        if(configGlobal.rachaVersus.continuousMode === undefined) configGlobal.rachaVersus.continuousMode = true;
        if(!configGlobal.bolita) configGlobal.bolita = { multiplicador: 2, chatWord: "globos, jugar", chatGlobos: 1, chatCooldown: 60, likesMeta: 50, likesGlobos: 1, followGlobos: 5, followCooldown: 300, allowFree: true, quiereMeGlobos: 60 };
        if(!configGlobal.metaLikes) configGlobal.metaLikes = { active: false, firstGoal: 0, step: 20000, prefixText: "A los", actionText: "REINICIO", currentGoal: 20000, style: { fontSize: 45, color: "#ffffff", shadowColor: "#ff003c", fontFamily: "'Luckiest Guy', cursive" } };
        
        if(!configGlobal.topLikes) configGlobal.topLikes = { currentRound: {}, mirrorMode: false };
        if(configGlobal.topLikes.mirrorMode === undefined) configGlobal.topLikes.mirrorMode = false;
        
        if(!configGlobal.topVIP) configGlobal.topVIP = { currentRound: {}, recordHistorico: {}, displayLimit: 2, mirrorMode: false };
        if(!configGlobal.topVIP.displayLimit) configGlobal.topVIP.displayLimit = 2; 
        if(configGlobal.topVIP.mirrorMode === undefined) configGlobal.topVIP.mirrorMode = false;
        if(!configGlobal.sociales) configGlobal.sociales = { followRequiresChat: false, followChatWord: "yo" };
        
        if(!configGlobal.winsRuleta) {
            configGlobal.winsRuleta = { regalosSumar: [], regalosRestar: [], cooldown: 3600, probabilidad: 50 };
        } else {
            if (configGlobal.winsRuleta.cooldown === undefined) configGlobal.winsRuleta.cooldown = 3600;
            if (configGlobal.winsRuleta.probabilidad === undefined) configGlobal.winsRuleta.probabilidad = 50;
        }

        if(!configGlobal.salonFama) {
            configGlobal.salonFama = { record: {}, displayLimit: 5, alignment: 'left' };
        } else {
            if (configGlobal.salonFama.displayLimit === undefined) configGlobal.salonFama.displayLimit = 5;
            if (configGlobal.salonFama.alignment === undefined) configGlobal.salonFama.alignment = 'left';
        }

    } catch (e) {}
}

if (fs.existsSync(pathCatalogo)) { try { catalogoGlobal = JSON.parse(fs.readFileSync(pathCatalogo, 'utf8')); } catch (e) {} }
if (catalogoGlobal.length === 0) {
    catalogoGlobal = [...regalosEq1Defecto, ...regalosEq2Defecto].sort((a, b) => a.diamonds - b.diamonds);
    fs.writeFileSync(pathCatalogo, JSON.stringify(catalogoGlobal, null, 4));
}
configGlobal.regalosDisponibles = catalogoGlobal;

function guardarEnArchivo() { 
    try { fs.writeFileSync(pathData, JSON.stringify(configGlobal, null, 4)); fs.writeFileSync(pathCatalogo, JSON.stringify(catalogoGlobal, null, 4)); } catch (err) {}
}

function cerrarRondasGlobales() {
    let seCerroAlgo = false;

    if (Object.keys(configGlobal.topLikes.currentRound).length > 0) {
        configGlobal.topLikes.currentRound = {}; 
        seCerroAlgo = true;
    }

    let arrVIPs = Object.entries(configGlobal.topVIP.currentRound).map(([u, d]) => ({userKey: u, ...d})).sort((a,b) => b.coins - a.coins);
    if (arrVIPs.length > 0) {
        let top1 = arrVIPs[0]; 
        
        if(!configGlobal.topVIP.recordHistorico[top1.userKey]) {
            configGlobal.topVIP.recordHistorico[top1.userKey] = { avatar: top1.avatar, displayName: top1.displayName, wins: 0, streak: 0 };
        }
        configGlobal.topVIP.recordHistorico[top1.userKey].wins += 1; 
        configGlobal.topVIP.recordHistorico[top1.userKey].streak = (configGlobal.topVIP.recordHistorico[top1.userKey].streak || 0) + 1;
        configGlobal.topVIP.recordHistorico[top1.userKey].avatar = top1.avatar; 
        configGlobal.topVIP.recordHistorico[top1.userKey].displayName = top1.displayName; 

        for (let i = 1; i < arrVIPs.length; i++) {
            let loser = arrVIPs[i];
            if (configGlobal.topVIP.recordHistorico[loser.userKey]) {
                configGlobal.topVIP.recordHistorico[loser.userKey].streak = 0; 
            } else {
                configGlobal.topVIP.recordHistorico[loser.userKey] = { avatar: loser.avatar, displayName: loser.displayName, wins: 0, streak: 0 };
            }
        }
        configGlobal.topVIP.currentRound = {}; 
        seCerroAlgo = true;
    }

    if (seCerroAlgo) {
        guardarEnArchivo(); 
        io.emit('top_likes_data_update', configGlobal.topLikes); 
        io.emit('top_vip_data_update', configGlobal.topVIP); 
        io.emit('config_actual', configGlobal);
    }
}

let tiktokLiveConnection = null;
let desconexionIntencional = false;
const regalosProcesados = new Set();
const combosActivos = new Map(); 

function emitSalvarUpdate(target) {
    let topSalvar = Object.entries(teamSalvar.donators).map(([name, info]) => ({ name: info.displayName, coins: info.coins, avatar: info.avatar })).sort((a, b) => b.coins - a.coins)[0] || { name: 'ESPERANDO', coins: 0, avatar: '' };
    let topReiniciar = Object.entries(teamReiniciar.donators).map(([name, info]) => ({ name: info.displayName, coins: info.coins, avatar: info.avatar })).sort((a, b) => b.coins - a.coins)[0] || { name: 'ESPERANDO', coins: 0, avatar: '' };
    
    target.emit('actualizacion_salvar', { totalSalvar: teamSalvar.total, totalReiniciar: teamReiniciar.total, topSalvar: topSalvar, topReiniciar: topReiniciar });
    target.emit('actualizacion_unidades', { totalSalvar: teamSalvarUnidades.total, totalReiniciar: teamReiniciarUnidades.total, topSalvar: lastDonatorSalvarUnid, topReiniciar: lastDonatorReiniciarUnid });
}

function desconectarTikTok() {
    if (tiktokLiveConnection) {
        desconexionIntencional = true;
        try { tiktokLiveConnection.disconnect(); } catch (e) {}
        tiktokLiveConnection = null;
        currentTotalLikes = 0; 
        io.emit('estado_conexion', { estado: 'desconectado', msg: '🔴 Desconectado manualmente' });
    }
}

function conectarTikTok(usuario) {
    desconectarTikTok();
    if (!usuario || usuario.trim() === "") { io.emit('estado_conexion', { estado: 'desconectado', msg: '⚠️ Ingresa un usuario para conectar' }); return; }
    let userLimpio = usuario.replace('@', '').trim();
    desconexionIntencional = false;
    io.emit('estado_conexion', { estado: 'conectando', msg: `🟡 Conectando a @${userLimpio}...` });
    
    let connectionInstance = new WebcastPushConnection(userLimpio);
    tiktokLiveConnection = connectionInstance;

    connectionInstance.connect().then(() => {
        io.emit('estado_conexion', { estado: 'conectado', msg: `🟢 Conectado a @${userLimpio} | 📡 Radar Activo` });
        if (!configGlobal.historial.includes(userLimpio)) {
            configGlobal.historial.unshift(userLimpio);
            if (configGlobal.historial.length > 10) configGlobal.historial.pop();
            guardarEnArchivo();
        }
        io.emit('config_actual', configGlobal);

    }).catch(err => { io.emit('estado_conexion', { estado: 'error', msg: `❌ Error: ${err.message}` }); });

    connectionInstance.on('disconnected', () => {
        if (tiktokLiveConnection === connectionInstance && !desconexionIntencional) {
            io.emit('estado_conexion', { estado: 'conectando', msg: '🟡 Conexión perdida. Auto-reconectando...' });
            setTimeout(() => { conectarTikTok(userLimpio); }, 3000);
        }
    });

    connectionInstance.on('streamEnd', () => {
        if (tiktokLiveConnection === connectionInstance) { desconexionIntencional = true; io.emit('estado_conexion', { estado: 'offline', msg: '⬛ El LIVE ha finalizado' }); }
    });

    connectionInstance.on('chat', data => {
        let texto = data.comment.toLowerCase();
        let user = data.uniqueId;
        
        if (configGlobal.sociales && configGlobal.sociales.followRequiresChat) {
            let requiredWord = (configGlobal.sociales.followChatWord || "yo").toLowerCase().trim();
            if (texto.trim() === requiredWord && recentFollowers.has(user)) {
                let cleanName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || data.uniqueId;
                if (cleanName.length > 18) cleanName = cleanName.substring(0, 18) + "...";
                let avatarUrl = (data.userDetails && data.userDetails.profilePictureUrls && data.userDetails.profilePictureUrls.length > 0) ? data.userDetails.profilePictureUrls[0] : "https://www.gravatar.com/avatar/0?d=mp&f=y";
                
                ultimoSeguidorData = { name: cleanName, avatar: avatarUrl };
                io.emit('update_ultimo_seguidor', ultimoSeguidorData);
                recentFollowers.delete(user); 
            }
        }

        let wordsEq1 = (configGlobal.equipo1.joinWords || "chicos, heroes, salvar, 1").toLowerCase().split(',').map(w=>w.trim()).filter(w=>w.length > 0);
        let wordsEq2 = (configGlobal.equipo2.joinWords || "chicas, villanos, reiniciar, 2").toLowerCase().split(',').map(w=>w.trim()).filter(w=>w.length > 0);

        let matchEq1 = wordsEq1.some(w => texto.includes(w));
        let matchEq2 = wordsEq2.some(w => texto.includes(w));

        if (matchEq1) { userTeams[user] = 1; } 
        else if (matchEq2) { userTeams[user] = 2; }
    });

    connectionInstance.on('like', data => {
        let totalTikTok = parseInt(data.totalLikeCount);
        let batchLikes = parseInt(data.likeCount) || 1;

        if (!isNaN(totalTikTok) && totalTikTok > currentTotalLikes) {
            currentTotalLikes = totalTikTok;
        } else {
            currentTotalLikes += batchLikes;
        }
        
        io.emit('sync_likes_actuales', currentTotalLikes);

        if (configGlobal.metaLikes && configGlobal.metaLikes.active) {
            let meta = configGlobal.metaLikes;
            let cGoal = parseInt(meta.currentGoal) || 0;
            let mStep = parseInt(meta.step) || 20000;
            
            if (cGoal > 0 && currentTotalLikes >= cGoal) {
                io.emit('meta_likes_reached', { goal: cGoal, text: meta.actionText });
                meta.firstGoal = 0;
                while (cGoal <= currentTotalLikes) { cGoal += mStep; }
                meta.currentGoal = cGoal; 
                guardarEnArchivo();
                io.emit('config_actual', configGlobal);
                
                setTimeout(() => {
                    io.emit('meta_likes_update', { current: currentTotalLikes, goal: cGoal, text: meta.actionText, prefix: meta.prefixText, style: meta.style });
                }, 4000); 
            } else {
                io.emit('meta_likes_update', { current: currentTotalLikes, goal: cGoal, text: meta.actionText, prefix: meta.prefixText, style: meta.style });
            }
        }

        let user = data.uniqueId;
        let cleanName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || user;
        if (cleanName.length > 12) { cleanName = cleanName.substring(0, 12) + "..."; }
        
        let avatarUrl = "https://www.gravatar.com/avatar/0?d=mp&f=y";
        if (data.profilePictureUrl) {
            avatarUrl = data.profilePictureUrl;
        } else if (data.userDetails && data.userDetails.profilePictureUrls && data.userDetails.profilePictureUrls.length > 0) {
            avatarUrl = data.userDetails.profilePictureUrls[0];
        }

        if (!configGlobal.topLikes.currentRound[user]) {
            configGlobal.topLikes.currentRound[user] = { likes: 0, avatar: avatarUrl, displayName: cleanName };
        } else {
            configGlobal.topLikes.currentRound[user].avatar = avatarUrl;
            configGlobal.topLikes.currentRound[user].displayName = cleanName;
        }
        configGlobal.topLikes.currentRound[user].likes += batchLikes;
        
        io.emit('top_likes_data_update', configGlobal.topLikes);
    });

    connectionInstance.on('follow', data => {
        let user = data.uniqueId;
        let cleanName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || data.uniqueId;
        if (cleanName.length > 18) { cleanName = cleanName.substring(0, 18) + "..."; }
        
        let avatarUrl = "https://www.gravatar.com/avatar/0?d=mp&f=y";
        if (data.userDetails && data.userDetails.profilePictureUrls && data.userDetails.profilePictureUrls.length > 0) {
            avatarUrl = data.userDetails.profilePictureUrls[0];
        }

        if (configGlobal.sociales && configGlobal.sociales.followRequiresChat) {
            recentFollowers.add(data.uniqueId);
            setTimeout(() => recentFollowers.delete(data.uniqueId), 900000); 
        } else {
            ultimoSeguidorData = { name: cleanName, avatar: avatarUrl };
            io.emit('update_ultimo_seguidor', ultimoSeguidorData);
        }

        if (configGlobal.winsRuleta) {
            let cooldownSecs = configGlobal.winsRuleta.cooldown !== undefined ? parseInt(configGlobal.winsRuleta.cooldown) : 3600;
            let probPositiva = configGlobal.winsRuleta.probabilidad !== undefined ? parseInt(configGlobal.winsRuleta.probabilidad) : 50;

            if (!ruletaSpunUsers.has(user)) {
                ruletaSpunUsers.add(user);
                setTimeout(() => ruletaSpunUsers.delete(user), cooldownSecs * 1000); 

                let posOptions = [1, 50, 100, 200, 500, 1000];
                let negOptions = [-1, -50, -100, -200, -500, -1000];
                let roll = Math.random() * 100;
                let chosenArray = (roll < probPositiva) ? posOptions : negOptions;
                let result = chosenArray[Math.floor(Math.random() * chosenArray.length)];
                
                let spinId = 'spin_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
                
                io.emit('wins_ruleta_trigger', { spinId: spinId, name: cleanName, avatar: avatarUrl, result: result });
            }
        }
    });

    connectionInstance.on('gift', data => {
        let user = data.uniqueId;
        let cleanName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || user; 
        if (cleanName.length > 12) { cleanName = cleanName.substring(0, 12) + "..."; }
        
        let avatarUrl = "https://www.gravatar.com/avatar/0?d=mp&f=y";
        if (data.userDetails && data.userDetails.profilePictureUrls && data.userDetails.profilePictureUrls.length > 0) avatarUrl = data.userDetails.profilePictureUrls[0];
        
        let giftId = parseInt(data.giftId) || 0; 
        let giftName = data.giftName || "Regalo";
        let unitPrice = parseInt(data.diamondCount) || 0; 
        
        let giftImgUrl = data.giftPictureUrl || ""; 
        if (!giftImgUrl && data.extendedGiftInfo && data.extendedGiftInfo.image && data.extendedGiftInfo.image.url_list && data.extendedGiftInfo.image.url_list.length > 0) {
            giftImgUrl = data.extendedGiftInfo.image.url_list[0];
        } else if (!giftImgUrl && data.gift && data.gift.image && data.gift.image.url_list && data.gift.image.url_list.length > 0) {
            giftImgUrl = data.gift.image.url_list[0];
        }

        if (giftId === 7934) {
            let fullName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || data.uniqueId;
            if (fullName.length > 18) fullName = fullName.substring(0, 18) + "...";
            ultimoQuieremeData = { name: fullName, avatar: avatarUrl };
            io.emit('update_ultimo_quiereme', ultimoQuieremeData);
        }

        let knownGift = catalogoGlobal.find(g => Number(g.id) === giftId);
        if (knownGift) { 
            unitPrice = knownGift.diamonds; 
            
            let esImagenFalsa = !knownGift.image || knownGift.image.includes('via.placeholder.com') || knownGift.image.trim() === "";
            if (esImagenFalsa && giftImgUrl !== "") {
                knownGift.image = giftImgUrl;
                
                let actualizarConfigAsignada = (arr) => {
                    if(!arr) return;
                    arr.forEach(item => { if(Number(item.id) === giftId) item.image = giftImgUrl; });
                };
                
                actualizarConfigAsignada(configGlobal.equipo1.regalos);
                actualizarConfigAsignada(configGlobal.equipo2.regalos);
                if(configGlobal.unidades) { actualizarConfigAsignada(configGlobal.unidades.equipo1.regalos); actualizarConfigAsignada(configGlobal.unidades.equipo2.regalos); }
                if(configGlobal.winsRuleta) { actualizarConfigAsignada(configGlobal.winsRuleta.regalosSumar); actualizarConfigAsignada(configGlobal.winsRuleta.regalosRestar); }
                
                guardarEnArchivo(); io.emit('config_actual', configGlobal); 
            }
        } else {
            let nuevoRegalo = { id: giftId, name: giftName, diamonds: unitPrice, image: giftImgUrl };
            catalogoGlobal.push(nuevoRegalo); catalogoGlobal.sort((a, b) => a.diamonds - b.diamonds);
            configGlobal.regalosDisponibles = catalogoGlobal; guardarEnArchivo(); io.emit('config_actual', configGlobal); 
        }

        if (configGlobal.roundGifts && unitPrice % 10 === 9) { unitPrice += 1; }

        let cantidadAProcesar = 0;

        if (data.giftType === 1) {
            let comboId = data.groupId || data.msgId; 
            let countAnterior = combosActivos.get(comboId) || 0;
            let nuevoCount = parseInt(data.repeatCount) || 1; 
            let diferencia = nuevoCount - countAnterior;

            if (diferencia <= 0) return; 

            cantidadAProcesar = diferencia; 
            combosActivos.set(comboId, nuevoCount);

            if (data.repeatEnd) { setTimeout(() => combosActivos.delete(comboId), 10000); }
        } else {
            let huellaRegalo = data.msgId || (data.uniqueId + data.timestamp);
            if (regalosProcesados.has(huellaRegalo)) return; 
            regalosProcesados.add(huellaRegalo);
            if (regalosProcesados.size > 1000) regalosProcesados.clear(); 
            
            cantidadAProcesar = parseInt(data.repeatCount) || 1; 
        }

        if (isNaN(cantidadAProcesar) || cantidadAProcesar <= 0) return;

        const totalCoins = unitPrice * cantidadAProcesar;

        if (configGlobal.winsRuleta) {
            let isSumarWins = configGlobal.winsRuleta.regalosSumar.some(r => Number(r.id) === giftId);
            let isRestarWins = configGlobal.winsRuleta.regalosRestar.some(r => Number(r.id) === giftId);

            if (isSumarWins || isRestarWins) {
                let winChange = isSumarWins ? totalCoins : -totalCoins;
                estadoWins.actuales += winChange;
                
                io.emit('wins_ruleta_update', estadoWins);
                io.emit('wins_ruleta_popup', {
                    name: cleanName,
                    avatar: avatarUrl,
                    amount: winChange,
                    type: isSumarWins ? 'sumar' : 'restar'
                });
            }
        }

        if (configGlobal.salonFama) {
            if (!configGlobal.salonFama.record) configGlobal.salonFama.record = {};
            
            let maxGiftInHall = 0;
            let recordKeys = Object.keys(configGlobal.salonFama.record);
            if (recordKeys.length > 0) {
                maxGiftInHall = Math.max(...recordKeys.map(k => configGlobal.salonFama.record[k].diamonds));
            }

            if (totalCoins <= 1 && maxGiftInHall >= 100) {
                // Ignore
            } else {
                let bestGiftImage = (knownGift && knownGift.image && !knownGift.image.includes('via.placeholder.com')) ? knownGift.image : giftImgUrl;
                
                let uniqueGiftId = user + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                
                configGlobal.salonFama.record[uniqueGiftId] = {
                    userId: user,
                    name: cleanName,
                    avatar: avatarUrl,
                    giftName: giftName,
                    giftImage: bestGiftImage,
                    diamonds: totalCoins
                };

                let allRecords = Object.entries(configGlobal.salonFama.record).map(([k, v]) => ({key: k, ...v}));
                allRecords.sort((a, b) => b.diamonds - a.diamonds);
                
                if (allRecords.length > 100) {
                    let toDelete = allRecords.slice(100);
                    toDelete.forEach(item => {
                        delete configGlobal.salonFama.record[item.key];
                    });
                }

                guardarEnArchivo();
                io.emit('salon_fama_update', configGlobal.salonFama);
            }
        }

        if (!configGlobal.topVIP.currentRound[user]) {
            configGlobal.topVIP.currentRound[user] = { coins: 0, avatar: avatarUrl, displayName: cleanName };
        } else {
            configGlobal.topVIP.currentRound[user].avatar = avatarUrl;
            configGlobal.topVIP.currentRound[user].displayName = cleanName;
        }
        configGlobal.topVIP.currentRound[user].coins += totalCoins;
        io.emit('top_vip_data_update', configGlobal.topVIP);

        if (!topDonators[user]) topDonators[user] = { monedas: 0, avatar: avatarUrl, displayName: cleanName };
        else { topDonators[user].avatar = avatarUrl; topDonators[user].displayName = cleanName; }
        topDonators[user].monedas += totalCoins;
        topSorted = Object.entries(topDonators).map(([nombre, info]) => ({ nombre: info.displayName, monedas: info.monedas, avatar: info.avatar })).sort((a, b) => b.monedas - a.monedas).slice(0, 2); 
        io.emit('actualizacion', topSorted);

        let isSalvarMonedas = configGlobal.equipo1.regalos.some(r => Number(r.id) === giftId);
        let isReiniciarMonedas = configGlobal.equipo2.regalos.some(r => Number(r.id) === giftId);
        
        if (userTeams[user] === 1) { isSalvarMonedas = true; isReiniciarMonedas = false; } 
        else if (userTeams[user] === 2) { isSalvarMonedas = false; isReiniciarMonedas = true; }

        if (isSalvarMonedas) {
            teamSalvar.total += totalCoins;
            if (!teamSalvar.donators[user]) teamSalvar.donators[user] = { coins: 0, avatar: avatarUrl, displayName: cleanName };
            teamSalvar.donators[user].avatar = avatarUrl; teamSalvar.donators[user].displayName = cleanName; teamSalvar.donators[user].coins += totalCoins;
            io.emit('poder_salvar', { side: 'salvar', amount: totalCoins });
        } else if (isReiniciarMonedas) {
            teamReiniciar.total += totalCoins;
            if (!teamReiniciar.donators[user]) teamReiniciar.donators[user] = { coins: 0, avatar: avatarUrl, displayName: cleanName };
            teamReiniciar.donators[user].avatar = avatarUrl; teamReiniciar.donators[user].displayName = cleanName; teamReiniciar.donators[user].coins += totalCoins;
            io.emit('poder_salvar', { side: 'reiniciar', amount: totalCoins });
        }

        if (configGlobal.unidades) {
            let isSalvarUnidad = configGlobal.unidades.equipo1.regalos.some(r => Number(r.id) === giftId);
            let isReiniciarUnidad = configGlobal.unidades.equipo2.regalos.some(r => Number(r.id) === giftId);
            
            if (isSalvarUnidad) {
                teamSalvarUnidades.total += cantidadAProcesar;
                lastDonatorSalvarUnid = { name: cleanName, avatar: avatarUrl };
                io.emit('poder_salvar_unidades', { side: 'salvar', amount: cantidadAProcesar });
            } else if (isReiniciarUnidad) {
                teamReiniciarUnidades.total += cantidadAProcesar;
                lastDonatorReiniciarUnid = { name: cleanName, avatar: avatarUrl };
                io.emit('poder_salvar_unidades', { side: 'reiniciar', amount: cantidadAProcesar });
            }
        }

        emitSalvarUpdate(io);
    });
}

if(configGlobal.username !== "") conectarTikTok(configGlobal.username);

io.on('connection', (socket) => {
    socket.emit('config_actual', configGlobal);
    socket.emit('actualizacion', topSorted);
    socket.emit('racha_versus_update', configGlobal.rachaVersus);
    socket.emit('sync_likes_actuales', currentTotalLikes);
    socket.emit('top_likes_data_update', configGlobal.topLikes); 
    socket.emit('top_vip_data_update', configGlobal.topVIP); 
    socket.emit('update_ultimo_seguidor', ultimoSeguidorData);
    socket.emit('update_ultimo_quiereme', ultimoQuieremeData);
    
    socket.emit('wins_ruleta_update', estadoWins);
    socket.emit('salon_fama_update', configGlobal.salonFama);

    if(configGlobal.metaLikes) {
        socket.emit('meta_likes_update', { current: currentTotalLikes, goal: configGlobal.metaLikes.currentGoal, text: configGlobal.metaLikes.actionText, prefix: configGlobal.metaLikes.prefixText, style: configGlobal.metaLikes.style });
    }
    emitSalvarUpdate(socket);

    socket.on('comando_conectar', (usuario) => { configGlobal.username = usuario.trim(); guardarEnArchivo(); conectarTikTok(configGlobal.username); });
    socket.on('comando_desconectar', () => { desconectarTikTok(); });

    socket.on('guardar_config', (nuevaConfig) => {
        nuevaConfig.historial = configGlobal.historial; nuevaConfig.username = configGlobal.username;
        nuevaConfig.regalosDisponibles = configGlobal.regalosDisponibles; 
        
        if (!nuevaConfig.equipo1.joinWords) nuevaConfig.equipo1.joinWords = configGlobal.equipo1.joinWords;
        if (!nuevaConfig.equipo2.joinWords) nuevaConfig.equipo2.joinWords = configGlobal.equipo2.joinWords;
        if (!nuevaConfig.sociales) nuevaConfig.sociales = configGlobal.sociales;

        if (configGlobal.unidades) nuevaConfig.unidades = configGlobal.unidades;
        if (configGlobal.winsRuleta) nuevaConfig.winsRuleta = configGlobal.winsRuleta;
        if (configGlobal.salonFama) nuevaConfig.salonFama = configGlobal.salonFama;

        Object.assign(configGlobal, nuevaConfig); guardarEnArchivo(); io.emit('config_actual', configGlobal); emitSalvarUpdate(io); 
    });

    socket.on('salon_fama_limpiar', () => {
        configGlobal.salonFama.record = {};
        guardarEnArchivo();
        io.emit('salon_fama_update', configGlobal.salonFama);
    });

    socket.on('salon_fama_eliminar', (userKey) => {
        delete configGlobal.salonFama.record[userKey];
        guardarEnArchivo();
        io.emit('salon_fama_update', configGlobal.salonFama);
    });

    socket.on('salon_fama_guardar_opciones', (opts) => {
        configGlobal.salonFama.displayLimit = opts.displayLimit;
        configGlobal.salonFama.alignment = opts.alignment || 'left';
        guardarEnArchivo();
        io.emit('config_actual', configGlobal);
        io.emit('salon_fama_update', configGlobal.salonFama);
    });

    socket.on('guardar_config_unidades', (data) => {
        configGlobal.unidades = data;
        guardarEnArchivo();
        io.emit('config_actual', configGlobal);
        emitSalvarUpdate(io); 
    });

    socket.on('guardar_config_sociales', (data) => {
        configGlobal.sociales = data;
        guardarEnArchivo();
        io.emit('config_actual', configGlobal);
    });

    socket.on('guardar_config_wins_ruleta', (data) => {
        configGlobal.winsRuleta = data;
        guardarEnArchivo();
        io.emit('config_actual', configGlobal);
    });

    socket.on('update_wins_estado', (data) => {
        estadoWins.actuales = parseInt(data.actuales) || 0;
        estadoWins.meta = parseInt(data.meta) || 5;
        io.emit('wins_ruleta_update', estadoWins);
    });

    socket.on('test_wins_popup', (data) => {
        io.emit('wins_ruleta_popup', data);
        estadoWins.actuales += data.amount;
        io.emit('wins_ruleta_update', estadoWins);
    });

    socket.on('test_wins_ruleta', (data) => {
        let spinId = 'test_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
        data.spinId = spinId;
        io.emit('wins_ruleta_trigger', data);
    });

    socket.on('wins_ruleta_end', (data) => {
        if (!processedSpins.has(data.spinId)) {
            processedSpins.add(data.spinId);
            estadoWins.actuales += parseInt(data.result) || 0;
            io.emit('wins_ruleta_update', estadoWins);
            if(processedSpins.size > 2000) processedSpins.clear(); 
        }
    });

    socket.on('guardar_meta_likes', (data) => {
        configGlobal.metaLikes = data.config;
        let mStep = parseInt(configGlobal.metaLikes.step) || 100;
        let mFirstGoal = parseInt(configGlobal.metaLikes.firstGoal) || 0;
        if (mFirstGoal > currentTotalLikes) { configGlobal.metaLikes.currentGoal = mFirstGoal; } else { let base = Math.floor(currentTotalLikes / mStep) * mStep; configGlobal.metaLikes.currentGoal = base + mStep; }
        configGlobal.metaLikes.step = mStep; configGlobal.metaLikes.firstGoal = mFirstGoal; 
        guardarEnArchivo(); io.emit('config_actual', configGlobal); 
        io.emit('meta_likes_update', { current: currentTotalLikes, goal: configGlobal.metaLikes.currentGoal, text: configGlobal.metaLikes.actionText, prefix: configGlobal.metaLikes.prefixText, style: configGlobal.metaLikes.style });
    });

    socket.on('force_fetch_likes', async () => {
        if (tiktokLiveConnection) {
            try {
                let roomInfo = await tiktokLiveConnection.getRoomInfo();
                let fetchedLikes = 0;
                
                if (roomInfo && roomInfo.like_count) fetchedLikes = parseInt(roomInfo.like_count);
                else if (roomInfo && roomInfo.data && roomInfo.data.like_count) fetchedLikes = parseInt(roomInfo.data.like_count);
                else if (roomInfo && roomInfo.stats && roomInfo.stats.likeCount) fetchedLikes = parseInt(roomInfo.stats.likeCount);

                if (!isNaN(fetchedLikes)) {
                    currentTotalLikes = fetchedLikes;
                    io.emit('sync_likes_actuales', currentTotalLikes);
                }
            } catch (error) {}
        }
    });

    socket.on('top_cerrar_ambas_rondas', () => { cerrarRondasGlobales(); });

    socket.on('top_likes_limpiar_ronda', () => { configGlobal.topLikes.currentRound = {}; guardarEnArchivo(); io.emit('top_likes_data_update', configGlobal.topLikes); });
    socket.on('top_likes_eliminar_ronda', (userKey) => { delete configGlobal.topLikes.currentRound[userKey]; guardarEnArchivo(); io.emit('top_likes_data_update', configGlobal.topLikes); });
    socket.on('top_likes_guardar_opciones', (opts) => { 
        configGlobal.topLikes.mirrorMode = opts.mirrorMode; 
        guardarEnArchivo(); 
        io.emit('config_actual', configGlobal); 
        io.emit('top_likes_data_update', configGlobal.topLikes); 
    });

    socket.on('top_vip_limpiar_ronda', () => { configGlobal.topVIP.currentRound = {}; guardarEnArchivo(); io.emit('top_vip_data_update', configGlobal.topVIP); });
    socket.on('top_vip_limpiar_historial', () => { configGlobal.topVIP.recordHistorico = {}; guardarEnArchivo(); io.emit('top_vip_data_update', configGlobal.topVIP); });
    socket.on('top_vip_eliminar_ronda', (userKey) => { delete configGlobal.topVIP.currentRound[userKey]; guardarEnArchivo(); io.emit('top_vip_data_update', configGlobal.topVIP); });
    socket.on('top_vip_eliminar_historial', (userKey) => { 
        delete configGlobal.topVIP.recordHistorico[userKey]; 
        guardarEnArchivo(); 
        io.emit('top_vip_data_update', configGlobal.topVIP); 
    });
    socket.on('top_vip_ajuste_historial', (data) => { 
        let hist = configGlobal.topVIP.recordHistorico[data.userKey]; 
        if(hist) { 
            hist.wins += data.amount; if(hist.wins < 0) hist.wins = 0; 
            if(hist.wins === 0) hist.streak = 0; 
            guardarEnArchivo(); 
            io.emit('top_vip_data_update', configGlobal.topVIP); 
        } 
    });
    socket.on('top_vip_ajuste_racha', (data) => { 
        let hist = configGlobal.topVIP.recordHistorico[data.userKey]; 
        if(hist) { 
            hist.streak = (hist.streak || 0) + data.amount; 
            if(hist.streak < 0) hist.streak = 0; 
            guardarEnArchivo(); 
            io.emit('top_vip_data_update', configGlobal.topVIP); 
        } 
    });
    socket.on('top_vip_ajuste_ronda', (data) => { let ronda = configGlobal.topVIP.currentRound[data.userKey]; if(ronda) { ronda.coins += data.amount; if(ronda.coins < 0) ronda.coins = 0; guardarEnArchivo(); io.emit('top_vip_data_update', configGlobal.topVIP); } });
    socket.on('top_vip_guardar_opciones', (opts) => { 
        configGlobal.topVIP.displayLimit = opts.displayLimit; 
        configGlobal.topVIP.mirrorMode = opts.mirrorMode; 
        guardarEnArchivo(); 
        io.emit('config_actual', configGlobal); 
        io.emit('top_vip_data_update', configGlobal.topVIP); 
    });

    socket.on('guardar_config_bolita', (bolitaConfig) => { configGlobal.bolita = bolitaConfig; guardarEnArchivo(); io.emit('config_actual', configGlobal); });
    
    socket.on('modificar_puntos_equipo', (data) => {
        let cantidad = parseInt(data.cantidad) || 0;
        if (cantidad === 0) return;

        if (data.equipo === 1) { 
            teamSalvar.total += cantidad; 
            if (teamSalvar.total < 0) teamSalvar.total = 0; 
            if (!teamSalvar.donators['MANUAL']) teamSalvar.donators['MANUAL'] = { coins: 0, avatar: '', displayName: 'MANUAL' };
            teamSalvar.donators['MANUAL'].coins += cantidad;
        } 
        else if (data.equipo === 2) { 
            teamReiniciar.total += cantidad; 
            if (teamReiniciar.total < 0) teamReiniciar.total = 0; 
            if (!teamReiniciar.donators['MANUAL']) teamReiniciar.donators['MANUAL'] = { coins: 0, avatar: '', displayName: 'MANUAL' };
            teamReiniciar.donators['MANUAL'].coins += cantidad;
        }
        emitSalvarUpdate(io);
        if (cantidad > 0) io.emit('poder_salvar', { side: data.equipo === 1 ? 'salvar' : 'reiniciar', amount: cantidad });
    });

    socket.on('modificar_puntos_unidades', (data) => {
        let cantidad = parseInt(data.cantidad) || 0;
        if (cantidad === 0) return;

        if (data.equipo === 1) { 
            teamSalvarUnidades.total += cantidad; 
            if (teamSalvarUnidades.total < 0) teamSalvarUnidades.total = 0; 
            lastDonatorSalvarUnid = { name: 'MANUAL', avatar: '' };
        } 
        else if (data.equipo === 2) { 
            teamReiniciarUnidades.total += cantidad; 
            if (teamReiniciarUnidades.total < 0) teamReiniciarUnidades.total = 0; 
            lastDonatorReiniciarUnid = { name: 'MANUAL', avatar: '' };
        }
        emitSalvarUpdate(io);
        if (cantidad > 0) io.emit('poder_salvar_unidades', { side: data.equipo === 1 ? 'salvar' : 'reiniciar', amount: cantidad });
    });

    socket.on('importar_catalogo', (nuevoData) => {
        if (Array.isArray(nuevoData)) {
            nuevoData.forEach(item => { let idx = catalogoGlobal.findIndex(g => g.id === item.id); if (idx === -1) catalogoGlobal.push(item); else catalogoGlobal[idx] = { ...catalogoGlobal[idx], ...item }; });
            catalogoGlobal.sort((a, b) => a.diamonds - b.diamonds); configGlobal.regalosDisponibles = catalogoGlobal;
            guardarEnArchivo(); io.emit('config_actual', configGlobal);
        }
    });
    socket.on('importar_historial', (nuevoData) => {
        if (typeof nuevoData === 'object' && nuevoData !== null && !Array.isArray(nuevoData)) {
            let userActivo = configGlobal.username;
            configGlobal = { ...configGlobal, ...nuevoData };
            if(userActivo) configGlobal.username = userActivo;
            guardarEnArchivo(); io.emit('config_actual', configGlobal); io.emit('racha_versus_update', configGlobal.rachaVersus);
        }
    });
    socket.on('agregar_regalo_manual', (nuevoRegalo) => {
        let index = catalogoGlobal.findIndex(g => g.id === nuevoRegalo.id);
        if (index === -1) catalogoGlobal.push(nuevoRegalo); else catalogoGlobal[index] = nuevoRegalo;
        catalogoGlobal.sort((a, b) => a.diamonds - b.diamonds); configGlobal.regalosDisponibles = catalogoGlobal;
        guardarEnArchivo(); io.emit('config_actual', configGlobal);
    });
    socket.on('eliminar_regalo_catalogo', (id) => {
        catalogoGlobal = catalogoGlobal.filter(g => g.id !== id); configGlobal.regalosDisponibles = catalogoGlobal;
        configGlobal.equipo1.regalos = configGlobal.equipo1.regalos.filter(g => g.id !== id); configGlobal.equipo2.regalos = configGlobal.equipo2.regalos.filter(g => g.id !== id);
        guardarEnArchivo(); io.emit('config_actual', configGlobal);
    });
    
    socket.on('reset', () => {
        teamSalvar = { total: 0, donators: {} }; 
        teamReiniciar = { total: 0, donators: {} };
        userTeams = {}; 
        emitSalvarUpdate(io);
    });

    socket.on('reset_unidades', () => {
        teamSalvarUnidades = { total: 0 }; 
        teamReiniciarUnidades = { total: 0 };
        lastDonatorSalvarUnid = { name: 'ESPERANDO', avatar: '' };
        lastDonatorReiniciarUnid = { name: 'ESPERANDO', avatar: '' };
        emitSalvarUpdate(io);
    });

    socket.on('registrar_victoria_versus', (data) => {
        let tipo = data.tipo; let user = data.user;
        if(!user || !user.name || user.name === 'ESPERANDO' || user.name === 'MANUAL') return;
        let targetObj = tipo === 'salvada' ? configGlobal.rachaVersus.salvadas : configGlobal.rachaVersus.reinicios;
        if(!targetObj[user.name]) targetObj[user.name] = { avatar: user.avatar, displayName: user.name, count: 0 };
        targetObj[user.name].count += 1; targetObj[user.name].avatar = user.avatar;
        guardarEnArchivo(); io.emit('racha_versus_update', configGlobal.rachaVersus);
    });
    socket.on('racha_versus_ajuste', (data) => {
        let targetObj = data.tipo === 'salvadas' ? configGlobal.rachaVersus.salvadas : configGlobal.rachaVersus.reinicios;
        if(targetObj[data.name]) { targetObj[data.name].count += data.amount; if(targetObj[data.name].count < 0) targetObj[data.name].count = 0; guardarEnArchivo(); io.emit('racha_versus_update', configGlobal.rachaVersus); }
    });
    socket.on('racha_versus_eliminar', (data) => {
        let targetObj = data.tipo === 'salvadas' ? configGlobal.rachaVersus.salvadas : configGlobal.rachaVersus.reinicios;
        if(targetObj[data.name]) { delete targetObj[data.name]; guardarEnArchivo(); io.emit('racha_versus_update', configGlobal.rachaVersus); }
    });
    socket.on('racha_versus_limpiar', (tipo) => {
        if(tipo === 'salvadas') configGlobal.rachaVersus.salvadas = {}; else configGlobal.rachaVersus.reinicios = {};
        guardarEnArchivo(); io.emit('racha_versus_update', configGlobal.rachaVersus);
    });
    socket.on('racha_versus_guardar_opciones', (opts) => {
        configGlobal.rachaVersus.showName = opts.showName; 
        configGlobal.rachaVersus.showCount = opts.showCount; 
        configGlobal.rachaVersus.showCoins = opts.showCoins;
        guardarEnArchivo(); io.emit('racha_versus_update', configGlobal.rachaVersus);
    });
    
    socket.on('racha_versus_clear_visual', () => {
        io.emit('racha_versus_clear_visual');
    });

    socket.on('test_ultimo_seguidor', () => {
        ultimoSeguidorData = { name: "UsuarioPrueba", avatar: "https://via.placeholder.com/150/00f2fe/fff?text=TEST" };
        io.emit('update_ultimo_seguidor', ultimoSeguidorData);
    });

    socket.on('test_ultimo_quiereme', () => {
        ultimoQuieremeData = { name: "FanNumero1", avatar: "https://via.placeholder.com/150/ff0055/fff?text=TEST" };
        io.emit('update_ultimo_quiereme', ultimoQuieremeData);
    });
});

setupGameEvents(io, configGlobal);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🚀 Servidor encendido en el puerto ${PORT}`);
});