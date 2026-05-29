const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/Mirror/.qq-chat-exporter/exports';
const groups = fs.readdirSync(baseDir).filter(f => f.startsWith('group_') && fs.statSync(path.join(baseDir,f)).isDirectory());

groups.forEach(g => {
  const chunksDir = path.join(baseDir, g, 'chunks');
  if (!fs.existsSync(chunksDir)) return;
  const files = fs.readdirSync(chunksDir).filter(f => f.endsWith('.jsonl'));
  
  const mirrorNames = new Set();
  let mirrorMsgs = 0;
  let totalMsgs = 0;
  
  files.forEach(f => {
    const content = fs.readFileSync(path.join(chunksDir, f), 'utf8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    totalMsgs += lines.length;
    
    lines.forEach(line => {
      try {
        const j = JSON.parse(line);
        const name = j.sender.name || '';
        const nick = j.sender.nickname || '';
        const card = j.sender.groupCard || '';
        const uid = j.sender.uid || '';
        
        if (name === '希儿' || nick === '希儿' || card === '希儿' ||
            name.includes('Mirror') || nick.includes('Mirror') || card.includes('Mirror') ||
            name === '夏目安安' || nick === '夏目安安' || card === '夏目安安' ||
            uid === 'u_m0kt_q8q0mvm8ukFKMMthQ' ||
            name.includes('镜花') || nick.includes('镜花') || card.includes('镜花')) {
          mirrorNames.add(JSON.stringify({name:name, nick:nick, card:card, uid:uid}));
          mirrorMsgs++;
        }
      } catch(e) {}
    });
  });
  
  const gname = (g.match(/group_(.+?)_\d{8}/) || [g,g])[1];
  console.log('\n=== ' + gname + ' ===');
  console.log('Total msgs: ' + totalMsgs + ' | Mirror msgs: ' + mirrorMsgs);
  console.log('Mirror identities:');
  mirrorNames.forEach(function(n) { console.log('  ' + n); });
});
