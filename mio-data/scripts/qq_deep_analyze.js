const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('C:/Users/Mirror/.qq-chat-exporter/exports/friend_小朔_u_NlW7Yp5zv8G0joUdxxi2kw_20260527_005641.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, {header:1});

// Get Mirror's real text messages (no system, no pure images)
const mirror = data.slice(1).filter(r => {
  if (r[2] !== '希儿') return false;
  if (!r[4] || typeof r[4] !== 'string') return false;
  if (r[4].startsWith('Mirror 邀请您参加腾讯会议')) return false;
  if (r[4].startsWith('[图片') || r[4].startsWith('[视频') || r[4].startsWith('[文件')) return false;
  return true;
});

const allText = mirror.map(r => r[4]).join('\n');

// === 1. VOCABULARY: Word frequency (Chinese bigrams) ===
const words = allText.replace(/[^一-鿿]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
const wordFreq = {};
words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
const topWords = Object.entries(wordFreq).sort((a,b) => b[1]-a[1]).slice(0, 80);

// === 2. PUNCTUATION habits ===
const punct = {};
for (const ch of allText) {
  if (/[，。！？、；：""''（）【】《》…—\-,.!?;:'"()\[\]{}]/.test(ch)) {
    punct[ch] = (punct[ch] || 0) + 1;
  }
}

// === 3. MESSAGE ENDINGS (last 2 chars) ===
const endings = {};
mirror.forEach(r => {
  const m = r[4].trim();
  if (m.length >= 2) {
    const end = m.slice(-2);
    endings[end] = (endings[end] || 0) + 1;
  }
});

// === 4. SENTENCE LENGTH distribution ===
const lengths = mirror.map(r => r[4].length);
const dist = {1:0,5:0,10:0,20:0,50:0,100:0,200:0};
lengths.forEach(l => {
  for (const [k,v] of Object.entries(dist)) {
    if (l <= parseInt(k)) { dist[k]++; break; }
  }
});

// === 5. EMOJI / EMOTICON patterns ===
const emojiMatches = [...allText.matchAll(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]|:\)|:\(|:D|:P|;\)|qwq|QwQ|TAT|www|hhh+|233|😂|😊|😭|❤|👍|😅|😄|🥺|🤔|😢|😡|😍|🙏|😘|🤣|😌|💪|🤝|👀|✨|💤|🍚|🍰|🍵|🎉|🎵|🎮|📱|💻|📷|🎬/gu)];
const emojiCount = {};
emojiMatches.forEach(m => { const e=m[0]; emojiCount[e]=(emojiCount[e]||0)+1; });

// === 6. QUESTION vs STATEMENT vs EXCLAMATION ===
let questions=0, exclaims=0, statements=0;
mirror.forEach(r => {
  const m = r[4];
  if (m.includes('？') || m.includes('?')) questions++;
  if (m.includes('！') || m.includes('!')) exclaims++;
  if (!m.includes('？') && !m.includes('?') && !m.includes('！') && !m.includes('!')) statements++;
});

// === 7. TIME-OF-DAY LANGUAGE PATTERNS ===
const byPeriod = {morning:[], afternoon:[], evening:[], night:[]};
mirror.forEach(r => {
  const h = parseInt(r[1].slice(11,13));
  if (h < 6) byPeriod.night.push(r[4]);
  else if (h < 12) byPeriod.morning.push(r[4]);
  else if (h < 18) byPeriod.afternoon.push(r[4]);
  else byPeriod.evening.push(r[4]);
});

// === 8. MESSAGE STARTERS (how Mirror starts a new thought) ===
const starters = {};
mirror.forEach(r => {
  const m = r[4].trim();
  if (m.length >= 3) {
    const s = m.slice(0, 3);
    starters[s] = (starters[s] || 0) + 1;
  }
});

// === OUTPUT ===
const out = [];

out.push('# 澪号语言指纹 — 全量分析\n');
out.push('> 来源：Mirror(希儿) 与小朔(淡然) QQ私聊，4852条消息\n');

out.push('## 一、词汇频率 Top 80\n');
out.push('| 词 | 次数 |');
out.push('|------|------|');
topWords.forEach(([w,c]) => out.push(`| ${w} | ${c} |`));

out.push('\n## 二、标点习惯\n');
out.push('| 标点 | 次数 | 解读 |');
out.push('|------|------|------|');
Object.entries(punct).sort((a,b)=>b[1]-a[1]).forEach(([p,c]) => {
  const meanings = {',':'逗号-轻松','。':'句号-正式','！':'感叹-情绪','？':'问号-互动','…':'省略-犹豫','~':'波浪-轻松','（）':'括号-吐槽'};
  out.push(`| ${p} | ${c} | ${meanings[p]||''} |`);
});

out.push('\n## 三、句长分布\n');
out.push('| 长度 | 数量 | 占比 |');
out.push('|------|------|------|');
Object.entries(dist).forEach(([k,v]) => {
  out.push(`| ≤${k}字 | ${v} | ${(v/mirror.length*100).toFixed(1)}% |`);
});

out.push('\n## 四、句末模式 Top 30\n');
out.push('| 结尾 | 次数 |');
out.push('|------|------|');
Object.entries(endings).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([e,c]) => out.push(`| ${e} | ${c} |`));

out.push('\n## 五、表情/颜文字/语气词\n');
out.push('| 表情 | 次数 |');
out.push('|------|------|');
Object.entries(emojiCount).sort((a,b)=>b[1]-a[1]).forEach(([e,c]) => out.push(`| ${e} | ${c} |`));

out.push('\n## 六、句式倾向\n');
out.push(`- 疑问句: ${questions} (${(questions/mirror.length*100).toFixed(1)}%)`);
out.push(`- 感叹句: ${exclaims} (${(exclaims/mirror.length*100).toFixed(1)}%)`);
out.push(`- 陈述句: ${statements} (${(statements/mirror.length*100).toFixed(1)}%)`);

out.push('\n## 七、时段语言特征\n');
for (const [period, msgs] of Object.entries(byPeriod)) {
  const labels = {morning:'早晨(6-12)',afternoon:'下午(12-18)',evening:'晚间(18-24)',night:'深夜(0-6)'};
  const all = msgs.join(' ');
  const len = msgs.map(m=>m.length);
  const avg = Math.round(len.reduce((a,b)=>a+b,0)/len.length);
  out.push(`\n### ${labels[period]} (${msgs.length}条, 均长${avg}字)\n`);
  // Top words by period
  const pw = all.replace(/[^一-鿿]/g,' ').split(/\s+/).filter(w=>w.length>=2);
  const pf = {};
  pw.forEach(w=>{pf[w]=(pf[w]||0)+1;});
  Object.entries(pf).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([w,c])=>out.push(`- ${w}: ${c}`));
}

out.push('\n## 八、消息开头 Top 30\n');
out.push('| 开头 | 次数 |');
out.push('|------|------|');
Object.entries(starters).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([s,c]) => out.push(`| ${s} | ${c} |`));

fs.writeFileSync('D:/claude/personal-agent/mio-data/qq-language-fingerprint.md', out.join('\n'));
console.log('Done. Written to qq-language-fingerprint.md');
console.log('Total Mirror msgs analyzed:', mirror.length);
