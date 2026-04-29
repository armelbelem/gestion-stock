const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const crypto = require('crypto');

// Config
const APP_DATA_DIR = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share'), 'GestionStock');
const LICENSE_FILE = path.join(APP_DATA_DIR, 'license.dat');

// Ensure directory exists
if (!fs.existsSync(APP_DATA_DIR)) {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
}

function getMachineId() {
    try {
        const commands = {
            // UUID du BIOS (le plus stable)
            uuid: 'powershell -NoProfile -Command "Get-CimInstance Win32_ComputerSystemProduct | Select-Object -ExpandProperty UUID"',
            // Numéro de série du BIOS
            bios: 'powershell -NoProfile -Command "Get-CimInstance Win32_BIOS | Select-Object -ExpandProperty SerialNumber"',
            // Carte Mère (BaseBoard)
            mb: 'powershell -NoProfile -Command "Get-CimInstance Win32_BaseBoard | Select-Object -ExpandProperty SerialNumber"',
            // Processeur ID
            cpu: 'powershell -NoProfile -Command "Get-CimInstance Win32_Processor | Select-Object -ExpandProperty ProcessorId"',
            // Disque DUR PHYSIQUE 0 uniquement (le disque système, pour ignorer les clés USB)
            disk: 'powershell -NoProfile -Command "(Get-CimInstance Win32_DiskDrive | Where-Object { $_.DeviceID -eq \'\\\\.\\PHYSICALDRIVE0\' } | Select-Object -ExpandProperty SerialNumber)"'
        };

        let rawId = ""; 
        const genericValues = ['To Be Filled By O.E.M.', 'None', 'Default string', 'Not Applicable', '00000000-0000-0000-0000-000000000000', 'Unknown'];

        for (const key in commands) {
            try {
                let out = execSync(commands[key], { timeout: 3000 }).toString().trim();
                // On ne garde que si la valeur n'est pas vide et n'est pas une valeur générique inutile
                if (out && !genericValues.includes(out) && out.length > 2) {
                    rawId += out;
                }
            } catch (e) {
                // Si une commande échoue, on continue avec les autres
            }
        }

        if (!rawId || rawId.length < 5) {
            // Backup ultime si tout échoue (peu probable sur Windows)
            return 'GENERIC-HWID-FIXED';
        }

        // Créer un hash unique (Fingerprint) de 16 caractères
        return crypto.createHash('sha256').update(rawId).digest('hex').toUpperCase().substring(0, 16);
    } catch (e) {
        return 'UNKNOWN-ERROR-HWID';
    }
}

function decode(str) {
    if (!str) return null;
    try {
        return JSON.parse(Buffer.from(str, 'base64').toString('utf8'));
    } catch (e) {
        return null;
    }
}

function encode(obj) {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
}

function checkLicense() {
    // Debug: Voir où on cherche le fichier
    // console.log("[DEBUG] Recherche licence dans : " + LICENSE_FILE);

    if (fs.existsSync(LICENSE_FILE)) {
        const data = decode(fs.readFileSync(LICENSE_FILE, 'utf8'));
        if (data && data.key) {
            const currentHwid = getMachineId();
            
            if (currentHwid.includes('FAILURE') || currentHwid.includes('ERROR')) {
                console.log("\n[ERREUR] Impossible de sécuriser cet ordinateur (ID Hardware inaccessible).");
                return false;
            }

            // --- PROTECTION CRITIQUE ---
            // Si le HWID est manquant ou différent, on REJETTE la licence.
            if (!data.hwid || data.hwid !== currentHwid) {
                console.log("\n[ERREUR] SECURITE : Cette licence est invalide ou provient d'un autre ordinateur.");
                console.log("Le transfert de licence par simple copier-coller est interdit.");
                console.log("Ancienne ID : " + (data.hwid || "Inconnue"));
                console.log("Nouvelle ID : " + currentHwid);
                return false;
            }

            const now = new Date();
            const expiry = new Date(data.expiry);
            
            if (data.type === 'LIFE') {
                return true;
            }
            
            if (now < expiry) {
                return true;
            } else {
                console.log("\n[ERREUR] Votre licence a expiré le : " + expiry.toLocaleString('fr-FR'));
            }
        }
    }
    return false;
}

function activate(key) {
    const hwid = getMachineId();
    if (hwid.includes('FAILURE') || hwid.includes('ERROR')) {
        console.log("\n[ERREUR] L'activation est impossible car cet ordinateur ne fournit pas d'identifiant matériel valide.");
        return false;
    }

    key = key.trim().toUpperCase();
    let durationDays = 0;
    let type = '';

    // Détection du type de clé
    if (key.startsWith('GS-1J-')) { durationDays = 1; type = '1J'; }
    else if (key.startsWith('GS-3J-')) { durationDays = 3; type = '3J'; }
    else if (key.startsWith('GS-1S-')) { durationDays = 7; type = '1S'; }
    else if (key.startsWith('GS-1M-')) { durationDays = 30; type = '1M'; }
    else if (key.startsWith('GS-1A-')) { durationDays = 365; type = '1A'; }
    else if (key.startsWith('GS-LIFE-')) { durationDays = 99999; type = 'LIFE'; }
    else {
        return false;
    }

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + durationDays);

    const licenseData = {
        key: key,
        type: type,
        hwid: hwid, 
        activatedAt: new Date().toISOString(),
        expiry: expiry.toISOString()
    };

    fs.writeFileSync(LICENSE_FILE, encode(licenseData));
    console.log("\n[SUCCES] Activation réussie !");
    console.log("L'ordinateur '" + (process.env.COMPUTERNAME || 'Client') + "' est maintenant autorisé.");
    return true;
}

function getMaskedInput(query) {
    return new Promise((resolve) => {
        process.stdout.write(query);
        const stdin = process.stdin;
        if (stdin.isTTY) stdin.setRawMode(true);
        stdin.resume();
        stdin.setEncoding('utf8');

        let data = '';
        const onData = (char) => {
            char = char.toString();
            switch (char) {
                case '\n': case '\r': case '\u0004':
                    if (stdin.isTTY) stdin.setRawMode(false);
                    stdin.pause();
                    stdin.removeListener('data', onData);
                    process.stdout.write('\n');
                    resolve(data);
                    break;
                case '\u0003': process.exit(); break;
                case '\u0008': case '\u007f':
                    if (data.length > 0) {
                        data = data.slice(0, -1);
                        process.stdout.write('\b \b');
                    }
                    break;
                default:
                    if (char.length > 1) {
                        data += char;
                        process.stdout.write('*'.repeat(char.length));
                    } else if (char.charCodeAt(0) >= 32) {
                        data += char;
                        process.stdout.write('*');
                    }
                    break;
            }
        };
        stdin.on('data', onData);
    });
}

async function main() {
    const hwid = getMachineId();
    console.log("\n===========================================");
    console.log("   VERIFICATION DE LA LICENCE");
    console.log("   Ordinateur : " + (process.env.COMPUTERNAME || 'Bureau'));
    console.log("   ID Machine : " + hwid);
    console.log("===========================================\n");

    if (checkLicense()) {
        console.log("[INFO] Licence valide détectée.");
        process.exit(0);
    }

    const answer = await getMaskedInput("Veuillez entrer votre clé de licence pour cet ordinateur : ");
    
    if (activate(answer)) {
        process.exit(0);
    } else {
        console.log("\n[ERREUR] Clé de licence invalide ou incompatible.");
        process.exit(1);
    }
}

main();
