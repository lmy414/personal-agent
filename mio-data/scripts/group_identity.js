const fs = require('fs');
const path = require('path');

const baseDir = 'C:/Users/Mirror/.qq-chat-exporter/exports';
const groups = fs.readdirSync(baseDir).filter(f => f.startsWith('group_') && fs.statSync(path.join(baseDir,f)).isDirectory());

groups.forEach(g => {
  const chunksDir = path.join(baseDir, g, 'chunks');
  if (!fs.existsSync(chunksDir)) return;
  const files = fs.readdirSync(chunksDir).filter(f => f.endsWith('.jsonl'));
  if (files.length === 0) return;
  
  // Read first chunk for group info
  const firstChunk = fs.readFileSync(path.join(chunksDir, files[0]), 'utf8');
  const lines = firstChunk.trim().split('\n').filter(l => l.trim());
  
  // Extract group name from first message if available
  let groupName = '';
  for (const line of lines.slice(0, 100)) {
    try {
      const j = JSON.parse(line);
      if (j.system && j.system.groupName) {
        groupName = j.system.groupName;
        break;
      }
    } catch(e) {}
  }
  
  // Count all senders
  const senders = {};
  let totalMsgs = 0;
  
  files.forEach(f => {
    const content = fs.readFileSync(path.join(chunksDir, f), 'utf8');
    const chunkLines = content.trim().split('\n').filter(l => l.trim());
    totalMsgs += chunkLines.length;
    
    chunkLines.forEach(line => {
      try {
        const j = JSON.parse(line);
        const sender = j.sender;
        if (!sender) return;
        
        // Key by UID for unique identity
        const uid = sender.uid || 'unknown';
        if (!senders[uid]) {
          senders[uid] = {
            uid: uid,
            uin: sender.uin || '',
            names: new Set(),
            nicks: new Set(),
            cards: new Set(),
            count: 0
          };
        }
        senders[uid].names.add(sender.name || '');
        senders[uid].nicks.add(sender.nickname || '');
        senders[uid].cards.add(sender.groupCard || '');
        senders[uid].count++;
      } catch(e) {}
    });
  });
  
  // Sort by message count
  const sorted = Object.values(senders).sort((a, b) => b.count - a.count);
  
  // Extract group ID
  const gidMatch = g.match(/group_(\d+)_/);
  const gid = gidMatch ? gidMatch[1] : g;
  const displayName = groupName || g.match(/group_(.+?)_\d{8}/)?.[1] || gid;
  
  console.log('\n' + '='.repeat(70));
  console.log('群名: ' + displayName);
  console.log('群号: ' + gid);
  console.log('总消息: ' + totalMsgs.toLocaleString() + ' | 发言人数: ' + sorted.length);
  
  // Mark Mirror's accounts
  const mirrorUIDs = ['u_3t11EHHiVL87DkBFRYomxQ', 'u_Ix1fVJxR8xEAi5AdoxitWw'];
  
  console.log('\n--- Mirror 在这个群的身份 ---');
  sorted.filter(s => mirrorUIDs.includes(s.uid)).forEach(s => {
    console.log('  UID: ' + s.uid + ' | 发言: ' + s.count);
    console.log('    名称: ' + [...s.names].join(', '));
    console.log('    昵称: ' + [...s.nicks].join(', '));
    console.log('    群名片: ' + [...s.cards].join(', '));
  });
  
  console.log('\n--- Top 20 发言者 ---');
  sorted.slice(0, 20).forEach((s, i) => {
    const primary = [...s.cards].find(c => c) || [...s.names].find(n => n) || [...s.nicks].find(n => n) || '?';
    const isMirror = mirrorUIDs.includes(s.uid) ? ' ← Mirror' : '';
    console.log('  ' + String(i+1).padStart(2) + '. ' + primary.slice(0,40).padEnd(40) + ' ' + String(s.count).padStart(5) + isMirror);
  });
});
