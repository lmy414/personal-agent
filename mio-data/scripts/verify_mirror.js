const fs = require('fs');
const path = require('path');

const MIRROR_UID = 'u_3t11EHHiVL87DkBFRYomxQ';

const baseDir = 'C:/Users/Mirror/.qq-chat-exporter/exports';
const groups = fs.readdirSync(baseDir).filter(f => f.startsWith('group_') && fs.statSync(path.join(baseDir,f)).isDirectory());

groups.forEach(g => {
  const chunksDir = path.join(baseDir, g, 'chunks');
  if (!fs.existsSync(chunksDir)) return;
  const files = fs.readdirSync(chunksDir).filter(f => f.endsWith('.jsonl'));
  if (files.length === 0) return;
  
  // Find group name from system messages
  let groupName = '';
  const allNames = {};
  
  files.forEach(f => {
    const content = fs.readFileSync(path.join(chunksDir, f), 'utf8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    
    lines.forEach(line => {
      try {
        const j = JSON.parse(line);
        
        // Check for group name in system messages
        if (j.system && !groupName) {
          if (j.system.groupName) groupName = j.system.groupName;
        }
        
        // Count Mirror's identities
        const sender = j.sender;
        if (sender && sender.uid === MIRROR_UID) {
          const card = sender.groupCard || '(无群名片)';
          const name = sender.name || '';
          allNames[card] = (allNames[card] || 0) + 1;
        }
      } catch(e) {}
    });
  });
  
  const gid = (g.match(/group_(\d+)/) || ['', g])[1];
  console.log('\n=== 群 ' + gid + (groupName ? ' "' + groupName + '"' : '') + ' ===');
  console.log('Mirror(希儿) 的群名片及发言数:');
  Object.entries(allNames).sort((a,b) => b[1]-a[1]).forEach(([card, count]) => {
    console.log('  ' + String(count).padStart(5) + ' — ' + card);
  });
});
