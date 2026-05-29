const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/Mirror/.qq-chat-exporter/exports/friend_小朔_u_NlW7Yp5zv8G0joUdxxi2kw_20260527_005641.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, {header:1});

// Filter Mirror's messages, exclude system types
const mirror = data.slice(1).filter(r => {
  if (r[2] !== '希儿') return false;
  if (!r[4] || typeof r[4] !== 'string') return false;
  // Skip system messages
  if (r[4].includes('邀请您参加腾讯会议')) return false;
  if (r[4].startsWith('[') && r[4].length < 30) return false; // pure image/system
  if (r[4].startsWith('Mirror')) return false;
  return true;
});

console.log('Real messages:', mirror.length);

// Extract real text messages (not images)
const text = mirror.filter(r => {
  const m = r[4];
  return !m.startsWith('[图片') && !m.startsWith('[image') && !m.startsWith('[文件') && m.length >= 2;
});
console.log('Text messages:', text.length);

// Get long meaningful messages
const meaningful = text.filter(r => r[4].length >= 30);
console.log('Meaningful (30+ chars):', meaningful.length);

// Print all messages > 80 chars (exclude meeting links already filtered)
console.log('\n=== All messages > 80 chars ===');
const long = [...text].filter(r => r[4].length > 80).sort((a,b)=>a[1].localeCompare(b[1]));
long.forEach(r => console.log('['+r[1]+']', r[4].slice(0,400)));

// Short message patterns
console.log('\n\n=== Short message patterns ===');
const short = text.filter(r => r[4].length < 10);
const shortCounts = {};
short.forEach(r => { const m=r[4]; shortCounts[m]=(shortCounts[m]||0)+1; });
Object.entries(shortCounts).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([k,v])=>console.log('  "'+k+'" x'+v));

// Extract unique content patterns
console.log('\n\n=== Late night messages (21-23h, meaningful) ===');
const late = meaningful.filter(r => {
  const h = parseInt(r[1].slice(11,13));
  return h >= 21 && h <= 23;
});
// Show some samples
for(let i=0;i<Math.min(30,late.length);i+=Math.max(1,Math.floor(late.length/30))){
  const r=late[Math.floor(i)];
  console.log('['+r[1]+']', r[4].slice(0,250));
}

// By month
console.log('\n\n=== Monthly activity ===');
const byMonth = {};
text.forEach(r => {
  const m = r[1].slice(0,7);
  byMonth[m] = (byMonth[m]||0)+1;
});
Object.entries(byMonth).sort().forEach(([k,v])=>console.log(k+': '+v+' msgs'));

