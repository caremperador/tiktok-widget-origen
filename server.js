const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, { cors: { origin: "*" }, maxHttpBufferSize: 1e8 });
const { WebcastPushConnection } = require('tiktok-live-connector');
const https = require('https');
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
app.get('/top_guerreros', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'top_guerreros.html')));
app.get('/ultimo_seguidor', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'ultimo_seguidor.html')));
app.get('/ultimo_quiereme', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'ultimo_quiereme.html')));
app.get('/wins_ruleta', (req, res) => res.sendFile(path.join(__dirname, 'overlays', 'wins_ruleta.html')));

// Variables 100% en RAM (Nunca ensucian ni inflan data.json)
let topLikesMemoryRound = {}; 
let topVIPMemoryRound = {};
let teamSalvar = { total: 0, donators: {} };
let teamReiniciar = { total: 0, donators: {} };

// Unidades Normales y Súper Unidades en RAM
let teamSalvarUnidades = { total: 0 };
let teamReiniciarUnidades = { total: 0 };
let lastDonatorSalvarUnid = { name: 'ESPERANDO', avatar: '' };
let lastDonatorReiniciarUnid = { name: 'ESPERANDO', avatar: '' };

let teamSuperSalvarUnidades = { total: 0 };
let teamSuperReiniciarUnidades = { total: 0 };
let lastDonatorSuperSalvar = { name: 'ESPERANDO', avatar: '' };
let lastDonatorSuperReiniciar = { name: 'ESPERANDO', avatar: '' };

let catalogoGlobal = [];
let regalosDetectadosCuenta = [];
let currentRoomId = null;
let currentTotalLikes = 0; 
let userTeams = {}; 

let ultimoSeguidorData = { name: "ESPERANDO...", avatar: "" };
let ultimoQuieremeData = { name: "ESPERANDO...", avatar: "" };
let recentFollowers = new Set(); 

let estadoWins = { actuales: 0, meta: 5 };
const ruletaSpunUsers = new Set();
const processedSpins = new Set(); 

const regalosEq1Defecto = [{ id: 6064, name: "GG", diamonds: 1, image: "" }];
const regalosEq2Defecto = [{ id: 5655, name: "Rose", diamonds: 1, image: "" }];

let configGlobal = {
    username: "",
    historial: [],
    hidePowerBar: true,
    equipo1: { nombre: "SALVAR", sub: "SALVAR", color: "#00ff66", regalos: regalosEq1Defecto, joinWords: "chicos, heroes, salvar, 1" },
    equipo2: { nombre: "REINICIAR", sub: "RESET", color: "#ff003c", regalos: regalosEq2Defecto, joinWords: "chicas, villanos, reiniciar, 2" },
    battleStyle: {
        fontFamily: "'Luckiest Guy', cursive",
        textStroke: 1.5,
        shadowOpacity: 1.0,
        shadowDistance: 4,
        colorL1: "#ff5e5e",
        sizeL1: 46,
        colorL2: "#ff003c",
        sizeL2: 45,
        colorTimer: "#ffffff",
        sizeTimer: 92,
        hidePowerBar: true
    },
    unidades: {
        normalEnabled: true,
        equipo1: { nombre: "EQUIPO 1", actionText: "SALVAR", color: "#00ff66", regalos: [] },
        equipo2: { nombre: "EQUIPO 2", actionText: "RESET", color: "#ff003c", regalos: [] },
        enableCountdown: true,
        countdownSeconds: 60,
        superReset: {
            enabled: true,
            countdownSeconds: 30,
            customText: "SALVAR",
            displayMode: "auto",
            regalosSalvar: [],
            regalosReiniciar: []
        },
        battleStyle: { 
            fontFamily: "'Luckiest Guy', cursive", 
            textStroke: 2.5, 
            shadowOpacity: 0.85, 
            shadowDistance: 4, 
            colorL1: "#ffea00", 
            sizeL1: 52, 
            colorL2: "#ff0055", 
            sizeL2: 30, 
            colorTimer: "#ffffff", 
            sizeTimer: 82,
            superScale: 100
        }
    },
    enableCountdown: true,
    countdownSeconds: 30,
    showTopText: false,
    showDonatorCoins: true,
    showEmoticons: true,
    roundGifts: true,
    showTopDonators: true,
    regalosDisponibles: [],
    rachaVersus: { salvadas: {}, reinicios: {}, showName: true, showCount: true, showCoins: true, mirrorMode: false },
    bolita: { multiplicador: 2, chatWord: "globos, jugar", chatGlobos: 1, chatCooldown: 60, likesMeta: 50, likesGlobos: 1, followGlobos: 5, followCooldown: 300, allowFree: true, quiereMeGlobos: 60 },
    metaLikes: { active: false, firstGoal: 0, step: 20000, prefixText: "A los", actionText: "REINICIO", currentGoal: 20000, style: { fontSize: 45, color: "#ffffff", shadowColor: "#ff003c", fontFamily: "'Luckiest Guy', cursive" } },
    topLikes: { mirrorMode: false, keepOnGlobalClose: false },
    topVIP: { recordHistorico: {}, displayLimit: 2, mirrorMode: false },
    sociales: { followRequiresChat: false, followChatWord: "yo" },
    winsRuleta: { regalosSumar: [], regalosRestar: [], cooldown: 3600, probabilidad: 50 },
    salonFama: { record: {}, displayLimit: 5, alignment: 'left', minCoins: 10 }
};

if (fs.existsSync(pathData)) {
    try { 
        let guardado = JSON.parse(fs.readFileSync(pathData, 'utf8')); 
        configGlobal = { ...configGlobal, ...guardado };

        // Eliminar basura antigua de racha o likes guardados en disco
        delete configGlobal.racha;
        if (configGlobal.topLikes) {
            delete configGlobal.topLikes.currentRound;
            if (configGlobal.topLikes.keepOnGlobalClose === undefined) configGlobal.topLikes.keepOnGlobalClose = false;
        }
        if (configGlobal.topVIP) {
            delete configGlobal.topVIP.currentRound;
            let limpios = {};
            for (const [k, v] of Object.entries(configGlobal.topVIP.recordHistorico || {})) {
                if (v && (v.wins > 0 || v.streak > 0)) limpios[k] = v;
            }
            configGlobal.topVIP.recordHistorico = limpios;
        }
        if (!configGlobal.salonFama) configGlobal.salonFama = { record: {}, displayLimit: 5, alignment: 'left', minCoins: 10 };
        if (configGlobal.salonFama.minCoins === undefined) configGlobal.salonFama.minCoins = 10;

        if (!configGlobal.rachaVersus) configGlobal.rachaVersus = { salvadas: {}, reinicios: {}, showName: true, showCount: true, showCoins: true, mirrorMode: false };
        if (configGlobal.rachaVersus.mirrorMode === undefined) configGlobal.rachaVersus.mirrorMode = false;
    } catch (e) {}
}

if (fs.existsSync(pathCatalogo)) {
    try { catalogoGlobal = JSON.parse(fs.readFileSync(pathCatalogo, 'utf8')); } catch (e) {}
}
if (!Array.isArray(catalogoGlobal) || catalogoGlobal.length === 0) {
    catalogoGlobal = [...regalosEq1Defecto, ...regalosEq2Defecto].sort((a, b) => a.diamonds - b.diamonds);
}
configGlobal.regalosDisponibles = catalogoGlobal;

let saveTimeout = null;
function guardarEnArchivo(inmediato = false) {
    const escribir = () => {
        try {
            // Clon ligero sin meter el catálogo gigante ni rondas temporales dentro de data.json
            const dataToSave = { ...configGlobal };
            delete dataToSave.regalosDisponibles;
            if (dataToSave.topLikes) delete dataToSave.topLikes.currentRound;
            if (dataToSave.topVIP) delete dataToSave.topVIP.currentRound;

            fs.writeFileSync(pathData, JSON.stringify(dataToSave, null, 2));
            fs.writeFileSync(pathCatalogo, JSON.stringify(catalogoGlobal, null, 2));
        } catch (err) {}
    };
    if (inmediato) {
        if (saveTimeout) clearTimeout(saveTimeout);
        escribir();
    } else {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(escribir, 800);
    }
}

function getTopLikesPayload() {
    return {
        currentRound: topLikesMemoryRound,
        mirrorMode: configGlobal.topLikes?.mirrorMode || false,
        keepOnGlobalClose: configGlobal.topLikes?.keepOnGlobalClose || false
    };
}

function getTopVIPPayload() {
    return {
        currentRound: topVIPMemoryRound,
        recordHistorico: configGlobal.topVIP?.recordHistorico || {},
        displayLimit: configGlobal.topVIP?.displayLimit || 2,
        mirrorMode: configGlobal.topVIP?.mirrorMode || false
    };
}

function sincronizarImagenesAsignadas() {
    const mapaCatalogo = new Map(catalogoGlobal.map(g => [Number(g.id), g]));
    const actualizarLista = (arr) => {
        if (!Array.isArray(arr)) return;
        arr.forEach(item => {
            const encontrado = mapaCatalogo.get(Number(item.id));
            if (encontrado) {
                if (encontrado.image && encontrado.image.trim() !== "") item.image = encontrado.image;
                item.name = encontrado.name || item.name;
                item.diamonds = encontrado.diamonds || item.diamonds;
            }
        });
    };

    if (configGlobal.equipo1) actualizarLista(configGlobal.equipo1.regalos);
    if (configGlobal.equipo2) actualizarLista(configGlobal.equipo2.regalos);
    if (configGlobal.unidades) {
        if (configGlobal.unidades.equipo1) actualizarLista(configGlobal.unidades.equipo1.regalos);
        if (configGlobal.unidades.equipo2) actualizarLista(configGlobal.unidades.equipo2.regalos);
        if (configGlobal.unidades.superReset) {
            actualizarLista(configGlobal.unidades.superReset.regalosSalvar);
            actualizarLista(configGlobal.unidades.superReset.regalosReiniciar);
        }
    }
    if (configGlobal.winsRuleta) {
        actualizarLista(configGlobal.winsRuleta.regalosSumar);
        actualizarLista(configGlobal.winsRuleta.regalosRestar);
    }
}

sincronizarImagenesAsignadas();
guardarEnArchivo(true);

function fetchRegalosDirectoAPI(roomId) {
    return new Promise((resolve) => {
        const roomParam = roomId ? `&room_id=${roomId}` : '';
        const url = `https://webcast.tiktok.com/webcast/gift/list/?aid=1988&app_language=es&app_name=tiktok_web&browser_language=es${roomParam}`;
        
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        }, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(raw);
                    const gifts = (parsed && parsed.data && (parsed.data.gifts || parsed.data.pages)) ? (parsed.data.gifts || []) : [];
                    resolve(gifts);
                } catch (e) {
                    resolve([]);
                }
            });
        }).on('error', () => resolve([]));
    });
}

function extraerMejorImagenRegalo(g) {
    if (!g) return "";
    const candidatos = [
        g.image?.url_list?.[0],
        g.image?.urlList?.[0],
        g.icon?.url_list?.[0],
        g.icon?.urlList?.[0],
        g.giftPictureUrl,
        g.pictureUrl,
        g.icon_url,
        g.image_url,
        typeof g.image === 'string' ? g.image : null,
        typeof g.icon === 'string' ? g.icon : null
    ];

    for (const url of candidatos) {
        if (typeof url === 'string' && url.trim().startsWith('http')) {
            return url.trim();
        }
    }
    return "";
}

async function obtenerRegalosDeCuentaTikTok(connectionInstance, roomIdOpcional = null) {
    let rawGifts = [];
    let roomId = roomIdOpcional || currentRoomId || (connectionInstance && connectionInstance.roomId) || null;

    if (connectionInstance && typeof connectionInstance.fetchAvailableGifts === 'function') {
        try { rawGifts = await connectionInstance.fetchAvailableGifts(); } catch (e) {}
    }
    if ((!Array.isArray(rawGifts) || rawGifts.length === 0) && connectionInstance && typeof connectionInstance.getAvailableGifts === 'function') {
        try { rawGifts = await connectionInstance.getAvailableGifts(); } catch (e) {}
    }
    if ((!Array.isArray(rawGifts) || rawGifts.length === 0) && connectionInstance && connectionInstance.webClient && typeof connectionInstance.webClient.getJsonObjectFromWebcastApi === 'function') {
        try {
            const apiRes = await connectionInstance.webClient.getJsonObjectFromWebcastApi('gift/list/', roomId ? { room_id: roomId } : {});
            if (apiRes && apiRes.data && Array.isArray(apiRes.data.gifts)) rawGifts = apiRes.data.gifts;
        } catch (e) {}
    }
    if (!Array.isArray(rawGifts) || rawGifts.length === 0) {
        rawGifts = await fetchRegalosDirectoAPI(roomId);
    }
    if (!Array.isArray(rawGifts) || rawGifts.length === 0) return [];

    const procesados = [];
    const vistos = new Set();

    const extraerDeLista = (lista) => {
        if (!Array.isArray(lista)) return;
        lista.forEach(g => {
            if (!g) return;
            if (Array.isArray(g.gifts)) { extraerDeLista(g.gifts); return; }
            const id = parseInt(g.id || g.gift_id || g.giftId);
            if (!id || vistos.has(id)) return;
            vistos.add(id);

            const name = (g.name || g.giftName || g.describe || `Regalo ${id}`).trim();
            const diamonds = parseInt(g.diamond_count !== undefined ? g.diamond_count : (g.diamondCount !== undefined ? g.diamondCount : g.diamonds)) || 1;
            const image = extraerMejorImagenRegalo(g);

            procesados.push({ id, name, diamonds, image });
        });
    };

    extraerDeLista(rawGifts);
    procesados.sort((a, b) => a.diamonds - b.diamonds || a.id - b.id);
    regalosDetectadosCuenta = procesados;

    guardarListaRegalosEnCatalogo(regalosDetectadosCuenta);

    io.emit('regalos_cuenta_detectados', {
        cuenta: configGlobal.username,
        total: regalosDetectadosCuenta.length,
        regalos: regalosDetectadosCuenta
    });

    return regalosDetectadosCuenta;
}

function guardarListaRegalosEnCatalogo(listaRegalos) {
    if (!Array.isArray(listaRegalos) || listaRegalos.length === 0) return { guardados: 0, total: catalogoGlobal.length };

    let nuevosOActualizados = 0;
    const mapaActual = new Map(catalogoGlobal.map(g => [Number(g.id), g]));

    listaRegalos.forEach(nuevo => {
        const id = parseInt(nuevo.id);
        if (!id) return;

        const existente = mapaActual.get(id);
        if (!existente) {
            const nuevoObj = {
                id: id,
                name: nuevo.name || `Regalo ${id}`,
                diamonds: parseInt(nuevo.diamonds) || 1,
                image: nuevo.image || ""
            };
            catalogoGlobal.push(nuevoObj);
            mapaActual.set(id, nuevoObj);
            nuevosOActualizados++;
        } else {
            existente.name = nuevo.name || existente.name;
            existente.diamonds = parseInt(nuevo.diamonds) || existente.diamonds;
            if (nuevo.image && nuevo.image.trim() !== "") existente.image = nuevo.image;
            nuevosOActualizados++;
        }
    });

    catalogoGlobal.sort((a, b) => a.diamonds - b.diamonds || a.id - b.id);
    configGlobal.regalosDisponibles = catalogoGlobal;
    sincronizarImagenesAsignadas();
    guardarEnArchivo(true);
    
    io.emit('catalogo_actualizado', catalogoGlobal);
    io.emit('config_actual', configGlobal);

    return { guardados: nuevosOActualizados, total: catalogoGlobal.length };
}

// 🌟 CERRAR RONDA GLOBAL: Cierra Top Donadores y formatea Top Likes en memoria salvo que keepOnGlobalClose esté activo
function cerrarRondasGlobales() {
    let seGuardoVIP = false;

    // 1. Si Top Likes NO tiene activado "Mantener likes", se formatea a 0 en RAM
    if (!configGlobal.topLikes?.keepOnGlobalClose) {
        topLikesMemoryRound = {};
        io.emit('top_likes_data_update', getTopLikesPayload());
    }

    // 2. Procesar ganador de Top Donadores VIP
    let arrVIPs = Object.entries(topVIPMemoryRound).map(([u, d]) => ({userKey: u, ...d})).sort((a,b) => b.coins - a.coins);
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
            }
        }
        topVIPMemoryRound = {}; 
        seGuardoVIP = true;
    }

    if (seGuardoVIP) {
        guardarEnArchivo(true); 
    }
    io.emit('top_vip_data_update', getTopVIPPayload()); 
}

let tiktokLiveConnection = null;
let desconexionIntencional = false;
const regalosProcesados = new Set();
const combosActivos = new Map(); 

// Emisión de Top Likes con throttle ligero (máximo 1 actualización cada 400ms para no saturar sockets)
let likesEmitTimer = null;
function emitTopLikesThrottled() {
    if (likesEmitTimer) return;
    likesEmitTimer = setTimeout(() => {
        likesEmitTimer = null;
        io.emit('top_likes_data_update', getTopLikesPayload());
    }, 400);
}

function getSortedTeamDonators() {
    let listSalvar = Object.entries(teamSalvar.donators)
        .filter(([k]) => k !== 'MANUAL')
        .map(([userKey, info]) => ({ userKey, name: info.displayName, coins: info.coins, avatar: info.avatar }))
        .sort((a, b) => b.coins - a.coins);

    let listReiniciar = Object.entries(teamReiniciar.donators)
        .filter(([k]) => k !== 'MANUAL')
        .map(([userKey, info]) => ({ userKey, name: info.displayName, coins: info.coins, avatar: info.avatar }))
        .sort((a, b) => b.coins - a.coins);

    return {
        topSalvar: listSalvar[0] || { name: 'ESPERANDO', coins: 0, avatar: '' },
        topReiniciar: listReiniciar[0] || { name: 'ESPERANDO', coins: 0, avatar: '' },
        donatorsSalvar: listSalvar.slice(0, 15),
        donatorsReiniciar: listReiniciar.slice(0, 15)
    };
}

function emitSalvarUpdate(target) {
    const { topSalvar, topReiniciar, donatorsSalvar, donatorsReiniciar } = getSortedTeamDonators();
    
    target.emit('actualizacion_salvar', {
        totalSalvar: teamSalvar.total,
        totalReiniciar: teamReiniciar.total,
        topSalvar,
        topReiniciar,
        donatorsSalvar,
        donatorsReiniciar
    });

    target.emit('actualizacion_unidades', { 
        totalSalvar: teamSalvarUnidades.total, 
        totalReiniciar: teamReiniciarUnidades.total, 
        topSalvar: lastDonatorSalvarUnid, 
        topReiniciar: lastDonatorReiniciarUnid,
        totalSuperSalvar: teamSuperSalvarUnidades.total,
        totalSuperReiniciar: teamSuperReiniciarUnidades.total,
        topSuperSalvar: lastDonatorSuperSalvar,
        topSuperReiniciar: lastDonatorSuperReiniciar
    });
}

function desconectarTikTok() {
    if (tiktokLiveConnection) {
        desconexionIntencional = true;
        try { tiktokLiveConnection.disconnect(); } catch (e) {}
        tiktokLiveConnection = null;
        currentRoomId = null;
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

    connectionInstance.connect().then(async (state) => {
        currentRoomId = (state && state.roomId) ? state.roomId : connectionInstance.roomId;

        if (state && Array.isArray(state.availableGifts) && state.availableGifts.length > 0) {
            await obtenerRegalosDeCuentaTikTok({ fetchAvailableGifts: async () => state.availableGifts }, currentRoomId);
        }

        io.emit('estado_conexion', { estado: 'conectado', msg: `🟢 Conectado a @${userLimpio} | 📡 Sincronizando regalos...` });
        if (!configGlobal.historial.includes(userLimpio)) {
            configGlobal.historial.unshift(userLimpio);
            if (configGlobal.historial.length > 10) configGlobal.historial.pop();
            guardarEnArchivo();
        }
        io.emit('config_actual', configGlobal);

        const detectados = regalosDetectadosCuenta.length > 0
            ? regalosDetectadosCuenta
            : await obtenerRegalosDeCuentaTikTok(connectionInstance, currentRoomId);

        if (detectados.length > 0) {
            io.emit('estado_conexion', { estado: 'conectado', msg: `🟢 Conectado a @${userLimpio} | 🎁 ${detectados.length} Regalos Listos` });
        } else {
            io.emit('estado_conexion', { estado: 'conectado', msg: `🟢 Conectado a @${userLimpio} | 📡 Radar Activo` });
        }

    }).catch(async (err) => {
        await obtenerRegalosDeCuentaTikTok(connectionInstance);
        io.emit('estado_conexion', { estado: 'error', msg: `❌ Error: ${err.message}` });
    });

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
        let texto = (data.comment || "").toLowerCase();
        let user = data.uniqueId;
        
        if (configGlobal.sociales && configGlobal.sociales.followRequiresChat) {
            let requiredWord = (configGlobal.sociales.followChatWord || "yo").toLowerCase().trim();
            if (texto.trim() === requiredWord && recentFollowers.has(user)) {
                let cleanName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || data.uniqueId;
                if (cleanName.length > 18) cleanName = cleanName.substring(0, 18) + "...";
                let avatarUrl = (data.userDetails?.profilePictureUrls?.[0]) || "";
                
                ultimoSeguidorData = { name: cleanName, avatar: avatarUrl };
                io.emit('update_ultimo_seguidor', ultimoSeguidorData);
                recentFollowers.delete(user); 
            }
        }

        let wordsEq1 = (configGlobal.equipo1.joinWords || "chicos, heroes, salvar, 1").toLowerCase().split(',').map(w=>w.trim()).filter(w=>w.length > 0);
        let wordsEq2 = (configGlobal.equipo2.joinWords || "chicas, villanos, reiniciar, 2").toLowerCase().split(',').map(w=>w.trim()).filter(w=>w.length > 0);

        if (wordsEq1.some(w => texto.includes(w))) userTeams[user] = 1;
        else if (wordsEq2.some(w => texto.includes(w))) userTeams[user] = 2;
    });

    connectionInstance.on('like', data => {
        let totalTikTok = parseInt(data.totalLikeCount);
        let batchLikes = parseInt(data.likeCount) || 1;

        if (!isNaN(totalTikTok) && totalTikTok > currentTotalLikes) currentTotalLikes = totalTikTok;
        else currentTotalLikes += batchLikes;
        
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

        // 🌟 TOP LIKES 100% EN MEMORIA RAM (Cero escritura en disco)
        let user = data.uniqueId;
        let cleanName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || user;
        if (cleanName.length > 12) cleanName = cleanName.substring(0, 12) + "...";
        let avatarUrl = data.profilePictureUrl || (data.userDetails?.profilePictureUrls?.[0]) || "";

        if (!topLikesMemoryRound[user]) {
            topLikesMemoryRound[user] = { likes: 0, avatar: avatarUrl, displayName: cleanName };
        } else {
            topLikesMemoryRound[user].avatar = avatarUrl;
            topLikesMemoryRound[user].displayName = cleanName;
        }
        topLikesMemoryRound[user].likes += batchLikes;
        
        emitTopLikesThrottled();
    });

    connectionInstance.on('follow', data => {
        let user = data.uniqueId;
        let cleanName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || data.uniqueId;
        if (cleanName.length > 18) cleanName = cleanName.substring(0, 18) + "...";
        let avatarUrl = (data.userDetails?.profilePictureUrls?.[0]) || "";

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
                let chosenArray = (Math.random() * 100 < probPositiva) ? posOptions : negOptions;
                let result = chosenArray[Math.floor(Math.random() * chosenArray.length)];
                let spinId = 'spin_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
                
                io.emit('wins_ruleta_trigger', { spinId, name: cleanName, avatar: avatarUrl, result });
            }
        }
    });

    connectionInstance.on('gift', data => {
        let user = data.uniqueId;
        let cleanName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || user; 
        if (cleanName.length > 12) cleanName = cleanName.substring(0, 12) + "...";
        
        let avatarUrl = (data.userDetails?.profilePictureUrls?.[0]) || "";
        let giftId = parseInt(data.giftId) || 0; 
        let giftName = data.giftName || "Regalo";
        let unitPrice = parseInt(data.diamondCount) || 0; 
        
        let giftImgUrl = data.giftPictureUrl || data.extendedGiftInfo?.image?.url_list?.[0] || data.gift?.image?.url_list?.[0] || "";

        if (giftId === 7934) {
            let fullName = (data.nickname || data.uniqueId).replace(/[^a-zA-Z0-9\sÁÉÍÓÚáéíóúÑñ]/g, '').trim() || data.uniqueId;
            if (fullName.length > 18) fullName = fullName.substring(0, 18) + "...";
            ultimoQuieremeData = { name: fullName, avatar: avatarUrl };
            io.emit('update_ultimo_quiereme', ultimoQuieremeData);
        }

        let knownGift = catalogoGlobal.find(g => Number(g.id) === giftId);
        if (knownGift) { 
            unitPrice = knownGift.diamonds; 
            if ((!knownGift.image || knownGift.image.trim() === "") && giftImgUrl !== "") {
                knownGift.image = giftImgUrl;
                sincronizarImagenesAsignadas();
                guardarEnArchivo();
            }
        } else {
            let nuevoRegalo = { id: giftId, name: giftName, diamonds: unitPrice, image: giftImgUrl };
            catalogoGlobal.push(nuevoRegalo);
            catalogoGlobal.sort((a, b) => a.diamonds - b.diamonds);
            configGlobal.regalosDisponibles = catalogoGlobal;
            guardarEnArchivo();
        }

        if (configGlobal.roundGifts && unitPrice % 10 === 9) unitPrice += 1;

        let cantidadAProcesar = 0;

        if (data.giftType === 1) {
            let comboId = data.groupId || data.msgId; 
            let countAnterior = combosActivos.get(comboId) || 0;
            let nuevoCount = parseInt(data.repeatCount) || 1; 
            let diferencia = nuevoCount - countAnterior;

            if (diferencia <= 0) return; 
            cantidadAProcesar = diferencia; 
            combosActivos.set(comboId, nuevoCount);

            if (data.repeatEnd) setTimeout(() => combosActivos.delete(comboId), 10000);
        } else {
            let huellaRegalo = data.msgId || (data.uniqueId + data.timestamp);
            if (regalosProcesados.has(huellaRegalo)) return; 
            regalosProcesados.add(huellaRegalo);
            if (regalosProcesados.size > 1000) regalosProcesados.clear(); 
            
            cantidadAProcesar = parseInt(data.repeatCount) || 1; 
        }

        if (isNaN(cantidadAProcesar) || cantidadAProcesar <= 0) return;
        const totalCoins = unitPrice * cantidadAProcesar;

        // Wins Ruleta
        if (configGlobal.winsRuleta) {
            let isSumarWins = configGlobal.winsRuleta.regalosSumar.some(r => Number(r.id) === giftId);
            let isRestarWins = configGlobal.winsRuleta.regalosRestar.some(r => Number(r.id) === giftId);

            if (isSumarWins || isRestarWins) {
                let winChange = isSumarWins ? totalCoins : -totalCoins;
                estadoWins.actuales += winChange;
                io.emit('wins_ruleta_update', estadoWins);
                io.emit('wins_ruleta_popup', { name: cleanName, avatar: avatarUrl, amount: winChange, type: isSumarWins ? 'sumar' : 'restar' });
            }
        }

        // 🌟 SALÓN DE LA FAMA OPTIMIZADO (Ignora regalos pequeños y solo actualiza si supera su récord o entra al Top)
        if (configGlobal.salonFama) {
            if (!configGlobal.salonFama.record) configGlobal.salonFama.record = {};
            const minCoinsFama = parseInt(configGlobal.salonFama.minCoins) || 10;

            if (totalCoins >= minCoinsFama) {
                const prevUserRecord = configGlobal.salonFama.record[user];
                // Solo guarda y emite si el usuario no tenía récord o si este regalo supera su récord anterior
                if (!prevUserRecord || totalCoins > prevUserRecord.diamonds) {
                    let bestGiftImage = (knownGift && knownGift.image) ? knownGift.image : giftImgUrl;
                    configGlobal.salonFama.record[user] = {
                        userId: user,
                        name: cleanName,
                        avatar: avatarUrl,
                        giftName: giftName,
                        giftImage: bestGiftImage,
                        diamonds: totalCoins
                    };

                    // Mantener máximo 30 récords en disco para no saturar nunca data.json
                    let allRecords = Object.entries(configGlobal.salonFama.record).map(([k, v]) => ({key: k, ...v})).sort((a, b) => b.diamonds - a.diamonds);
                    if (allRecords.length > 30) {
                        allRecords.slice(30).forEach(item => delete configGlobal.salonFama.record[item.key]);
                    }

                    guardarEnArchivo();
                    io.emit('salon_fama_update', configGlobal.salonFama);
                }
            }
        }

        // Top Donadores VIP (Ronda actual en RAM)
        if (!topVIPMemoryRound[user]) {
            topVIPMemoryRound[user] = { coins: 0, avatar: avatarUrl, displayName: cleanName };
        } else {
            topVIPMemoryRound[user].avatar = avatarUrl;
            topVIPMemoryRound[user].displayName = cleanName;
        }
        topVIPMemoryRound[user].coins += totalCoins;
        io.emit('top_vip_data_update', getTopVIPPayload());

        // Batalla Clásica (Monedas por Equipo 1 y Equipo 2)
        let isSalvarMonedas = configGlobal.equipo1.regalos.some(r => Number(r.id) === giftId);
        let isReiniciarMonedas = configGlobal.equipo2.regalos.some(r => Number(r.id) === giftId);
        
        if (userTeams[user] === 1) { isSalvarMonedas = true; isReiniciarMonedas = false; } 
        else if (userTeams[user] === 2) { isSalvarMonedas = false; isReiniciarMonedas = true; }

        if (isSalvarMonedas) {
            teamSalvar.total += totalCoins;
            if (!teamSalvar.donators[user]) teamSalvar.donators[user] = { coins: 0, avatar: avatarUrl, displayName: cleanName };
            teamSalvar.donators[user].avatar = avatarUrl;
            teamSalvar.donators[user].displayName = cleanName;
            teamSalvar.donators[user].coins += totalCoins;
            io.emit('poder_salvar', { side: 'salvar', amount: totalCoins });
        } else if (isReiniciarMonedas) {
            teamReiniciar.total += totalCoins;
            if (!teamReiniciar.donators[user]) teamReiniciar.donators[user] = { coins: 0, avatar: avatarUrl, displayName: cleanName };
            teamReiniciar.donators[user].avatar = avatarUrl;
            teamReiniciar.donators[user].displayName = cleanName;
            teamReiniciar.donators[user].coins += totalCoins;
            io.emit('poder_salvar', { side: 'reiniciar', amount: totalCoins });
        }

        // Batalla Unidades
        if (configGlobal.unidades) {
            if (configGlobal.unidades.normalEnabled !== false) {
                let isSalvarUnidad = (configGlobal.unidades.equipo1?.regalos || []).some(r => Number(r.id) === giftId);
                let isReiniciarUnidad = (configGlobal.unidades.equipo2?.regalos || []).some(r => Number(r.id) === giftId);
                
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

            if (configGlobal.unidades.superReset && configGlobal.unidades.superReset.enabled !== false) {
                let sr = configGlobal.unidades.superReset;
                let isSuperSalvar = (sr.regalosSalvar || []).some(r => Number(r.id) === giftId);
                let isSuperReiniciar = (sr.regalosReiniciar || []).some(r => Number(r.id) === giftId);

                if (isSuperSalvar) {
                    teamSuperSalvarUnidades.total += cantidadAProcesar;
                    lastDonatorSuperSalvar = { name: cleanName, avatar: avatarUrl };
                    io.emit('poder_salvar_unidades', { side: 'salvar', amount: cantidadAProcesar * 5 });
                } else if (isSuperReiniciar) {
                    teamSuperReiniciarUnidades.total += cantidadAProcesar;
                    lastDonatorSuperReiniciar = { name: cleanName, avatar: avatarUrl };
                    io.emit('poder_salvar_unidades', { side: 'reiniciar', amount: cantidadAProcesar * 5 });
                }
            }
        }

        emitSalvarUpdate(io);
    });
}

if(configGlobal.username !== "") conectarTikTok(configGlobal.username);

io.on('connection', (socket) => {
    socket.emit('config_actual', configGlobal);
    socket.emit('catalogo_actualizado', catalogoGlobal);
    socket.emit('racha_versus_update', configGlobal.rachaVersus);
    socket.emit('sync_likes_actuales', currentTotalLikes);
    socket.emit('top_likes_data_update', getTopLikesPayload()); 
    socket.emit('top_vip_data_update', getTopVIPPayload()); 
    socket.emit('update_ultimo_seguidor', ultimoSeguidorData);
    socket.emit('update_ultimo_quiereme', ultimoQuieremeData);
    socket.emit('wins_ruleta_update', estadoWins);
    socket.emit('salon_fama_update', configGlobal.salonFama);

    if (regalosDetectadosCuenta.length > 0) {
        socket.emit('regalos_cuenta_detectados', {
            cuenta: configGlobal.username,
            total: regalosDetectadosCuenta.length,
            regalos: regalosDetectadosCuenta
        });
    }

    if(configGlobal.metaLikes) {
        socket.emit('meta_likes_update', { current: currentTotalLikes, goal: configGlobal.metaLikes.currentGoal, text: configGlobal.metaLikes.actionText, prefix: configGlobal.metaLikes.prefixText, style: configGlobal.metaLikes.style });
    }
    emitSalvarUpdate(socket);

    socket.on('comando_conectar', (usuario) => { configGlobal.username = usuario.trim(); guardarEnArchivo(true); conectarTikTok(configGlobal.username); });
    socket.on('comando_desconectar', () => desconectarTikTok());

    socket.on('escanear_regalos_tiktok', async (usuarioOpcional) => {
        try {
            let instancia = tiktokLiveConnection;
            if (!instancia) {
                let userTarget = (usuarioOpcional || configGlobal.username || "").replace('@', '').trim();
                if (userTarget) instancia = new WebcastPushConnection(userTarget);
            }
            const lista = await obtenerRegalosDeCuentaTikTok(instancia, currentRoomId);
            if (lista.length === 0) {
                socket.emit('resultado_guardar_regalos', { ok: false, msg: "⚠️ TikTok no devolvió regalos. Verifica la cuenta o conexión." });
            }
        } catch (e) {
            socket.emit('resultado_guardar_regalos', { ok: false, msg: "❌ Error al consultar regalos: " + e.message });
        }
    });

    socket.on('guardar_regalos_detectados', (listaCliente) => {
        const listaAGuardar = (Array.isArray(listaCliente) && listaCliente.length > 0) ? listaCliente : regalosDetectadosCuenta;
        if (!listaAGuardar || listaAGuardar.length === 0) {
            socket.emit('resultado_guardar_regalos', { ok: false, msg: "⚠️ Primero carga los regalos de tu cuenta." });
            return;
        }
        const res = guardarListaRegalosEnCatalogo(listaAGuardar);
        io.emit('resultado_guardar_regalos', {
            ok: true,
            guardados: res.guardados,
            totalCatalogo: res.total,
            msg: `✅ ¡Se guardaron y actualizaron ${res.guardados} regalos con sus imágenes oficiales!`
        });
    });

    socket.on('guardar_config', (nuevaConfig) => {
        nuevaConfig.historial = configGlobal.historial;
        nuevaConfig.username = configGlobal.username;
        nuevaConfig.regalosDisponibles = catalogoGlobal; 
        
        if (!nuevaConfig.equipo1.joinWords) nuevaConfig.equipo1.joinWords = configGlobal.equipo1.joinWords;
        if (!nuevaConfig.equipo2.joinWords) nuevaConfig.equipo2.joinWords = configGlobal.equipo2.joinWords;
        if (!nuevaConfig.sociales) nuevaConfig.sociales = configGlobal.sociales;
        if (configGlobal.unidades) nuevaConfig.unidades = configGlobal.unidades;
        if (configGlobal.winsRuleta) nuevaConfig.winsRuleta = configGlobal.winsRuleta;
        if (configGlobal.salonFama) nuevaConfig.salonFama = configGlobal.salonFama;

        Object.assign(configGlobal, nuevaConfig);
        sincronizarImagenesAsignadas();
        guardarEnArchivo(true);
        io.emit('config_actual', configGlobal);
        emitSalvarUpdate(io); 
    });

    socket.on('guardar_config_unidades', (data) => {
        configGlobal.unidades = data;
        sincronizarImagenesAsignadas();
        guardarEnArchivo(true);
        io.emit('config_actual', configGlobal);
        emitSalvarUpdate(io); 
    });

    // Salón de la Fama
    socket.on('salon_fama_limpiar', () => {
        configGlobal.salonFama.record = {};
        guardarEnArchivo(true);
        io.emit('salon_fama_update', configGlobal.salonFama);
    });

    socket.on('salon_fama_eliminar', (userKey) => {
        delete configGlobal.salonFama.record[userKey];
        guardarEnArchivo(true);
        io.emit('salon_fama_update', configGlobal.salonFama);
    });

    socket.on('salon_fama_guardar_opciones', (opts) => {
        configGlobal.salonFama.displayLimit = parseInt(opts.displayLimit) || 5;
        configGlobal.salonFama.alignment = opts.alignment || 'left';
        configGlobal.salonFama.minCoins = parseInt(opts.minCoins) >= 1 ? parseInt(opts.minCoins) : 10;

        // Limpiar automáticamente los que estén debajo del nuevo mínimo de monedas
        for (const [k, v] of Object.entries(configGlobal.salonFama.record || {})) {
            if (v.diamonds < configGlobal.salonFama.minCoins) {
                delete configGlobal.salonFama.record[k];
            }
        }

        guardarEnArchivo(true);
        io.emit('config_actual', configGlobal);
        io.emit('salon_fama_update', configGlobal.salonFama);
    });

    socket.on('guardar_config_sociales', (data) => { configGlobal.sociales = data; guardarEnArchivo(true); io.emit('config_actual', configGlobal); });
    socket.on('guardar_config_wins_ruleta', (data) => { configGlobal.winsRuleta = data; guardarEnArchivo(true); io.emit('config_actual', configGlobal); });

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
        data.spinId = 'test_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
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
        if (mFirstGoal > currentTotalLikes) configGlobal.metaLikes.currentGoal = mFirstGoal;
        else configGlobal.metaLikes.currentGoal = (Math.floor(currentTotalLikes / mStep) * mStep) + mStep;
        configGlobal.metaLikes.step = mStep;
        configGlobal.metaLikes.firstGoal = mFirstGoal; 
        guardarEnArchivo(true);
        io.emit('config_actual', configGlobal); 
        io.emit('meta_likes_update', { current: currentTotalLikes, goal: configGlobal.metaLikes.currentGoal, text: configGlobal.metaLikes.actionText, prefix: configGlobal.metaLikes.prefixText, style: configGlobal.metaLikes.style });
    });

    socket.on('force_fetch_likes', async () => {
        if (tiktokLiveConnection) {
            try {
                let roomInfo = typeof tiktokLiveConnection.fetchRoomInfo === 'function'
                    ? await tiktokLiveConnection.fetchRoomInfo()
                    : await tiktokLiveConnection.getRoomInfo();
                let fetchedLikes = parseInt(roomInfo?.like_count || roomInfo?.data?.like_count || roomInfo?.stats?.likeCount);
                if (!isNaN(fetchedLikes)) {
                    currentTotalLikes = fetchedLikes;
                    io.emit('sync_likes_actuales', currentTotalLikes);
                }
            } catch (error) {}
        }
    });

    // Top Likes (100% en RAM)
    socket.on('top_cerrar_ambas_rondas', () => cerrarRondasGlobales());
    socket.on('top_likes_limpiar_ronda', () => {
        topLikesMemoryRound = {};
        io.emit('top_likes_data_update', getTopLikesPayload());
    });
    socket.on('top_likes_eliminar_ronda', (userKey) => {
        delete topLikesMemoryRound[userKey];
        io.emit('top_likes_data_update', getTopLikesPayload());
    });
    socket.on('top_likes_guardar_opciones', (opts) => {
        configGlobal.topLikes.mirrorMode = !!opts.mirrorMode;
        configGlobal.topLikes.keepOnGlobalClose = !!opts.keepOnGlobalClose;
        guardarEnArchivo(true);
        io.emit('config_actual', configGlobal);
        io.emit('top_likes_data_update', getTopLikesPayload());
    });

    // Top Donadores VIP
    socket.on('top_vip_limpiar_ronda', () => {
        topVIPMemoryRound = {};
        io.emit('top_vip_data_update', getTopVIPPayload());
    });
    socket.on('top_vip_limpiar_historial', () => {
        configGlobal.topVIP.recordHistorico = {};
        guardarEnArchivo(true);
        io.emit('top_vip_data_update', getTopVIPPayload());
    });
    socket.on('top_vip_eliminar_ronda', (userKey) => {
        delete topVIPMemoryRound[userKey];
        io.emit('top_vip_data_update', getTopVIPPayload());
    });
    socket.on('top_vip_eliminar_historial', (userKey) => {
        delete configGlobal.topVIP.recordHistorico[userKey];
        guardarEnArchivo(true);
        io.emit('top_vip_data_update', getTopVIPPayload());
    });
    socket.on('top_vip_ajuste_historial', (data) => { 
        let hist = configGlobal.topVIP.recordHistorico[data.userKey]; 
        if(hist) { 
            hist.wins = Math.max(0, hist.wins + data.amount);
            if(hist.wins === 0) hist.streak = 0; 
            guardarEnArchivo(true);
            io.emit('top_vip_data_update', getTopVIPPayload()); 
        } 
    });
    socket.on('top_vip_ajuste_racha', (data) => { 
        let hist = configGlobal.topVIP.recordHistorico[data.userKey]; 
        if(hist) { 
            hist.streak = Math.max(0, (hist.streak || 0) + data.amount); 
            guardarEnArchivo(true);
            io.emit('top_vip_data_update', getTopVIPPayload()); 
        } 
    });
    socket.on('top_vip_ajuste_ronda', (data) => {
        let ronda = topVIPMemoryRound[data.userKey];
        if(ronda) {
            ronda.coins = Math.max(0, ronda.coins + data.amount);
            io.emit('top_vip_data_update', getTopVIPPayload());
        }
    });
    socket.on('top_vip_guardar_opciones', (opts) => { 
        configGlobal.topVIP.displayLimit = parseInt(opts.displayLimit) || 2; 
        configGlobal.topVIP.mirrorMode = !!opts.mirrorMode; 
        guardarEnArchivo(true); 
        io.emit('config_actual', configGlobal); 
        io.emit('top_vip_data_update', getTopVIPPayload()); 
    });

    socket.on('guardar_config_bolita', (bolitaConfig) => { configGlobal.bolita = bolitaConfig; guardarEnArchivo(true); io.emit('config_actual', configGlobal); });
    
    socket.on('modificar_puntos_equipo', (data) => {
        let cantidad = parseInt(data.cantidad) || 0;
        if (cantidad === 0) return;

        if (data.equipo === 1) { 
            teamSalvar.total = Math.max(0, teamSalvar.total + cantidad); 
        } else if (data.equipo === 2) { 
            teamReiniciar.total = Math.max(0, teamReiniciar.total + cantidad); 
        }
        emitSalvarUpdate(io);
        if (cantidad > 0) io.emit('poder_salvar', { side: data.equipo === 1 ? 'salvar' : 'reiniciar', amount: cantidad });
    });

    socket.on('modificar_puntos_unidades', (data) => {
        let cantidad = parseInt(data.cantidad) || 0;
        if (cantidad === 0) return;

        if (data.equipo === 1) { 
            teamSalvarUnidades.total = Math.max(0, teamSalvarUnidades.total + cantidad); 
            lastDonatorSalvarUnid = { name: 'MANUAL', avatar: '' };
        } else if (data.equipo === 2) { 
            teamReiniciarUnidades.total = Math.max(0, teamReiniciarUnidades.total + cantidad); 
            lastDonatorReiniciarUnid = { name: 'MANUAL', avatar: '' };
        }
        emitSalvarUpdate(io);
        if (cantidad > 0) io.emit('poder_salvar_unidades', { side: data.equipo === 1 ? 'salvar' : 'reiniciar', amount: cantidad });
    });

    socket.on('modificar_puntos_super_unidades', (data) => {
        let cantidad = parseInt(data.cantidad) || 0;
        if (cantidad === 0) return;

        if (data.equipo === 1) { 
            teamSuperSalvarUnidades.total = Math.max(0, teamSuperSalvarUnidades.total + cantidad); 
            lastDonatorSuperSalvar = { name: 'MANUAL', avatar: '' };
        } else if (data.equipo === 2) { 
            teamSuperReiniciarUnidades.total = Math.max(0, teamSuperReiniciarUnidades.total + cantidad); 
            lastDonatorSuperReiniciar = { name: 'MANUAL', avatar: '' };
        }
        emitSalvarUpdate(io);
        if (cantidad > 0) io.emit('poder_salvar_unidades', { side: data.equipo === 1 ? 'salvar' : 'reiniciar', amount: cantidad });
    });

    socket.on('importar_catalogo', (nuevoData) => {
        if (Array.isArray(nuevoData)) guardarListaRegalosEnCatalogo(nuevoData);
    });

    socket.on('importar_historial', (nuevoData) => {
        if (typeof nuevoData === 'object' && nuevoData !== null && !Array.isArray(nuevoData)) {
            let userActivo = configGlobal.username;
            delete nuevoData.racha;
            if (nuevoData.topLikes) delete nuevoData.topLikes.currentRound;
            if (nuevoData.topVIP) delete nuevoData.topVIP.currentRound;
            configGlobal = { ...configGlobal, ...nuevoData };
            if(userActivo) configGlobal.username = userActivo;
            guardarEnArchivo(true);
            io.emit('config_actual', configGlobal);
            io.emit('racha_versus_update', configGlobal.rachaVersus);
            io.emit('top_vip_data_update', getTopVIPPayload());
        }
    });

    socket.on('agregar_regalo_manual', (nuevoRegalo) => {
        let index = catalogoGlobal.findIndex(g => g.id === nuevoRegalo.id);
        if (index === -1) catalogoGlobal.push(nuevoRegalo); else catalogoGlobal[index] = { ...catalogoGlobal[index], ...nuevoRegalo };
        catalogoGlobal.sort((a, b) => a.diamonds - b.diamonds);
        configGlobal.regalosDisponibles = catalogoGlobal;
        sincronizarImagenesAsignadas();
        guardarEnArchivo(true);
        io.emit('catalogo_actualizado', catalogoGlobal);
        io.emit('config_actual', configGlobal);
    });

    socket.on('eliminar_regalo_catalogo', (id) => {
        catalogoGlobal = catalogoGlobal.filter(g => g.id !== id);
        configGlobal.regalosDisponibles = catalogoGlobal;
        configGlobal.equipo1.regalos = configGlobal.equipo1.regalos.filter(g => g.id !== id);
        configGlobal.equipo2.regalos = configGlobal.equipo2.regalos.filter(g => g.id !== id);
        guardarEnArchivo(true);
        io.emit('catalogo_actualizado', catalogoGlobal);
        io.emit('config_actual', configGlobal);
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
        teamSuperSalvarUnidades = { total: 0 };
        teamSuperReiniciarUnidades = { total: 0 };
        lastDonatorSuperSalvar = { name: 'ESPERANDO', avatar: '' };
        lastDonatorSuperReiniciar = { name: 'ESPERANDO', avatar: '' };
        emitSalvarUpdate(io);
    });

    socket.on('reset_super_unidades', () => {
        teamSuperSalvarUnidades = { total: 0 };
        teamSuperReiniciarUnidades = { total: 0 };
        lastDonatorSuperSalvar = { name: 'ESPERANDO', avatar: '' };
        lastDonatorSuperReiniciar = { name: 'ESPERANDO', avatar: '' };
        emitSalvarUpdate(io);
    });

    // Racha Versus / Top Donadores Batalla Clásica (Equipo 1 y Equipo 2)
    socket.on('registrar_victoria_versus', (data) => {
        let tipo = data.tipo; let user = data.user;
        if(!user || !user.name || user.name === 'ESPERANDO' || user.name === 'MANUAL') return;
        let targetObj = tipo === 'salvada' ? configGlobal.rachaVersus.salvadas : configGlobal.rachaVersus.reinicios;
        if(!targetObj[user.name]) targetObj[user.name] = { avatar: user.avatar, displayName: user.name, count: 0, monedas: 0 };
        targetObj[user.name].count += 1;
        targetObj[user.name].monedas = (targetObj[user.name].monedas || 0) + (user.coins || 0);
        targetObj[user.name].avatar = user.avatar;
        guardarEnArchivo(true);
        io.emit('racha_versus_update', configGlobal.rachaVersus);
    });

    socket.on('racha_versus_ajuste', (data) => {
        let targetObj = data.tipo === 'salvadas' ? configGlobal.rachaVersus.salvadas : configGlobal.rachaVersus.reinicios;
        if(targetObj[data.name]) {
            targetObj[data.name].count = Math.max(0, targetObj[data.name].count + data.amount);
            guardarEnArchivo(true);
            io.emit('racha_versus_update', configGlobal.rachaVersus);
        }
    });
    socket.on('racha_versus_eliminar', (data) => {
        let targetObj = data.tipo === 'salvadas' ? configGlobal.rachaVersus.salvadas : configGlobal.rachaVersus.reinicios;
        if(targetObj[data.name]) {
            delete targetObj[data.name];
            guardarEnArchivo(true);
            io.emit('racha_versus_update', configGlobal.rachaVersus);
        }
    });
    socket.on('racha_versus_limpiar', (tipo) => {
        if(tipo === 'salvadas') configGlobal.rachaVersus.salvadas = {};
        else configGlobal.rachaVersus.reinicios = {};
        guardarEnArchivo(true);
        io.emit('racha_versus_update', configGlobal.rachaVersus);
    });
    socket.on('racha_versus_guardar_opciones', (opts) => {
        configGlobal.rachaVersus.showName = opts.showName !== false; 
        configGlobal.rachaVersus.showCount = opts.showCount !== false; 
        configGlobal.rachaVersus.showCoins = opts.showCoins !== false;
        configGlobal.rachaVersus.mirrorMode = !!opts.mirrorMode;
        guardarEnArchivo(true);
        io.emit('racha_versus_update', configGlobal.rachaVersus);
    });
    
    socket.on('racha_versus_clear_visual', () => {
        teamSalvar.donators = {};
        teamReiniciar.donators = {};
        emitSalvarUpdate(io);
        io.emit('racha_versus_clear_visual');
    });

    socket.on('test_ultimo_seguidor', () => { ultimoSeguidorData = { name: "UsuarioPrueba", avatar: "" }; io.emit('update_ultimo_seguidor', ultimoSeguidorData); });
    socket.on('test_ultimo_quiereme', () => { ultimoQuieremeData = { name: "FanNumero1", avatar: "" }; io.emit('update_ultimo_quiereme', ultimoQuieremeData); });
});

setupGameEvents(io, configGlobal);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`🚀 Servidor encendido en el puerto ${PORT}`);
});