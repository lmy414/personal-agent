const XLSX = require('xlsx');
const wb = XLSX.readFile('C:/Users/Mirror/.qq-chat-exporter/exports/friend_小朔_u_NlW7Yp5zv8G0joUdxxi2kw_20260527_005641.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, {header:1});

const rows = data.slice(1).filter(r => r[2] === '希儿' || r[2] === '淡然');

const senderCount = {};
rows.forEach(r => { const s=r[2]; senderCount[s]=(senderCount[s]||0)+1; });
console.log('Total:', rows.length, '| Mirror(希儿):', senderCount['希儿']||0, '| 小朔(淡然):', senderCount['淡然']||0);

const mirror = rows.filter(r => r[2] === '希儿' && r[4] && typeof r[4]==='string');
const lengths = mirror.map(r => r[4].length);
console.log('Avg msg length:', Math.round(lengths.reduce((a,b)=>a+b,0)/lengths.length), 'chars');
console.log('Short(<10):', lengths.filter(l=>l<10).length, 'Medium(10-100):', lengths.filter(l=>l>=10&&l<100).length, 'Long(>100):', lengths.filter(l=>l>100).length);

// Time
const byHour = {};
mirror.forEach(r => {
  const t = r[1];
  if(t && typeof t==='string'){ const h = parseInt(t.slice(11,13)); byHour[h] = (byHour[h]||0)+1; }
});
console.log('\nActive hours:');
Object.entries(byHour).sort((a,b)=>a[0]-b[0]).forEach(([h,c])=>console.log('  '+h+':00 — '+c+' msgs'));

// Longest messages
console.log('\n=== Top 15 longest Mirror messages ===');
const longest = [...mirror].sort((a,b)=>b[4].length-a[4].length).slice(0,15);
longest.forEach((r,i)=>console.log('\n#'+(i+1)+' ['+r[1]+'] '+r[4].length+'chars:\n'+r[4].slice(0,500)));

// Medium samples
console.log('\n\n=== Sample medium messages ===');
const medium = mirror.filter(r => r[4].length >= 50 && r[4].length <= 200);
for(let i=0;i<Math.min(20,medium.length);i+=Math.max(1,Math.floor(medium.length/20))){
  const r=medium[Math.floor(i)];
  console.log('['+r[1]+']', r[4].slice(0,200));
}
