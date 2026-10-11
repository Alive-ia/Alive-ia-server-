const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const app = express();
const PORT = process.env.PORT || 10000;
let currentQR = null;
let status = 'Demarrage...';
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state, logger: pino({level:'silent'}), browser:['Bope Kinshasa','Chrome','1.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    if(u.qr){ currentQR=u.qr; status='En attente scan'; }
    if(u.connection==='open'){ currentQR=null; status='✅ Connecte!'; }
    if(u.connection==='close'){ setTimeout(startBot,3000); }
  });
  sock.ev.on('messages.upsert', async (m)=>{
    const msg=m.messages[0]; if(!msg.message||msg.key.fromMe) return;
    const from=msg.key.remoteJid;
    const text=msg.message.conversation||msg.message.extendedTextMessage?.text||'';
    await sock.sendMessage(from, {text:`Mbote! Bope Kinshasa 🇨🇩\nTu as dit: "${text}"\nBot operationnel 24h/24!`});
  });
}
startBot();
app.get('/', async (req,res)=>{
  if(!currentQR) return res.send(`<body style="background:#111;color:#fff;text-align:center;padding:40px;font-family:sans-serif"><h1>Bope 🇨🇩</h1><h2 style="color:#25D366">${status}</h2><a href="/" style="color:#25D366">Rafraichir</a><script>setTimeout(()=>location.reload(),5000)</script></body>`);
  const qrImage=await QRCode.toDataURL(currentQR,{width:600});
  res.send(`<body style="background:#111;color:#fff;text-align:center;padding:20px;font-family:sans-serif"><h1>SCAN QR - BOPE 🇨🇩</h1><div style="background:#fff;padding:20px;border-radius:20px;max-width:400px;margin:auto"><img src="${qrImage}" style="width:100%"/><p style="color:#000"><b>WhatsApp > Appareils lies > Lier appareil</b></p></div><p>${status}</p><script>setTimeout(()=>location.reload(),30000)</script></body>`);
});
app.listen(PORT,()=>console.log('Bope sur '+PORT));
