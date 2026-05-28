// 立即测试DOM是否可用
(function(){
  var btn = document.getElementById('start-btn');
  console.log('Script loaded, start-btn element:', btn);
  if(btn){
    btn.addEventListener('click', function(){
      console.log('Button clicked!');
      startGame();
    });
    console.log('Event listener attached to start-btn');
  } else {
    console.error('start-btn not found!');
  }
})();

var MAP_W=2400,MAP_H=2400,FOG_REVEAL=90;
// ── 网格坐标系 ──────────────────────────────────────────────────────────────
// 地图划为 24×24 格，每格 CELL=100px。
// 地物用 gx/gy（格子号，0~23）定义，运行时用 g2px() 换算为像素中心坐标。
var GRID_COLS=24,GRID_ROWS=24,CELL=100;
// 数学坐标系：gy=0 在地图底部，gy 增大向上（Y轴正方向朝上）
function g2px(gx,gy){return {x:gx*CELL+CELL/2, y:MAP_H-(gy*CELL+CELL/2)};}
function px2g(x,y){return {gx:Math.round((x-CELL/2)/CELL), gy:Math.round((MAP_H-y-CELL/2)/CELL)};}
function snapToGrid(x,y){var g=px2g(x,y);var p=g2px(g.gx,g.gy);return p;}
// 食材格子位移：gridDx/gridDy 是格子数，返回像素位移（dy 注意 Y 轴方向）
function ingStep(ing){return {dx:ing.gridDx*CELL, dy:-ing.gridDy*CELL};}
// ─────────────────────────────────────────────────────────────────────────────

// 岛屿（gx/gy 网格格子号）
var ISLANDS_DEF=[
  {id:'micu',   name:'米醋岛',gx:5, gy:10,r:58,color:'#f5e06a',prod:'普通米醋',  reward:22,unlocks:['maiqu','gukang']},
  {id:'chencu', name:'陈醋岛',gx:19,gy:7, r:60,color:'#8b5e14',prod:'优质陈醋',  reward:42,unlocks:['laojiu','shiyan']},
  {id:'xiangcu',name:'香醋岛',gx:12,gy:3, r:52,color:'#d4a520',prod:'极品香醋',  reward:68,unlocks:['huajiao','meihua']},
  {id:'baicu',  name:'白醋岛',gx:21,gy:18,r:48,color:'#d8d8e8',prod:'纯酿白醋',  reward:20,unlocks:['shiyan']},
  {id:'lacu',   name:'辣醋岛',gx:4, gy:19,r:54,color:'#cc3333',prod:'巴蜀辣醋',  reward:40,unlocks:['huajiao']},
  {id:'tiancu', name:'甜醋岛',gx:12,gy:22,r:50,color:'#dda0dd',prod:'客家甜醋',  reward:65,unlocks:['fengmi']},
  {id:'suan',   name:'酸风岛',gx:7, gy:5, r:46,color:'#66ccff',prod:'青梅精酿',  reward:38,unlocks:['meihua']},
  {id:'la',     name:'辛香岛',gx:17,gy:14,r:50,color:'#ff8844',prod:'藤椒香醋',  reward:45,unlocks:['gukang','maiqu']},
];
// 运行时将 gx/gy 换算为 px 坐标，并挂到 ISLANDS（兼容原有代码）
var ISLANDS=ISLANDS_DEF.map(function(d){
  var p=g2px(d.gx,d.gy);
  return Object.assign({},d,{x:p.x,y:p.y});
});
var INGREDIENTS_DEF=[
  // ── 基础食材（无限库存，始终可用）──
  {id:'xiaomi',  name:'小米',  icon:'🌾',cost:0, desc:'酸味·右1格',    gridDx: 1,gridDy: 0,inG:true, basic:true},
  {id:'maisui',  name:'麦穗',  icon:'🌱',cost:0, desc:'香气·上1格',    gridDx: 0,gridDy: 1,inG:true, basic:true},
  {id:'shui',    name:'清水',  icon:'💧',cost:0, desc:'香退·下1格',    gridDx: 0,gridDy:-1,inG:true, basic:true},
  {id:'gaoliang',name:'高粱',  icon:'🌽',cost:0, desc:'酸退·左1格',    gridDx:-1,gridDy: 0,inG:true, basic:true},
  // ── 隐藏食材（地图探索后解锁）──
  {id:'maiqu',   name:'麦曲',  icon:'🍞',cost:0, desc:'增香·右上',     gridDx: 1,gridDy: 1,inG:false,hidden:true},
  {id:'gukang',  name:'谷糠',  icon:'🌿',cost:0, desc:'飘忽·右下',     gridDx: 1,gridDy:-1,inG:true, hidden:true},
  {id:'shiyan',  name:'食盐',  icon:'🧂',cost:0, desc:'急转·右2格',    gridDx: 2,gridDy: 0,inG:false,hidden:true},
  {id:'huajiao', name:'花椒',  icon:'🌶️',cost:0, desc:'飘香·上2格',    gridDx: 0,gridDy: 2,inG:true, hidden:true},
  {id:'fengmi',  name:'蜂蜜',  icon:'🍯',cost:0, desc:'甜润·右下',     gridDx: 1,gridDy:-1,inG:false,hidden:true},
  {id:'laojiu',  name:'老醋引',icon:'🫙',cost:0, desc:'强推·右上2格',  gridDx: 2,gridDy: 1,inG:false,hidden:true},
  {id:'meihua',  name:'青梅',  icon:'🫒',cost:0, desc:'酸冽·左上2格',  gridDx: 1,gridDy: 2,inG:true, hidden:true},
];
// 食材散落点（gx/gy 网格格子号）
var INGREDIENT_DROPS_DEF=[
  {id:'maiqu',  gx:9, gy:6,  r:22},
  {id:'gukang', gx:16,gy:10, r:20},
  {id:'shiyan', gx:18,gy:11, r:22},
  {id:'huajiao',gx:10,gy:3,  r:20},
  {id:'fengmi', gx:14,gy:19, r:22},
  {id:'laojiu', gx:21,gy:5,  r:20},
  {id:'meihua', gx:6, gy:4,  r:22},
];
var INGREDIENT_DROPS=INGREDIENT_DROPS_DEF.map(function(d){
  var p=g2px(d.gx,d.gy);
  return Object.assign({},d,{x:p.x,y:p.y});
});
var JAR_ICONS=['🫙','⚱️','🏺'];
var JAR_NAMES=['大曲醋','小米醋','陈年醋','香糟醋','米曲醋'];
var JAR_DAYS=[7,10,14];
var JAR_LINKED=['maiqu','shiyan','fengmi'];
// state
var gDay=1,gMoney=30,gMapActive=false;
var ingredStock={};
var unlockedIng={};
var cellarJars=[],cellarUsedToday=false,cellarNewJarToday=false,cellarSelectedIdx=-1,cellarSelIng=null,cellarPreviewMode=false;
var cellarPlanSteps=1; // 当前选择的格子步数
var cellarPlanPos={x:MAP_W/2+CELL,y:MAP_H/2},cellarPlanPath=[],cellarPlanIngs=[];
var vinegarStock={},readyVinegar=[];
var fog=[],pathPts=[],curPos={x:MAP_W/2,y:MAP_H/2};
var usedIngreds=[],discovered={},selectedIng=null;
var camX=0,camY=0,zoom=1.0,MIN_ZOOM=0.3,MAX_ZOOM=2.5;
var canvas,ctx,cw=0,ch=0,offCanvas,offCtx;
var animating=false,animPts=[],animIdx=0,revealAnims=[];
var autoMoving=false,autoMovePath=[],autoMoveIdx=0;
// 多坛探索：当前选中的坛子索引，及今日已探索记录
var selectedJarIdx=-1;
var exploredToday=[]; // 今日已探索完的坛子id列表
// 固定知识点（gx/gy 网格格子号，位置固定）
var FIXED_KNOWS_DEF=[
  {title:'醋酸菌的秘密',text:'醋的核心是醋酸菌，它们能把酒精转化为醋酸。最适宜的温度是30-35℃，太冷会休眠，太热会死亡。',gx:8, gy:14},
  {title:'搅拌的学问',text:'发酵过程中搅拌可以让氧气均匀分布，促进醋酸菌繁殖。但搅拌太多会破坏菌膜，一天1-2次最佳。',gx:15,gy:5},
  {title:'小米醋的历史',text:'小米醋是中国北方传统醋种，以小米为主料，酸香醇厚，已有两千多年的酿造历史。',gx:19,gy:16},
  {title:'温度与风味',text:'低温发酵（20-25℃）产酸慢但风味细腻；高温发酵（35-40℃）产酸快但容易带有焦糊味。',gx:3, gy:7},
  {title:'谷糠的妙用',text:'谷糠不仅是填充料，还能调节醋醅的透气性，让醋酸菌获得足够的氧气，同时吸附杂质。',gx:12,gy:19},
  {title:'陈酿的魅力',text:'新醋味道尖锐刺口，经过陈酿后，各种有机酸和酯类物质相互作用，口感变得醇厚柔和。',gx:7, gy:21},
  {title:'花椒与醋',text:'花椒中的挥发油与醋酸结合，产生独特的麻香风味。巴蜀地区的辣醋正是利用这一原理。',gx:21,gy:11},
  {title:'青梅入醋',text:'青梅富含有机酸，与米醋融合后产生清爽的果香。日本梅醋与此有异曲同工之妙。',gx:11,gy:10},
  {title:'酒与醋的渊源',text:'酿酒失败会得到醋——这是古人的发现。酒和醋本是一家，只是发酵的菌种不同罢了。',gx:17,gy:20},
];
var FIXED_KNOWS=FIXED_KNOWS_DEF.map(function(d){
  var p=g2px(d.gx,d.gy);
  return Object.assign({},d,{x:p.x,y:p.y});
});
// 已访问记录：true=已首次触发过（不再自动弹）
var knownVisited={};
var knowQueue=[],knowPaused=false,knowShowCount=0,knowLastIdx=-1;

// 障碍物已删除

// 传送门（gx/gy 定义入口，tx/ty 定义出口格子号，成对互为出口）
var PORTALS_DEF=[
  {id:'p1',gx:4, gy:5,  r:22,tx:18,ty:20},
  {id:'p2',gx:18,gy:20, r:22,tx:4, ty:5},
  {id:'p3',gx:12,gy:3,  r:22,tx:12,ty:21},
  {id:'p4',gx:12,gy:21, r:22,tx:12,ty:3},
  {id:'p5',gx:3, gy:16, r:22,tx:21,ty:8},
  {id:'p6',gx:21,gy:8,  r:22,tx:3, ty:16},
];
var PORTALS=PORTALS_DEF.map(function(d){
  var p=g2px(d.gx,d.gy);
  var t=g2px(d.tx,d.ty);
  return {id:d.id,x:p.x,y:p.y,r:d.r,dx:t.x,y2:t.y,gx:d.gx,gy:d.gy,tx:d.tx,ty:d.ty};
});

// isInObstacle已删除（无障碍物系统）

// 传送门冷却：传送后若干帧内不再触发，防止出口处立即反向传送死循环
var _teleportCooldown=0;     // 剩余冷却帧数
var _lastTeleportDestId='';  // 刚才传到的目标传送门id，落地帧内排除掉它

// 检查是否碰到传送门并返回传送目标位置（放在出口远离来向的一侧）
// excludeId: 排除此id的传送门（刚离开的那个出口，避免在出口处再立即触发）
function checkPortal(x,y,excludeId){
  if(_teleportCooldown>0){_teleportCooldown--;return null;}
  for(var p=0;p<PORTALS.length;p++){
    var pt=PORTALS[p];
    if(excludeId&&pt.id===excludeId)continue;
    var dx=x-pt.x,dy=y-pt.y;
    if(Math.sqrt(dx*dx+dy*dy)<pt.r+8){
      // 找目标传送门
      var destPortal=null;
      for(var q=0;q<PORTALS.length;q++){
        var qt=PORTALS[q];
        var ex=pt.dx,ey=pt.y2;
        if(Math.abs(qt.x-ex)<2&&Math.abs(qt.y-ey)<2){destPortal=qt;break;}
      }
      if(!destPortal)return null;
      // 计算出口偏移：将落点放在出口portal的远离入口方向的一侧
      // 入口到出口的方向 = destPortal - pt（入口portal）
      var edX=destPortal.x-pt.x,edY=destPortal.y-pt.y;
      var edLen=Math.sqrt(edX*edX+edY*edY);
      if(edLen<0.001)edLen=0.001;
      var normEX=edX/edLen,normEY=edY/edLen;
      // 落点在出口portal中心 + 入口→出口方向 * (出口半径+15)
      // 这样玩家落在出口的远离入口一侧，继续前进不会触发回传
      var landX=destPortal.x+normEX*(destPortal.r+15);
      var landY=destPortal.y+normEY*(destPortal.r+15);
      // 边界钳制
      landX=Math.max(15,Math.min(MAP_W-15,landX));
      landY=Math.max(15,Math.min(MAP_H-15,landY));
      return {x:landX,y:landY,srcId:pt.id,destId:destPortal.id,destCx:destPortal.x,destCy:destPortal.y};
    }
  }
  return null;
}

function showKnowledgePopup(idx){
  var k=FIXED_KNOWS[idx];
  document.getElementById('know-title').textContent=k.title;
  document.getElementById('know-text').textContent=k.text;
  document.getElementById('know-overlay').classList.add('show');
  knowPaused=true;
  knowShowCount++;
  knownVisited[idx]=true;
  // 安全超时：10秒后自动关闭，防止永久卡住
  clearTimeout(window._knowTimer);
  window._knowTimer=setTimeout(function(){closeKnowledge();},10000);
}
function showIngDiscoverPopup(ing){
  document.getElementById('know-title').textContent=ing.icon+' 新食材解锁！';
  var acidDir=ing.gridDx>0?('→'+ing.gridDx+'格'):(ing.gridDx<0?('←'+(-ing.gridDx+'格')):'—');
  var aromaDir=ing.gridDy>0?('↑'+ing.gridDy+'格'):(ing.gridDy<0?('↓'+(-ing.gridDy+'格')):'—');
  var dist='每步 '+CELL+'px × '+Math.abs(ing.gridDx||ing.gridDy||1)+'格';
  document.getElementById('know-text').textContent=
    '【'+ing.name+'】\n'+ing.desc+'\n方向：'+acidDir+' · '+aromaDir+'\n'+dist+'\n\n已加入食材列表，可在地窖中无限使用！';
  document.getElementById('know-overlay').classList.add('show');
  knowPaused=true;
  clearTimeout(window._knowTimer);
  window._knowTimer=setTimeout(function(){closeKnowledge();},10000);
}
function closeKnowledge(){
  document.getElementById('know-overlay').classList.remove('show');
  knowPaused=false;
  clearTimeout(window._knowTimer);
}
function showBrewingSummary(){var list=document.getElementById('brew-summary-list');list.innerHTML='';var activeJars=cellarJars.filter(function(j){return !j.done;});var doneJars=cellarJars.filter(function(j){return j.done;});if(activeJars.length===0&&doneJars.length===0){list.innerHTML='<div style="color:#7a5030;text-align:center;padding:20px;font-size:13px">地窖中没有醋坛，请先开新坛！</div>';}else{if(doneJars.length>0){doneJars.forEach(function(jar,idx){var rv=null;for(var rvi=0;rvi<readyVinegar.length;rvi++){if(readyVinegar[rvi].from===jar.name){rv=readyVinegar[rvi];break;}}var item=document.createElement('div');item.className='bs-jar-item';item.style.borderColor='#c9a227';item.innerHTML='<div class="bs-icon">'+(rv?rv.icon:'✅')+'</div><div class="bs-info"><div class="bs-name" style="color:#ffd700">'+jar.name+' · 酿成！</div><div class="bs-status">共 '+jar.totalDays+' 天<br>'+(rv?rv.name+' 已加入仓库':'醋已成熟')+'</div></div>';list.appendChild(item);});}if(activeJars.length>0){activeJars.forEach(function(jar,idx){var item=document.createElement('div');item.className='bs-jar-item';var pg=Math.round((1-jar.daysLeft/jar.totalDays)*100);var routeInfo='';if(jar.routeHistory&&jar.routeHistory.length>0){var totalSeg=0;jar.routeHistory.forEach(function(rd){totalSeg+=rd.segments.length;});routeInfo='已走'+totalSeg+'步路线';}else{routeInfo='尚未规划路线';}var ingName=jar.brewIng?(INGREDIENTS_DEF.find(function(x){return x.id===jar.brewIng;})||{}).name||'未知':'未选材';item.innerHTML='<div class="bs-icon">'+jar.icon+'</div><div class="bs-info"><div class="bs-name">'+jar.name+'</div><div class="bs-status">发酵第'+jar.day+'天 / 共'+jar.totalDays+'天 ('+pg+'%)<br>温度：'+['凉','温','烫'][jar.temp-1]+' | 搅拌：'+jar.stirs+'次 | 食材：'+ingName+'<br>'+routeInfo+'</div></div><div class="bs-canvas-wrap"><canvas id="bs-canvas-'+idx+'" width="280" height="130"></canvas></div>';list.appendChild(item);setTimeout(function(){drawBrewingCanvas('bs-canvas-'+idx,jar);},50);});}}var bsBtn=document.getElementById('brew-summary-btn');var allExplored=activeJars.length===0||exploredToday.length>=activeJars.length;if(activeJars.length===0){bsBtn.textContent='🏗️ 回地窖开新坛';bsBtn.onclick=function(){document.getElementById('brew-summary-overlay').classList.remove('show');exploredToday=[];_jarExploredDone=false;_mapModalShown=false;cellarUsedToday=false;cellarNewJarToday=false;goCellar();};}else if(allExplored){bsBtn.textContent='☀️ 回地窖，开始新的一天';bsBtn.onclick=function(){document.getElementById('brew-summary-overlay').classList.remove('show');exploredToday=[];_jarExploredDone=false;_mapModalShown=false;cellarUsedToday=false;cellarNewJarToday=false;goCellar();};}else{bsBtn.textContent='🌄 开始探索风味地图';bsBtn.onclick=function(){document.getElementById('brew-summary-overlay').classList.remove('show');exploredToday=[];_jarExploredDone=false;_mapModalShown=false;showJarSelect();};}document.getElementById('brew-summary-overlay').classList.add('show');}

function drawBrewingCanvas(canvasId,jar){var cvs=document.getElementById(canvasId);if(!cvs)return;var c=cvs.getContext('2d');var W=280,H=130,PAD=12;c.clearRect(0,0,W,H);c.fillStyle='#06060e';c.fillRect(0,0,W,H);c.strokeStyle='rgba(80,50,20,0.15)';c.lineWidth=0.5;for(var gx=0;gx<W;gx+=20){c.beginPath();c.moveTo(gx,0);c.lineTo(gx,H);c.stroke();}for(var gy=0;gy<H;gy+=20){c.beginPath();c.moveTo(0,gy);c.lineTo(W,gy);c.stroke();}if(!jar.routeHistory||jar.routeHistory.length===0){c.fillStyle='#555';c.font='11px SimSun';c.textAlign='center';c.fillText('暂无路线数据',140,65);return;}// 只取最近3天路线，避免图线过于复杂
var recent=jar.routeHistory.slice(-3);var allSegs=[];recent.forEach(function(rd){allSegs=allSegs.concat(rd.segments);});if(allSegs.length===0){c.fillStyle='#555';c.font='11px SimSun';c.textAlign='center';c.fillText('暂无路线数据',140,65);return;}// 计算所有累积点
var allPts=[{x:0,y:0}];allSegs.forEach(function(seg){var last=allPts[allPts.length-1];allPts.push({x:last.x+seg.dx,y:last.y+seg.dy});});if(allPts.length>20){// 点太多时抽样，最多保留20个点
  var sampled=[allPts[0]];var step=Math.floor(allPts.length/20);for(var si=step;si<allPts.length-1;si+=step){sampled.push(allPts[si]);}sampled.push(allPts[allPts.length-1]);allPts=sampled;}var minX=0,maxX=0,minY=0,maxY=0;allPts.forEach(function(p){if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;});var bw=Math.max(maxX-minX,40);var bh=Math.max(maxY-minY,40);var sc=Math.min((W-PAD*2)/bw,(H-PAD*2)/bh,1.5);var offX=(W-(minX+maxX)*sc)/2;var offY=(H-(minY+maxY)*sc)/2;// 画路线（简化版，只画最近3天）
c.strokeStyle='rgba(205,133,63,0.7)';c.lineWidth=2;c.beginPath();c.moveTo(offX+allPts[0].x*sc,offY+allPts[0].y*sc);for(var i=1;i<allPts.length;i++){c.lineTo(offX+allPts[i].x*sc,offY+allPts[i].y*sc);}c.stroke();// 画中间点（每隔一个点画一个，避免太密）
for(var hi=1;hi<allPts.length-1;hi+=2){var hx=offX+allPts[hi].x*sc,hy=offY+allPts[hi].y*sc;c.beginPath();c.arc(hx,hy,2,0,Math.PI*2);c.fillStyle='rgba(205,133,63,0.6)';c.fill();}// 起点
c.beginPath();c.arc(offX+allPts[0].x*sc,offY+allPts[0].y*sc,3.5,0,Math.PI*2);c.fillStyle='#ffd700';c.fill();// 终点
var lastP=allPts[allPts.length-1];c.beginPath();c.arc(offX+lastP.x*sc,offY+lastP.y*sc,4,0,Math.PI*2);c.fillStyle='#ffd700';c.fill();c.strokeStyle='rgba(255,215,0,0.5)';c.lineWidth=1.5;c.stroke();}

// ========== 多坛探索辅助函数 ==========
function getJar(){return selectedJarIdx>=0?cellarJars[selectedJarIdx]:null;}
function jarCurPos(){var j=getJar();return j&&j.curPos||{x:MAP_W/2,y:MAP_H/2};}
function setJarCurPos(x,y){var j=getJar();if(j){j.curPos={x:x,y:y};}curPos.x=x;curPos.y=y;}
function jarPathPts(){var j=getJar();return j&&j.pathPts||[];}
function jarSetPathPts(arr){var j=getJar();if(j){j.pathPts=arr;}}
function jarPushPathPt(x,y){var j=getJar();if(j){if(!j.pathPts)j.pathPts=[];j.pathPts.push({x:x,y:y});}pathPts.push({x:x,y:y});}
function jarPopPathPt(){var j=getJar();if(j&&j.pathPts&&j.pathPts.length>0)j.pathPts.pop();if(pathPts.length>0)pathPts.pop();}
function jarAutoMove(){var j=getJar();return j&&j.autoMovePath||[];}
function jarAutoMoving(){var j=getJar();return j?j.autoMoving:false;}
function setJarAutoMoving(v){var j=getJar();if(j)j.autoMoving=v;autoMoving=v;}
function jarAutoMoveIdx(){var j=getJar();return j?j.autoMoveIdx:0;}
function setJarAutoMoveIdx(v){var j=getJar();if(j)j.autoMoveIdx=v;autoMoveIdx=v;}
function jarHistStart(){var j=getJar();return j?j.histStart:0;}
function setJarHistStart(v){var j=getJar();if(j)j.histStart=v;window._pathHistoryStart=v;}

// 找到下一个未探索且有路线的坛子索引
function findNextUnexploredJar(){
  var activeJars=cellarJars.filter(function(j){return !j.done;});
  for(var i=0;i<activeJars.length;i++){
    var jar=activeJars[i];
    if(exploredToday.indexOf(jar.id)>=0)continue;
    // 检查是否有路线可走
    var hasRoute=false;
    if(jar.routeHistory&&jar.routeHistory.length>0){
      var lastRd=jar.routeHistory[jar.routeHistory.length-1];
      if(lastRd.segments&&lastRd.segments.length>0)hasRoute=true;
    }
    if(hasRoute){
      return cellarJars.indexOf(jar);
    }
  }
  return -1;
}

// 坛子探索选坛界面
function showJarSelect(){
  var overlay=document.getElementById('jar-select-overlay');
  var list=document.getElementById('jar-select-list');
  var activeJars=cellarJars.filter(function(j){return !j.done;});
  // 安全守卫：如果没有活跃坛子也没有刚完成的坛子，直接回地窖
  var newlyDoneJars=cellarJars.filter(function(j){
    if(!j.done)return false;
    if(j._brewResultShown)return false;
    for(var i=0;i<readyVinegar.length;i++){if(readyVinegar[i].from===j.name)return true;}
    return false;
  });
  list.innerHTML='';
  // 先显示正在发酵的坛子
  activeJars.forEach(function(jar,idx){
    var explored=exploredToday.indexOf(jar.id)>=0;
    var isSelected=selectedJarIdx===cellarJars.indexOf(jar);
    var card=document.createElement('div');
    card.className='jar-opt'+(explored?' explored':'');
    // 计算路线方向（从routeHistory推断）
    var dirText='尚未规划路线';
    if(jar.routeHistory&&jar.routeHistory.length>0){
      var segs=jar.routeHistory[jar.routeHistory.length-1].segments||[];
      if(segs.length>0){
        var adx=0,ady=0;
        segs.forEach(function(s){adx+=s.dx||0;ady+=s.dy||0;});
        var acid=adx>0?'酸度→':'酸度←';
        var arom=ady<0?'香气↑':'香气↓';
        dirText='方向：'+acid+' · '+arom+' · '+segs.length+'步';
      }
    } else if(jar.todayRoute&&jar.todayRoute.segments&&jar.todayRoute.segments.length>0){
      var segs=jar.todayRoute.segments;
      var adx=0,ady=0;
      segs.forEach(function(s){adx+=s.dx||0;ady+=s.dy||0;});
      var acid=adx>0?'酸度→':'酸度←';
      var arom=ady<0?'香气↑':'香气↓';
      dirText='今日规划：'+acid+' · '+arom+' · '+segs.length+'步';
    }
    card.innerHTML=
      '<div class="jo-icon">'+jar.icon+'</div>'+
      '<div class="jo-name">'+jar.name+'</div>'+
      '<div class="jo-day">第'+jar.day+'天 · 还需'+jar.daysLeft+'天</div>'+
      '<div class="jo-route">'+dirText+'</div>'+
      '<div class="jo-status">'+(explored?'已探索 ✓':isSelected?'选中':'选择此坛')+'</div>'+
      '<div class="jo-arrow">▶</div>';
    if(!explored){
      (function(jarIdx){
        card.onclick=function(){selectJarExplore(jarIdx);};
      })(cellarJars.indexOf(jar));
    }
    list.appendChild(card);
  });
  // 再显示刚完成的坛子，提示领取结算
  newlyDoneJars.forEach(function(jar){
    var card=document.createElement('div');
    card.className='jar-opt';
    card.style.borderColor='#c9a227';
    // 找到对应的醋
    var rv=null;for(var i=0;i<readyVinegar.length;i++){if(readyVinegar[i].from===jar.name){rv=readyVinegar[i];break;}}
    card.innerHTML=
      '<div class="jo-icon">'+(rv?rv.icon:jar.icon)+'</div>'+
      '<div class="jo-name">'+jar.name+'</div>'+
      '<div class="jo-day">发酵完成 🎉 共 '+jar.totalDays+' 天</div>'+
      '<div class="jo-route">'+(rv?rv.name+' 酿成！':'醋已成熟')+'</div>'+
      '<div class="jo-status" style="color:#ffd700">点击查看结算 ✨</div>'+
      '<div class="jo-arrow">▶</div>';
    (function(j,rvItem){
      card.onclick=function(){
        document.getElementById('jar-select-overlay').classList.remove('show');
        j._brewResultShown=true;
        // 直接弹结算弹框
        var earn=20+j.totalDays*2;
        document.getElementById('m-title').textContent=(rvItem?rvItem.icon+' '+rvItem.name:j.name)+' 酿成！';
        document.getElementById('m-desc').textContent='【'+j.name+'】历经 '+j.totalDays+' 天，终于酿成了！';
        document.getElementById('m-earn').textContent='获得 '+earn+' 铜钱！';
        document.getElementById('m-islands').textContent='醋已加入仓库，可前往卖醋兑换铜钱。';
        gMoney+=earn;
        var activeLeft=cellarJars.filter(function(jj){return !jj.done;});
        var ndLeft=cellarJars.filter(function(jj){return jj.done&&!jj._brewResultShown;});
        _jarExploredDone=(exploredToday.length>=activeLeft.length&&ndLeft.length===0);
        var btn2=document.querySelector('#modal-overlay .act-btn');
        if(btn2){btn2.textContent=_jarExploredDone?'全部探索完毕 · 酿造结算':'继续探索其他坛子 →';}
        document.getElementById('modal-overlay').classList.add('show');
        updateAllUI();
      };
    })(jar,rv);
    list.appendChild(card);
  });
  var doneBtn=document.getElementById('jar-select-done-btn');
  var ndCount=newlyDoneJars.length;
  document.getElementById('js-done-count').textContent=exploredToday.length;
  document.getElementById('js-total-count').textContent=activeJars.length+(ndCount>0?'+'+ndCount+'（新成）':'');
  var allExplored=(exploredToday.length>=activeJars.length&&newlyDoneJars.length===0);
  if(allExplored&&(activeJars.length>0||cellarJars.length>0)){
    doneBtn.style.display='inline-block';
  } else {
    doneBtn.style.display='none';
  }
  // 安全守卫：没有任何坛子可探索时，直接回地窖
  if(activeJars.length===0&&newlyDoneJars.length===0){
    goCellar();toast('地窖中没有醋坛，请先开新坛！');return;
  }
  overlay.classList.add('show');
}

// 选坛后开始探索
function selectJarExplore(jarIdx){
  selectedJarIdx=jarIdx;
  var jar=cellarJars[jarIdx];
  document.getElementById('jar-select-overlay').classList.remove('show');
  // 初始化坛子探索状态（起点snap到格子中心）
  if(!jar.curPos){
    var sp=snapToGrid(MAP_W/2,MAP_H/2);
    jar.curPos={x:sp.x,y:sp.y};
  } else {
    var sp2=snapToGrid(jar.curPos.x,jar.curPos.y);
    jar.curPos.x=sp2.x;jar.curPos.y=sp2.y;
  }
  // 地窖路线规划起点同步到坛子当前位置
  cellarPlanPos={x:jar.curPos.x,y:jar.curPos.y};cellarPlanPath=[];cellarPlanIngs=[];
  if(!jar.pathPts)jar.pathPts=[];
  if(!jar.autoMovePath)jar.autoMovePath=[];
  jar.autoMoving=false;
  jar.autoMoveIdx=0;
  jar.histStart=jar.pathPts.length||0;
  // 用坛子的路线构建autoMovePath
  // 每步 segment 直接映射为一个路点，不再用距离阈值吞步。
  // 配合 moveIdx 增速 0.04，确保路线长度和规划步数成正比。
  var movePath=[];
  if(jar.routeHistory&&jar.routeHistory.length>0){
    var lastRd=jar.routeHistory[jar.routeHistory.length-1];
    if(lastRd.segments&&lastRd.segments.length>0){
      var mpStart={x:jar.curPos.x,y:jar.curPos.y};
      movePath.push({x:mpStart.x,y:mpStart.y});
      var accX=mpStart.x,accY=mpStart.y;
      lastRd.segments.forEach(function(seg){
        accX+=seg.dx;
        accY+=seg.dy;
        accX=Math.max(15,Math.min(MAP_W-15,accX));
        accY=Math.max(15,Math.min(MAP_H-15,accY));
        movePath.push({x:accX,y:accY});
      });
    }
  }
  jar.autoMovePath=movePath;
  // 同步全局pathPts和curPos
  pathPts=(jar.pathPts&&jar.pathPts.length>0)?jar.pathPts:[];
  autoMovePath=jar.autoMovePath||[];
  autoMoveIdx=jar.autoMoveIdx||0;
  autoMoving=jar.autoMoving||false;
  window._pathHistoryStart=jar.histStart||0;
  // 进入新坛探索时重置传送门冷却和弹框防重，防止上一坛的状态污染
  _teleportCooldown=0;
  _lastTeleportDestId='';
  _mapModalShown=false;
  // 启动地图：先切显示，等DOM重排后再初始化，防止空白
  showScreen('map-screen');
  requestAnimationFrame(function(){
    if(!gMapActive){initMapGame();}
    else if(!ctx||!canvas){initCanvas();}
    else{
      // 兜底：若画布曾被隐藏期onResize归零，在此强制修复
      var area=document.getElementById('map-area');
      if(area&&area.clientWidth>=10&&area.clientHeight>=10){
        if(cw<10||ch<10||canvas.width<10||canvas.height<10){
          cw=area.clientWidth;ch=area.clientHeight;
          canvas.width=cw;canvas.height=ch;
        }
      }
    }
    curPos={x:jar.curPos.x,y:jar.curPos.y};
    usedIngreds=[];
    if(cw&&ch){camX=curPos.x-cw/zoom/2;camY=curPos.y-ch/zoom/2;}
    else{camX=curPos.x-400;camY=curPos.y-300;}
    clampCam();
    revealAround(curPos.x,curPos.y,140,true);
    document.getElementById('map-back-cellar-btn').style.display='none';
    updateAllUI();
    if(movePath.length>1){
      setJarAutoMoving(true);setJarAutoMoveIdx(0);
      toast(jar.name+' 正在沿规划路线前进……');
    } else {
      toast(jar.name+' 今日无路线规划，原地休养中……');
      setTimeout(function(){
        if(jar&&exploredToday.indexOf(jar.id)<0)exploredToday.push(jar.id);
        showJarSelect();
      },1800);
    }
  });
}

// 所有坛子探索完毕
function allJarsExplored(){
  document.getElementById('jar-select-overlay').classList.remove('show');
  showBrewingSummary();
}

// 直接入口（兼容旧调用，跳转到选坛界面）
function startMapExplore(){
  document.getElementById('brew-summary-overlay').classList.remove('show');
  showJarSelect();
}

// ========== 核心入口：直接进入地窖 ==========
function startGame(){
  console.log('startGame called');
  try{
    document.getElementById('title-screen').style.display='none';
    gDay=1;gMoney=30;
    // 四种基础食材无限（用Infinity标记）
    ingredStock={'xiaomi':Infinity,'maisui':Infinity,'gaoliang':Infinity,'shui':Infinity};
    unlockedIng={'xiaomi':true,'maisui':true,'gaoliang':true,'shui':true};
    // 彻底重置坛子与仓库（防止旧局残留）
    cellarJars=[];cellarSelectedIdx=-1;
    cellarUsedToday=false;cellarNewJarToday=false;
    readyVinegar=[];vinegarStock={};
    // 重置地图探索状态
    discovered={};knownVisited={};
    pathPts=[];curPos={x:MAP_W/2,y:MAP_H/2};
    camX=0;camY=0;zoom=1.0;
    fog=[];gMapActive=false;
    usedIngreds=[];selectedIng=null;
    exploredToday=[];selectedJarIdx=-1;
    _jarExploredDone=false;_mapModalShown=false;
    autoMoving=false;autoMovePath=[];autoMoveIdx=0;
    goCellar();
  }catch(e){
    console.error('startGame error:',e);
    alert('初始化错误：'+e.message);
  }
}

function toast(msg){var t=document.getElementById('toast');t.textContent=msg;t.className='show';setTimeout(function(){t.classList.remove('show');},2600);}
function toastError(msg){var t=document.getElementById('toast');t.textContent=msg;t.className='show error';setTimeout(function(){t.classList.remove('show');t.classList.remove('error');},3000);}
function redAlert(msg,dur){var el=document.getElementById('red-alert');if(!el)return;el.textContent=msg;el.style.display='block';setTimeout(function(){el.style.display='none';},dur||2000);}
function hideAll(){['title-screen','cellar-screen','map-screen'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});['modal-overlay','brew-summary-overlay','jar-select-overlay','know-overlay'].forEach(function(id){var el=document.getElementById(id);if(el)el.classList.remove('show');});}
function showScreen(id){hideAll();document.getElementById(id).style.display='block';}

// ========== DAILY ==========
function updateDailyVinegarUI(){} // 保留空函数兼容调用
function refreshDailyUI(){}       // 保留空函数

// ========== CELLAR ==========
function goCellar(){
  showScreen('cellar-screen');
  // 更新顶栏
  var dn=document.getElementById('cellar-day-num');if(dn)dn.textContent=gDay;
  var mn=document.getElementById('cellar-money-num');if(mn)mn.textContent=gMoney;
  cellarSelectedIdx=-1;cellarPlanSteps=1;cellarSelIng=null;
  resetCellarRoute();renderJarList();resetCellarPanel();
  renderCellarIngList();renderReadyVinegar();
  document.getElementById('cellar-used-notice').style.display='none';
  document.getElementById('cellar-dlg-text').textContent='地窖里凉意阵阵，醋坛静静发酵。选醋坛→选食材→设步数→添加到路线。';
  // 重置探索状态，防止上一周期的状态污染
  exploredToday=[];_jarExploredDone=false;_mapModalShown=false;
}
function renderJarList(){var list=document.getElementById('jar-list');list.innerHTML='';cellarJars.forEach(function(jar,idx){var sl=document.createElement('div');var pg=Math.round((1-jar.daysLeft/jar.totalDays)*100);sl.className='jar-slot'+(cellarSelectedIdx===idx?' selected':'');sl.innerHTML='<div class="j-icon">'+(jar.done?'✅':jar.icon)+'</div><div class="j-name">'+jar.name+(jar.done?' 已成':'')+'</div><div class="j-day">发酵第'+jar.day+'天</div><div class="j-day">还需'+jar.daysLeft+'天</div><div class="j-progress"><div class="j-bar" style="width:'+pg+'%"></div></div>';if(!jar.done){sl.onclick=(function(i){return function(){selectJar(i);};})(idx);}list.appendChild(sl);});if(!cellarNewJarToday&&cellarJars.length<5){var em=document.createElement('div');em.className='jar-slot empty-slot';em.innerHTML='<div class="j-icon">➕</div><div class="j-name">新开一坛</div><div class="j-day">每日限一坛</div>';em.onclick=newJar;list.appendChild(em);}}

function selectJar(idx){cellarSelectedIdx=idx;resetCellarRoute();var jar=cellarJars[idx];cellarPlanSteps=1;document.getElementById('cellar-step-val').textContent='1';document.getElementById('cellar-controls').style.display='flex';document.getElementById('cellar-confirm-btn').style.display='block';document.getElementById('cellar-new-btn').style.display='none';document.getElementById('cellar-panel-title').textContent=jar.name+' · 格子路线规划';
  var statusText='【'+jar.name+'】发酵第'+jar.day+'天，还需'+jar.daysLeft+'天。\n';
  statusText+='选择食材 → 设置步数 → 点击「添加到路线」，每步走一格。';
  if(jar.brewIng){
    var bi=INGREDIENTS_DEF.find(function(x){return x.id===jar.brewIng;});
    if(bi){cellarSelIng=bi;var wrap=document.getElementById('cellar-route-wrap');if(wrap)wrap.style.display='block';drawCellarRoute();statusText+='\n已绑定食材：【'+bi.name+'】。';}
  }else{
    cellarSelIng=null;
    statusText+='\n尚未绑定食材——先从右侧选食材，设置步数后添加到路线。';
  }
  document.getElementById('cellar-jar-status').textContent=statusText;
  renderCellarIngList();renderJarList();
}

function resetCellarPanel(){document.getElementById('cellar-controls').style.display='none';document.getElementById('cellar-confirm-btn').style.display='none';document.getElementById('cellar-new-btn').style.display='block';document.getElementById('cellar-new-btn').disabled=cellarNewJarToday||cellarJars.length>=5;document.getElementById('cellar-panel-title').textContent='选择一个醋坛';document.getElementById('cellar-jar-status').textContent='↖ 点击左侧醋坛查看，或新建一坛（每日限一坛）';resetCellarRoute();}

function cellarStepMinus(){cellarPlanSteps=Math.max(1,cellarPlanSteps-1);document.getElementById('cellar-step-val').textContent=cellarPlanSteps;}
function cellarStepPlus(){cellarPlanSteps=Math.min(20,cellarPlanSteps+1);document.getElementById('cellar-step-val').textContent=cellarPlanSteps;}
function cellarAddStep(){
  if(!cellarSelIng){toast('请先选择一个食材！');return;}
  var jar=cellarJars[cellarSelectedIdx];
  if(!jar){toast('请先选择一个醋坛！');return;}
  var stock=ingredStock[cellarSelIng.id]||0;
  if(stock<=0&&!unlockedIng[cellarSelIng.id]){toast('【'+cellarSelIng.name+'】尚未解锁！');return;}
  var step=ingStep(cellarSelIng);
  for(var s=0;s<cellarPlanSteps;s++){
    cellarPlanPos.x+=step.dx;cellarPlanPos.y+=step.dy;
    cellarPlanPath.push({x:cellarPlanPos.x,y:cellarPlanPos.y,ing:cellarSelIng});
    cellarPlanIngs.push(cellarSelIng.id);
  }
  if(cellarSelIng.cost===0&&isFinite(ingredStock[cellarSelIng.id])&&ingredStock[cellarSelIng.id]>0)ingredStock[cellarSelIng.id]-=cellarPlanSteps;
  drawCellarRoute();
  var stepsEl=document.getElementById('cellar-route-steps');
  if(stepsEl)stepsEl.textContent='今日进程：'+cellarPlanPath.length+' 步（'+cellarSelIng.name+' ×'+cellarPlanSteps+'）';
  toast('【'+cellarSelIng.name+'】×'+cellarPlanSteps+'步已添加！');
  renderCellarIngList();
}

function confirmCellarAction(){
  if(cellarSelectedIdx<0){toast('请先选择一个醋坛！');return;}
  var jar=cellarJars[cellarSelectedIdx];
  var savedSeg=[];
  cellarPlanPath.forEach(function(p){
    if(p.ing){
      var step=ingStep(p.ing);
      savedSeg.push({dx:step.dx,dy:step.dy,ingId:p.ing.id,ingName:p.ing.name,ingIcon:p.ing.icon});
    }
  });
  if(savedSeg.length>0){jar.todayRoute={day:gDay,segments:savedSeg};}
  markCellarDone('今日格子路线已规划完毕，醋自有它的时间。');
}

function newJar(){
  if(cellarNewJarToday){toast('今天已经开过新坛了，明天再来！');return;}
  var idx=cellarJars.length;
  var days=JAR_DAYS[Math.floor(Math.random()*JAR_DAYS.length)];
  var newJar={id:Date.now(),name:JAR_NAMES[Math.floor(Math.random()*JAR_NAMES.length)]+' #'+(idx+1),day:1,daysLeft:days,totalDays:days,done:false,icon:JAR_ICONS[idx%3],linkedIng:JAR_LINKED[idx%3],routeHistory:[],todayRoute:null};
  if(cellarPlanIngs.length>0){
    var lastId=cellarPlanIngs[cellarPlanIngs.length-1];
    var lastIng=INGREDIENTS_DEF.find(function(x){return x.id===lastId;});
    if(lastIng){newJar.brewIng=lastIng.id;newJar.brewGridDx=lastIng.gridDx;newJar.brewGridDy=lastIng.gridDy;}
  }else if(cellarSelIng){
    newJar.brewIng=cellarSelIng.id;newJar.brewGridDx=cellarSelIng.gridDx;newJar.brewGridDy=cellarSelIng.gridDy;
  }
  cellarJars.push(newJar);cellarSelectedIdx=cellarJars.length-1;cellarNewJarToday=true;
  toast('新开了一坛！记得每天来调整。');
  markCellarDone('新坛子开了，温度适中，接下来靠时间慢慢发酵。');
}

function markCellarDone(msg){cellarUsedToday=true;document.getElementById('cellar-used-notice').style.display='block';document.getElementById('cellar-confirm-btn').style.display='none';document.getElementById('cellar-new-btn').style.display='none';var wrap=document.getElementById('cellar-route-wrap');if(wrap)wrap.style.display='none';document.getElementById('cellar-dlg-text').textContent=msg||'今日操作完毕。';renderJarList();}

function leaveCellar(){
  cellarPreviewMode=false;
  // 将今日地窖路线保存
  cellarJars.forEach(function(j){
    if(j.todayRoute && j.todayRoute.segments && j.todayRoute.segments.length>0){
      j.routeHistory.push({day:gDay,segments:j.todayRoute.segments});
      j.todayRoute=null;
    }
  });
  // 天数推进
  cellarJars.forEach(function(j){
    if(!j.done){
      j.daysLeft--;j.day++;
      if(j.daysLeft<=0){
        j.daysLeft=0;j.done=true;
        if(j.linkedIng){unlockedIng[j.linkedIng]=true;ingredStock[j.linkedIng]=Infinity;}
        var ing=j.brewIng?INGREDIENTS_DEF.find(function(x){return x.id===j.brewIng;}):null;
        var vinegarName=ing?ing.name+'醋':(j.linkedIng?INGREDIENTS_DEF.find(function(x){return x.id===j.linkedIng;}).name+'醋':'陈醋');
        var vinegarIcon=ing?ing.icon:'🍶';
        readyVinegar.push({name:vinegarName,icon:vinegarIcon,ingId:j.brewIng||j.linkedIng,from:j.name});
        toast('🎉 '+j.name+' 酿成了！得到【'+vinegarName+'】！');
        if(j.brewIng&&fog.length){
          var ing2=INGREDIENTS_DEF.find(function(x){return x.id===j.brewIng;});
          if(ing2){
            var stp=ingStep(ing2);
            revealAround(MAP_W/2+stp.dx*2,MAP_H/2+stp.dy*2,180,false);
            revealAround(MAP_W/2+stp.dx,MAP_H/2+stp.dy,120,false);
          }
        }
      }
    }
  });
  gDay++;
  curPos={x:MAP_W/2,y:MAP_H/2};
  exploredToday=[];selectedJarIdx=-1;
  cellarUsedToday=false;cellarNewJarToday=false;
  _jarExploredDone=false;_mapModalShown=false;
  // 如果没有活跃坛子，直接回地窖让玩家开新坛
  var activeLeft=cellarJars.filter(function(j){return !j.done;});
  if(activeLeft.length===0){
    goCellar();
    toast('所有醋坛已酿成！请开新坛继续酿造。');
  } else {
    showJarSelect();
  }
}

function previewMapFromCellar(){if(!cellarSelIng){toast('请先在右侧选择一个食材！');return;}selectedIng=cellarSelIng;cellarPreviewMode=true;if(!gMapActive)initMapGame();document.getElementById('map-back-cellar-btn').style.display='block';showScreen('map-screen');updatePreview();toast('已选【'+cellarSelIng.name+'】，点击地图放置');}

function goBackToCellar(){
  cellarPreviewMode=false;
  if(selectedIng&&!cellarUsedToday){cellarSelIng=selectedIng;renderCellarIngList();}
  selectedIng=null;
  document.getElementById('map-back-cellar-btn').style.display='none';
  showScreen('cellar-screen');
  var dn=document.getElementById('cellar-day-num');if(dn)dn.textContent=gDay;
  var mn=document.getElementById('cellar-money-num');if(mn)mn.textContent=gMoney;
  renderJarList();resetCellarPanel();renderCellarIngList();renderReadyVinegar();
}

function renderReadyVinegar(){var panel=document.getElementById('cellar-vinegar-panel');var list=document.getElementById('cellar-vinegar-list');if(!panel||!list)return;list.innerHTML='';if(readyVinegar.length===0){panel.style.display='none';return;}panel.style.display='block';panel.querySelector('h5').textContent='可收取醋 ('+readyVinegar.length+'坛)';readyVinegar.forEach(function(v,i){(function(idx){var item=document.createElement('div');item.className='vinegar-ready-item';item.innerHTML='<span class="vi-icon">'+v.icon+'</span><div class="vi-info"><div class="vi-name">'+v.name+'</div><div class="vi-from">来自：'+v.from+'</div></div><span style="color:#ffd700;font-size:10px">点击收取</span>';item.onclick=function(){collectVinegar(idx);};list.appendChild(item);})(i);});}

function collectVinegar(idx){var v=readyVinegar.splice(idx,1)[0];vinegarStock[v.ingId]=(vinegarStock[v.ingId]||0)+1;toast('收到【'+v.name+'】×1！');renderReadyVinegar();updateDailyVinegarUI();}

function resetCellarRoute(){var jar=cellarSelectedIdx>=0?cellarJars[cellarSelectedIdx]:null;if(jar&&jar.curPos){cellarPlanPos={x:jar.curPos.x,y:jar.curPos.y};}else{cellarPlanPos={x:MAP_W/2,y:MAP_H/2};}cellarPlanPath=[];cellarPlanIngs=[];var wrap=document.getElementById('cellar-route-wrap');if(wrap)wrap.style.display='none';var steps=document.getElementById('cellar-route-steps');if(steps)steps.textContent='已走 0 步';drawCellarRoute();}

function drawCellarRoute(){
  var cvs=document.getElementById('cellar-route-canvas');
  if(!cvs)return;
  try{
  var dpr=Math.max(1,Math.round(window.devicePixelRatio||1));
  var CSS_W=300,CSS_H=180;
  var needW=CSS_W*dpr,needH=CSS_H*dpr;
  if(cvs.width!==needW||cvs.height!==needH){
    cvs.width=needW;cvs.height=needH;
    cvs.style.width=CSS_W+'px';cvs.style.height=CSS_H+'px';
  }
  var c=cvs.getContext('2d');
  if(!c)return;
  c.setTransform(dpr,0,0,dpr,0,0);
  var W=CSS_W,H=CSS_H;
  // 等比缩放：2400×2400地理坐标 → 300×180 canvas
  var scx=W/MAP_W,scy=H/MAP_H;
  function mx(x){return x*scx;}
  function my(y){return y*scy;}

  // 背景
  c.fillStyle='#060510';c.fillRect(0,0,W,H);

  // ── 读取当前选中坛子的路径数据（而非全局变量）
  var _jar=cellarSelectedIdx>=0?cellarJars[cellarSelectedIdx]:null;
  var _pts=(_jar&&_jar.pathPts&&_jar.pathPts.length>0)?_jar.pathPts:[];
  // 备用：如果pathPts没有数据，从routeHistory构建历史路线
  if(_pts.length<=1&&_jar&&_jar.routeHistory&&_jar.routeHistory.length>0){
    _pts=[{x:MAP_W/2,y:MAP_H/2}];
    _jar.routeHistory.forEach(function(rd){
      if(rd.segments){
        rd.segments.forEach(function(seg){
          var last=_pts[_pts.length-1];
          _pts.push({x:last.x+seg.dx,y:last.y+seg.dy});
        });
      }
    });
  }
  var _curX=_jar&&_jar.curPos?_jar.curPos.x:MAP_W/2;
  var _curY=_jar&&_jar.curPos?_jar.curPos.y:MAP_H/2;
  // 坛子选中前默认显示地图中心
  if(!_jar){_curX=MAP_W/2;_curY=MAP_H/2;}

  // 绘制岛屿
  for(var ii=0;ii<ISLANDS.length;ii++){
    var isl=ISLANDS[ii];
    var disc=discovered&&discovered[isl.id];
    var ir=Math.max(isl.r*scx,3);
    c.beginPath();c.arc(mx(isl.x),my(isl.y),ir,0,Math.PI*2);
    c.fillStyle=disc?isl.color+'55':'rgba(60,50,70,0.5)';
    c.fill();
    c.strokeStyle=disc?isl.color:'rgba(100,80,120,0.4)';
    c.lineWidth=disc?1.5:1;c.stroke();
    c.fillStyle=disc?isl.color:'rgba(120,100,140,0.6)';
    c.font='7px SimSun';c.textAlign='center';c.textBaseline='middle';
    c.fillText(disc?isl.name:'？？',mx(isl.x),my(isl.y));
  }

  // 绘制传送门
  for(var pi=0;pi<PORTALS.length;pi++){
    var pt=PORTALS[pi];
    var pr=Math.max(pt.r*scx,3);
    c.beginPath();c.arc(mx(pt.x),my(pt.y),pr,0,Math.PI*2);
    c.fillStyle='rgba(138,43,226,0.55)';c.fill();
    c.strokeStyle='rgba(200,150,255,0.8)';c.lineWidth=1;c.stroke();
  }

  // 起点（地图中心）
  var sx=mx(MAP_W/2),sy=my(MAP_H/2);
  c.beginPath();c.arc(sx,sy,4,0,Math.PI*2);
  c.fillStyle='rgba(255,215,0,0.6)';c.fill();
  c.strokeStyle='rgba(255,255,255,0.4)';c.lineWidth=1;c.stroke();
  c.fillStyle='rgba(255,215,0,0.6)';c.font='7px SimSun';c.textAlign='center';c.textBaseline='top';
  c.fillText('起点',sx,sy+5);c.textBaseline='alphabetic';

  // 绘制历史已走路径（金色实线，和大地图一致）
  if(_pts&&_pts.length>1){
    c.strokeStyle='rgba(220,160,60,0.9)';c.lineWidth=1.5;c.setLineDash([]);
    c.beginPath();
    c.moveTo(mx(_pts[0].x),my(_pts[0].y));
    for(var pj=1;pj<_pts.length;pj++)c.lineTo(mx(_pts[pj].x),my(_pts[pj].y));
    c.stroke();
    for(var pk=0;pk<_pts.length;pk++){
      c.beginPath();c.arc(mx(_pts[pk].x),my(_pts[pk].y),1.5,0,Math.PI*2);
      c.fillStyle='#e0a040';c.fill();
    }
  }

  // 当前位置（预测路线起点）
  var startX=_curX,startY=_curY;
  c.beginPath();c.arc(mx(startX),my(startY),3,0,Math.PI*2);
  c.fillStyle='#ffd700';c.fill();
  c.strokeStyle='#fff';c.lineWidth=1;c.stroke();

  // 今日规划路线：cellarPlanPath 已存像素坐标，直接连线
  if(cellarPlanPath.length>0){
    var predX=startX,predY=startY;
    var predPts=[{x:predX,y:predY}];
    for(var ci=0;ci<cellarPlanPath.length;ci++){
      var step=cellarPlanPath[ci];
      if(step.ing){
        var nxtX=Math.max(10,Math.min(MAP_W-10,step.x));
        var nxtY=Math.max(10,Math.min(MAP_H-10,step.y));
        predPts.push({x:nxtX,y:nxtY,ing:step.ing});
        predX=nxtX;predY=nxtY;
      }
    }
    if(predPts.length>0){
      var lastPP=predPts[predPts.length-1];
      if(Math.sqrt(Math.pow(predX-lastPP.x,2)+Math.pow(predY-lastPP.y,2))>0.5)
        predPts.push({x:predX,y:predY});
    }
    if(predPts.length>1){
      c.setLineDash([5,3]);c.strokeStyle='rgba(255,215,0,0.9)';c.lineWidth=2;
      c.beginPath();c.moveTo(mx(predPts[0].x),my(predPts[0].y));
      for(var pi2=1;pi2<predPts.length;pi2++)c.lineTo(mx(predPts[pi2].x),my(predPts[pi2].y));
      c.stroke();c.setLineDash([]);
      var last=predPts[predPts.length-1];
      var prev=predPts[predPts.length-2]||predPts[0];
      var ang=Math.atan2(my(last.y)-my(prev.y),mx(last.x)-mx(prev.x));
      var ex=mx(last.x),ey=my(last.y);
      c.fillStyle='rgba(255,215,0,0.95)';
      c.beginPath();c.moveTo(ex,ey);
      c.lineTo(ex-8*Math.cos(ang-0.45),ey-8*Math.sin(ang-0.45));
      c.lineTo(ex-8*Math.cos(ang+0.45),ey-8*Math.sin(ang+0.45));
      c.closePath();c.fill();
    }
  }

  // 食材散落点（小地图）
  for(var sdi=0;sdi<INGREDIENT_DROPS.length;sdi++){
    var sdp=INGREDIENT_DROPS[sdi];
    var isUnlocked=!!unlockedIng[sdp.id];
    var sding=INGREDIENTS_DEF.find(function(x){return x.id===sdp.id;});
    c.beginPath();c.arc(mx(sdp.x),my(sdp.y),isUnlocked?2:3,0,Math.PI*2);
    c.fillStyle=isUnlocked?'rgba(100,255,150,0.9)':'rgba(255,215,0,0.9)';c.fill();
    c.strokeStyle='#fff';c.lineWidth=0.6;c.stroke();
    if(sding){
      c.fillStyle=isUnlocked?'rgba(120,255,160,0.8)':'rgba(255,215,0,0.8)';
      c.font='6px SimSun';c.textAlign='center';c.textBaseline='top';
      c.fillText(isUnlocked?sding.icon:'?',mx(sdp.x),my(sdp.y)+5);
    }
  }

  // 图例（右下角）
  c.font='8px SimSun';c.textBaseline='middle';
  var ly=H-20;
  c.strokeStyle='rgba(220,160,60,0.9)';c.lineWidth=1.5;c.setLineDash([]);
  c.beginPath();c.moveTo(10,ly);c.lineTo(24,ly);c.stroke();
  c.fillStyle='#aaa';c.textAlign='left';c.fillText('历史',28,ly);

  c.strokeStyle='rgba(255,215,0,0.9)';c.lineWidth=1.5;c.setLineDash([4,3]);
  c.beginPath();c.moveTo(60,ly);c.lineTo(74,ly);c.stroke();c.setLineDash([]);
  c.fillStyle='#ffd700';c.fillText('今日预测',78,ly);

  c.fillStyle='rgba(100,255,150,0.9)';c.beginPath();c.arc(9,ly+13,2.5,0,Math.PI*2);c.fill();
  c.strokeStyle='#fff';c.lineWidth=0.6;c.stroke();
  c.fillStyle='#aaa';c.fillText('食材点',18,ly+13);
  }catch(err){
    console.error('drawCellarRoute error:',err);
    var c=cvs.getContext('2d');
    if(c){c.fillStyle='#300';c.fillRect(0,0,cvs.width,cvs.height);c.fillStyle='#f55';c.font='12px SimSun';c.textAlign='center';c.fillText('预览渲染出错',cvs.width/2,cvs.height/2);}
  }
}

function onCellarRouteClick(e){if(!cellarSelIng){toast('请先选择一个食材！');return;}var stock=ingredStock[cellarSelIng.id]||0;if(stock<=0&&!unlockedIng[cellarSelIng.id]){toast('【'+cellarSelIng.name+'】尚未解锁，探索地图可以发现新食材！');return;}var step=ingStep(cellarSelIng);cellarPlanPos.x+=step.dx;cellarPlanPos.y+=step.dy;cellarPlanPath.push({x:cellarPlanPos.x,y:cellarPlanPos.y,ing:cellarSelIng});cellarPlanIngs.push(cellarSelIng.id);if(cellarSelIng.cost===0&&isFinite(ingredStock[cellarSelIng.id])&&ingredStock[cellarSelIng.id]>0)ingredStock[cellarSelIng.id]--;drawCellarRoute();var stepsEl=document.getElementById('cellar-route-steps');if(stepsEl)stepsEl.textContent='今日进程：'+cellarPlanPath.length+' 步（当前：'+cellarSelIng.name+' · '+cellarSelIng.desc+'）';toast('【'+cellarSelIng.name+'】点击预览地图放置，路线已更新！');renderCellarIngList();}

// ========== CELLAR INGREDIENT PANEL ==========
function renderCellarIngList(){
  var list=document.getElementById('cellar-ing-list');
  var previewBtn=document.getElementById('cellar-preview-btn');
  list.innerHTML='';
  var basics=INGREDIENTS_DEF.filter(function(i){return i.basic;});
  var hiddenUnlocked=INGREDIENTS_DEF.filter(function(i){return i.hidden&&unlockedIng[i.id];});
  var hiddenLocked=INGREDIENTS_DEF.filter(function(i){return i.hidden&&!unlockedIng[i.id];});
  var toRender=basics.concat(hiddenUnlocked).concat(hiddenLocked);
  toRender.forEach(function(ing){
    var isBasic=!!ing.basic;
    var isUnlocked=!!unlockedIng[ing.id];
    var isHiddenLocked=ing.hidden&&!isUnlocked;
    var item=document.createElement('div');
    item.className='cellar-ing-item'+(isHiddenLocked?' ci-locked':'')+(cellarSelIng&&cellarSelIng.id===ing.id?' ci-selected':'');
    if(isHiddenLocked){
      item.innerHTML='<span class="ci-icon">🔒</span><div class="ci-info"><div class="ci-name" style="color:#5a3a18">未知食材</div><div class="ci-stock" style="color:#3a2010">探索地图解锁</div><div class="ci-dir" style="color:#3a2010">? ?</div></div>';
    }else{
      var stockTxt=isBasic?'∞':'∞';
      var acidDir=ing.gridDx>0?('→'+ing.gridDx):(ing.gridDx<0?('←'+(-ing.gridDx)):'=');
      var aromaDir=ing.gridDy>0?('↑'+ing.gridDy):(ing.gridDy<0?('↓'+(-ing.gridDy)):'=');
      var dist=Math.abs(ing.gridDx)+Math.abs(ing.gridDy)+'格/步';
      var unlockBadge=ing.hidden?'<div class="ci-effect" style="color:#c9a227;font-size:8px">★ 探索解锁</div>':'';
      item.innerHTML='<span class="ci-icon">'+ing.icon+'</span><div class="ci-info"><div class="ci-name">'+ing.name+'</div><div class="ci-stock">库存:'+stockTxt+'</div><div class="ci-dir">'+acidDir+' '+aromaDir+'</div><div class="ci-power">'+dist+'</div><div class="ci-effect">'+ing.desc+'</div>'+unlockBadge+'</div>';
      (function(ingR){item.onclick=function(){selectCellarIng(ingR);};})(ing);
    }
    list.appendChild(item);
  });
  if(previewBtn)previewBtn.style.display=(cellarSelectedIdx>=0&&cellarSelIng&&!cellarUsedToday)?'block':'none';
}

function selectCellarIng(ing){cellarSelIng=ing;selectedIng=ing;var wrap=document.getElementById('cellar-route-wrap');if(wrap){wrap.style.display='block';}drawCellarRoute();renderCellarIngList();document.getElementById('cellar-dlg-text').textContent='已选【'+ing.name+'】（'+ing.desc+'）——设置步数后点击「添加到路线」，每次一步沿食材方向前进一格。可多次添加规划多段路线。';toast('已选食材：'+ing.name+'，设置步数后添加到路线');}

// ========== SELL ==========
// ========== MAP ==========
function initMapGame(){
  if(gMapActive)return;
  gMapActive=true;
  usedIngreds=[];selectedIng=null;
  revealAnims=[];animating=false;animPts=[];animIdx=0;
  if(!unlockedIng['xiaomi'])unlockedIng['xiaomi']=true;
  if(!unlockedIng['shui'])unlockedIng['shui']=true;
  // 迷雾和发现状态只在首次初始化时创建，后续坛子探索共享
  if(!fog||!fog.length){
    fog=[];
    for(var gy=0;gy<MAP_H/8;gy++){fog[gy]=[];for(var gx=0;gx<MAP_W/8;gx++)fog[gy][gx]=0;}
  }
  if(!discovered)discovered={};
  if(!knownVisited)knownVisited=[];
  // pathPts和curPos由selectJarExplore设置，不在此重置
  initCanvas();
  updateAllUI();
}

function initCanvas(){
  try{
    if(window._mapLoopRunning)return;
    canvas=document.getElementById('map-canvas');if(!canvas)return;
    ctx=canvas.getContext('2d');if(!ctx)return;
    offCanvas=document.createElement('canvas');offCanvas.width=MAP_W;offCanvas.height=MAP_H;offCtx=offCanvas.getContext('2d');
    rebuildFogLayer();
    var area=document.getElementById('map-area');
    cw=(area&&area.clientWidth)?area.clientWidth:800;
    ch=(area&&area.clientHeight)?area.clientHeight:600;
    if(cw<10)cw=800;if(ch<10)ch=600;
    canvas.width=cw;canvas.height=ch;
    clampCam();
    canvas.onwheel=onWheel;canvas.onclick=onMapClick;window.onresize=onResize;
    window._mapLoopRunning=true;
    requestAnimationFrame(loop);
  }catch(e){
    console.error('initCanvas error:',e);
  }
}

function onResize(){var a=document.getElementById('map-area');if(!a||!canvas)return;var nw=a.clientWidth,nh=a.clientHeight;if(nw<10||nh<10)return;cw=nw;ch=nh;canvas.width=cw;canvas.height=ch;clampCam();}
function clampCam(){camX=Math.max(0,Math.min(MAP_W-cw/zoom,camX));camY=Math.max(0,Math.min(MAP_H-ch/zoom,camY));}

// generateBypath已删除（无障碍物系统）
function mapCoords(sx,sy){return{x:sx/zoom+camX,y:sy/zoom+camY};}

function rebuildFogLayer(){if(!offCtx||!offCanvas)return;offCtx.fillStyle='#0a0a18';offCtx.fillRect(0,0,MAP_W,MAP_H);offCtx.strokeStyle='rgba(255,255,255,0.04)';offCtx.lineWidth=1;for(var x=0;x<MAP_W;x+=80){offCtx.beginPath();offCtx.moveTo(x,0);offCtx.lineTo(x,MAP_H);offCtx.stroke();}for(var y=0;y<MAP_H;y+=80){offCtx.beginPath();offCtx.moveTo(0,y);offCtx.lineTo(MAP_W,y);offCtx.stroke();}for(var gy=0;gy<MAP_H/8;gy++){if(!fog[gy])continue;for(var gx=0;gx<MAP_W/8;gx++){if(fog[gy][gx]===0){offCtx.fillStyle='rgba(4,4,12,0.92)';offCtx.fillRect(gx*8,gy*8,8,8);}}}}

function revealAround(cx,cy,r,animate){var gr=Math.ceil(r/8),gx=Math.floor(cx/8),gy=Math.floor(cy/8);for(var dy=-gr;dy<=gr;dy++)for(var dx=-gr;dx<=gr;dx++){var nx=gx+dx,ny=gy+dy;if(nx>=0&&nx<MAP_W/8&&ny>=0&&ny<MAP_H/8&&dx*dx+dy*dy<=gr*gr&&fog[ny])fog[ny][nx]=1;}if(animate)revealAnims.push({cx:cx,cy:cy,r:r,t:performance.now()});rebuildFogLayer();}

function onWheel(e){e.preventDefault();var rect=canvas.getBoundingClientRect();var b=mapCoords(e.clientX-rect.left,e.clientY-rect.top);if(e.deltaY<0)zoom=Math.min(MAX_ZOOM,zoom*1.12);else zoom=Math.max(MIN_ZOOM,zoom/1.12);camX=b.x-cw/zoom/2;camY=b.y-ch/zoom/2;clampCam();}

function placeIngredient(tx,ty){if(!selectedIng)return;if(cellarPreviewMode){toast('地图预览模式：食材已绑定到醋坛，可返回地窖确认。');selectedIng=null;document.querySelectorAll('.ing-card').forEach(function(c){c.classList.remove('active');});updatePreview();return;}var ing=selectedIng;if((ingredStock[ing.id]||0)<=0&&!unlockedIng[ing.id]){toast('【'+ing.name+'】尚未解锁，探索地图可以发现新食材！');selectedIng=null;return;}var stp=ingStep(ing);var rawX=curPos.x+stp.dx,rawY=curPos.y+stp.dy;var tar=snapToGrid(rawX,rawY);animPts=[];animPts.push({x:curPos.x,y:curPos.y});var midX=(curPos.x+tar.x)/2,midY=(curPos.y+tar.y)/2;animPts.push({x:midX,y:midY});animPts.push({x:tar.x,y:tar.y});animating=true;animIdx=0;animStart={x:curPos.x,y:curPos.y};selectedIng=null;usedIngreds.push(ing.id);gMoney-=ing.cost;if(ing.cost===0&&ingredStock[ing.id]>0)ingredStock[ing.id]--;document.querySelectorAll('.ing-card').forEach(function(c){c.classList.remove('active');});updateAllUI();updatePreview();}

function stopAnim(){
  animating=false;
  var last=animPts[animPts.length-1]||curPos;
  curPos.x=last.x;curPos.y=last.y;
  if(!isFinite(curPos.x)||!isFinite(curPos.y)){curPos.x=MAP_W/2;curPos.y=MAP_H/2;}
  var teleDest=checkPortal(curPos.x,curPos.y,_lastTeleportDestId);
  _lastTeleportDestId='';
  if(teleDest){
    curPos.x=teleDest.x;curPos.y=teleDest.y;
    _teleportCooldown=25;           // 冷却25帧，出口附近不再检测
    _lastTeleportDestId=teleDest.destId; // 传到的目标portal，下帧排除
    toast("穿过传送门，瞬间转移！");
  }
  pathPts.push({x:curPos.x,y:curPos.y});
  revealAround(curPos.x,curPos.y,FOG_REVEAL,true);
  checkDiscover();
  checkKnowledgePoint();
  updateAllUI();
}

function checkDiscover(){
  // 检测是否接近食材散落点（路过拾取）
  for(var di=0;di<INGREDIENT_DROPS.length;di++){
    var drop=INGREDIENT_DROPS[di];
    if(unlockedIng[drop.id])continue;
    var ddx=curPos.x-drop.x,ddy=curPos.y-drop.y;
    if(Math.sqrt(ddx*ddx+ddy*ddy)<drop.r+18){
      unlockedIng[drop.id]=true;
      ingredStock[drop.id]=Infinity; // 解锁即无限储备
      var ing=INGREDIENTS_DEF.find(function(x){return x.id===drop.id;});
      if(ing){
        showIngDiscoverPopup(ing);
        revealAnims.push({cx:drop.x,cy:drop.y,r:60,t:performance.now()});
      }
    }
  }
  // 岛屿发现（不再解锁食材，仅标记发现+奖励）
  for(var i=0;i<ISLANDS.length;i++){
    var isl=ISLANDS[i];
    if(discovered[isl.id])continue;
    var dx=curPos.x-isl.x,dy=curPos.y-isl.y;
    if(Math.sqrt(dx*dx+dy*dy)<isl.r+15){
      discovered[isl.id]=true;
      toast('🏝 发现'+isl.name+'！');
      camX=isl.x-cw/zoom/2;camY=isl.y-ch/zoom/2;clampCam();
      return;
    }
  }
  // 接近未发现的岛屿提示
  for(var j=0;j<ISLANDS.length;j++){
    var isl2=ISLANDS[j];
    if(discovered[isl2.id])continue;
    var gx2=Math.floor(isl2.x/8),gy2=Math.floor(isl2.y/8);
    if(fog[gy2]&&fog[gy2][gx2]===0){
      var dx2=curPos.x-isl2.x,dy2=curPos.y-isl2.y;
      if(Math.sqrt(dx2*dx2+dy2*dy2)<isl2.r+120){
        toast('接近'+isl2.name+'方向……再走几步！');
        return;
      }
    }
  }
}

function checkKnowledgePoint(){
  for(var ki=0;ki<FIXED_KNOWS.length;ki++){
    var kp=FIXED_KNOWS[ki];
    var kgx=Math.floor(kp.x/8),kgy=Math.floor(kp.y/8);
    if(!fog[kgy]||fog[kgy][kgx]!==1)continue;
    var dx=curPos.x-kp.x,dy=curPos.y-kp.y;
    if(Math.sqrt(dx*dx+dy*dy)<30){
      if(!knownVisited[ki]){showKnowledgePopup(ki);}
      return;
    }
  }
}

function onMapClick(e){
  if(autoMoving){toast('自动前进中，请稍候……');return;}
  if(animating){return;}
  var rect=canvas.getBoundingClientRect();
  var mx=(e.clientX-rect.left)/zoom+camX;
  var my=(e.clientY-rect.top)/zoom+camY;
  for(var ki=0;ki<FIXED_KNOWS.length;ki++){
    var kp=FIXED_KNOWS[ki];
    var kgx=Math.floor(kp.x/8),kgy=Math.floor(kp.y/8);
    if(!fog[kgy]||fog[kgy][kgx]!==1)continue;
    var dx=mx-kp.x,dy=my-kp.y;
    if(Math.sqrt(dx*dx+dy*dy)<18){showKnowledgePopup(ki);return;}
  }
  for(var pi=0;pi<PORTALS.length;pi++){
    var pt=PORTALS[pi];
    var pgx=Math.floor(pt.x/8),pgy=Math.floor(pt.y/8);
    if(!fog[pgy]||fog[pgy][pgx]!==1)continue;
    var dx=mx-pt.x,dy=my-pt.y;
    if(Math.sqrt(dx*dx+dy*dy)<pt.r+5){toast("传送门：进入后可传送到地图另一处！");return;}
  }
  for(var dri2=0;dri2<INGREDIENT_DROPS.length;dri2++){
    var drp2=INGREDIENT_DROPS[dri2];
    var dgx2=Math.floor(drp2.x/8),dgy2=Math.floor(drp2.y/8);
    if(!fog[dgy2]||fog[dgy2][dgx2]!==1)continue;
    var ddx2=mx-drp2.x,ddy2=my-drp2.y;
    if(Math.sqrt(ddx2*ddx2+ddy2*ddy2)<drp2.r+8){
      var ing2=INGREDIENTS_DEF.find(function(x){return x.id===drp2.id;});
      if(unlockedIng[drp2.id]){toast('【'+ing2.name+'】已拾取');}
      else{toast('【'+ing2.name+'】：路过附近即可拾取解锁！');}
      return;
    }
  }
  // 格子点击移动：snap到最近格子的中心点
  var target=snapToGrid(mx,my);
  var tg=px2g(target.x,target.y);
  if(tg.gx<0||tg.gx>=GRID_COLS||tg.gy<0||tg.gy>=GRID_ROWS){toast('超出地图范围！');return;}
  curPos.x=target.x;curPos.y=target.y;
  pathPts.push({x:curPos.x,y:curPos.y});
  revealAround(curPos.x,curPos.y,FOG_REVEAL,true);
  checkDiscover();checkKnowledgePoint();
  updateAllUI();
  toast('移动到 ('+tg.gx+','+tg.gy+')');
}
function loop(ts){
  if(!gMapActive){window._mapLoopRunning=false;return;}
  requestAnimationFrame(loop);
  if(!autoMoving&&!animating){
    if(!isFinite(curPos.x)||!isFinite(curPos.y)){curPos.x=MAP_W/2;curPos.y=MAP_H/2;}
    camX=curPos.x-cw/zoom/2;camY=curPos.y-ch/zoom/2;clampCam();
  }
  try{drawMap(ts);updateAnimStep(ts);if(autoMoving){autoMoveUpdate();}}catch(e){console.error('map loop error:',e);/* 防止渲染异常中断循环 */}
}

function drawMap(ts){if(!ctx||!canvas||cw<1||ch<1)return;if(!isFinite(camX)||!isFinite(camY)||!isFinite(zoom)||zoom<=0){camX=MAP_W/2-cw/2;camY=MAP_H/2-ch/2;zoom=1;}ctx.clearRect(0,0,cw,ch);ctx.save();ctx.translate(-camX*zoom,-camY*zoom);ctx.scale(zoom,zoom);if(offCanvas)ctx.drawImage(offCanvas,0,0);for(var i=0;i<ISLANDS.length;i++){var isl=ISLANDS[i];var gx=Math.floor(isl.x/8),gy=Math.floor(isl.y/8);if(gx<0||gx>=MAP_W/8||gy<0||gy>=MAP_H/8)continue;if(!fog[gy]||fog[gy][gx]!==1)continue;var isNew=discovered[isl.id];var glow=ctx.createRadialGradient(isl.x,isl.y,isl.r,isl.x,isl.y,isl.r*2.2);glow.addColorStop(0,isl.color+'44');glow.addColorStop(1,isl.color+'00');ctx.beginPath();ctx.arc(isl.x,isl.y,isl.r*2.2,0,Math.PI*2);ctx.fillStyle=glow;ctx.fill();ctx.beginPath();ctx.arc(isl.x,isl.y,isl.r,0,Math.PI*2);ctx.fillStyle=isl.color+(isNew?'55':'33');ctx.fill();ctx.strokeStyle=isl.color;ctx.lineWidth=isNew?3:2;ctx.stroke();ctx.fillStyle=isl.color;ctx.font='bold 13px SimSun';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(isl.name,isl.x,isl.y);ctx.font='10px SimSun';ctx.fillStyle='#aaa';ctx.fillText(isl.prod,isl.x,isl.y+16);if(isNew){ctx.fillStyle='#ffd700';ctx.font='9px SimSun';ctx.fillText('★ 已发现',isl.x,isl.y+28);}}

// 绘制传送门
for(var pi=0;pi<PORTALS.length;pi++){
  var pt=PORTALS[pi];
  var pgx=Math.floor(pt.x/8),pgy=Math.floor(pt.y/8);
  if(!fog[pgy]||fog[pgy][pgx]!==1)continue;
  // 传送门光效
  var ptgr=ctx.createRadialGradient(pt.x,pt.y,0,pt.x,pt.y,pt.r*2);
  ptgr.addColorStop(0,'rgba(138,43,226,0.7)');
  ptgr.addColorStop(0.5,'rgba(75,0,130,0.4)');
  ptgr.addColorStop(1,'rgba(75,0,130,0)');
  ctx.beginPath();ctx.arc(pt.x,pt.y,pt.r*2,0,Math.PI*2);ctx.fillStyle=ptgr;ctx.fill();
  ctx.beginPath();ctx.arc(pt.x,pt.y,pt.r,0,Math.PI*2);ctx.fillStyle='rgba(138,43,226,0.5)';ctx.fill();
  ctx.strokeStyle='rgba(200,150,255,0.8)';ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle='#e0d0ff';ctx.font='bold 11px SimSun';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('门',pt.x,pt.y);
  // 连接线（淡线表示传送对）
  ctx.strokeStyle='rgba(138,43,226,0.15)';ctx.lineWidth=1;ctx.setLineDash([4,6]);
  ctx.beginPath();ctx.moveTo(pt.x,pt.y);ctx.lineTo(pt.dx,pt.y2);ctx.stroke();ctx.setLineDash([]);
}

// 绘制知识点
for(var ki=0;ki<FIXED_KNOWS.length;ki++){
  var kp=FIXED_KNOWS[ki];
  var kgx=Math.floor(kp.x/8),kgy=Math.floor(kp.y/8);
  if(!fog[kgy]||fog[kgy][kgx]!==1)continue;
  var visited=knownVisited[ki];
  var ksize=visited?12:15;
  // 光晕
  var kgr=ctx.createRadialGradient(kp.x,kp.y,0,kp.x,kp.y,ksize*2);
  kgr.addColorStop(0,visited?'rgba(100,180,255,0.5)':'rgba(255,215,0,0.6)');
  kgr.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();ctx.arc(kp.x,kp.y,ksize*2,0,Math.PI*2);ctx.fillStyle=kgr;ctx.fill();
  // 书图标
  ctx.font=visited?'13px Arial':'16px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('📖',kp.x,kp.y);
  // 标题（首次访问后淡显示）
  ctx.fillStyle=visited?'rgba(160,200,255,0.5)':'rgba(255,215,0,0.8)';
  ctx.font='9px SimSun';
  ctx.fillText(kp.title,kp.x,kp.y+ksize+6);
}

// 绘制食材散落点（类似知识点的醒目风格）
for(var dri=0;dri<INGREDIENT_DROPS.length;dri++){
  var drp=INGREDIENT_DROPS[dri];
  var dgx=Math.floor(drp.x/8),dgy=Math.floor(drp.y/8);
  if(!fog[dgy]||fog[dgy][dgx]!==1)continue;
  var isUnlocked=!!unlockedIng[drp.id];
  var ingDef=INGREDIENTS_DEF.find(function(x){return x.id===drp.id;});
  var iSize=isUnlocked?14:18;
  // 大范围发光光晕
  var dgr=ctx.createRadialGradient(drp.x,drp.y,0,drp.x,drp.y,iSize*2.5);
  dgr.addColorStop(0,isUnlocked?'rgba(100,255,150,0.45)':'rgba(255,215,0,0.55)');
  dgr.addColorStop(0.5,isUnlocked?'rgba(80,200,120,0.15)':'rgba(200,170,0,0.15)');
  dgr.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();ctx.arc(drp.x,drp.y,iSize*2.5,0,Math.PI*2);ctx.fillStyle=dgr;ctx.fill();
  // 底部圆盘
  ctx.beginPath();ctx.arc(drp.x,drp.y,iSize,0,Math.PI*2);
  ctx.fillStyle=isUnlocked?'rgba(30,120,50,0.6)':'rgba(100,80,0,0.5)';
  ctx.fill();
  ctx.strokeStyle=isUnlocked?'rgba(100,255,150,0.7)':'rgba(255,215,0,0.7)';
  ctx.lineWidth=2;ctx.stroke();
  // 食材emoji图标（未解锁显示问号）
  ctx.font=(isUnlocked?'14px':'18px')+' Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(isUnlocked?(ingDef?ingDef.icon:'?'):'❓',drp.x,drp.y);
  // 名称标签
  ctx.fillStyle=isUnlocked?'rgba(120,255,160,0.85)':'rgba(255,215,0,0.9)';
  ctx.font='bold 10px SimSun';ctx.textAlign='center';ctx.textBaseline='top';
  var dropLabel=isUnlocked?(ingDef?ingDef.name:'已拾取'):'未知食材';
  ctx.fillText(dropLabel,drp.x,drp.y+iSize+5);
  if(!isUnlocked){
    ctx.fillStyle='rgba(255,215,0,0.55)';ctx.font='8px SimSun';
    ctx.fillText('路过拾取',drp.x,drp.y+iSize+18);
  }
}

// 取当前坛子的路径数据（否则用全局fallback）
var j=getJar();
var drawPathPts=j&&j.pathPts?j.pathPts:pathPts;
var drawAutoPath=j&&j.autoMovePath?j.autoMovePath:autoMovePath;
var drawMoving=j?j.autoMoving:autoMoving;
var drawMoveIdx=j?j.autoMoveIdx:autoMoveIdx;
var jarColor=j?'#e06030':'#e0a040'; // 不同坛子不同颜色

if(drawPathPts.length>1){
  ctx.beginPath();ctx.moveTo(drawPathPts[0].x,drawPathPts[0].y);
  for(var pi=1;pi<drawPathPts.length;pi++)ctx.lineTo(drawPathPts[pi].x,drawPathPts[pi].y);
  ctx.strokeStyle=jarColor+'cc';ctx.lineWidth=3;ctx.stroke();
  for(var pj=0;pj<drawPathPts.length;pj++){ctx.beginPath();ctx.arc(drawPathPts[pj].x,drawPathPts[pj].y,3.5,0,Math.PI*2);ctx.fillStyle='#e0a040';ctx.fill();}
}
if(drawAutoPath.length>1&&drawMoving){
  var moveToIdx=Math.floor(drawMoveIdx);
  if(moveToIdx<drawAutoPath.length-1){
    ctx.setLineDash([8,5]);ctx.strokeStyle='rgba(255,215,0,0.55)';ctx.lineWidth=2;
    ctx.beginPath();
    var startIdx=Math.max(0,moveToIdx);
    ctx.moveTo(drawAutoPath[startIdx].x,drawAutoPath[startIdx].y);
    for(var mi=startIdx+1;mi<drawAutoPath.length;mi++){ctx.lineTo(drawAutoPath[mi].x,drawAutoPath[mi].y);}
    ctx.stroke();ctx.setLineDash([]);
  }
  for(var mj=0;mj<drawAutoPath.length;mj++){
    ctx.beginPath();ctx.arc(drawAutoPath[mj].x,drawAutoPath[mj].y,2.5,0,Math.PI*2);
    ctx.fillStyle=mj<=moveToIdx?'rgba(255,215,0,0.9)':'rgba(255,215,0,0.25)';
    ctx.fill();
  }
}
ctx.beginPath();ctx.arc(curPos.x,curPos.y,8,0,Math.PI*2);ctx.fillStyle='#ffd700';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
var pg=ctx.createRadialGradient(curPos.x,curPos.y,4,curPos.x,curPos.y,22);pg.addColorStop(0,'rgba(255,215,0,0.4)');pg.addColorStop(1,'rgba(255,215,0,0)');ctx.fillStyle=pg;ctx.fillRect(curPos.x-22,curPos.y-22,44,44);
for(var ri=revealAnims.length-1;ri>=0;ri--){var a=revealAnims[ri];var el=(ts-a.t)/600;if(el>1){revealAnims.splice(ri,1);continue;}ctx.beginPath();ctx.arc(a.cx,a.cy,a.r*el,0,Math.PI*2);ctx.strokeStyle='rgba(201,162,39,'+(0.6*(1-el))+')';ctx.lineWidth=3*(1-el)+1;ctx.stroke();}

// ─── 数学坐标轴（覆盖在所有地物之上）────────────────────────────────────────
(function drawCoordAxes(){
  // 原点像素坐标：gx=0,gy=0 → 地图左下角
  var ox=g2px(0,0).x, oy=g2px(0,0).y;
  var axisMaxX=g2px(GRID_COLS-1,0).x+CELL/2; // X轴延伸到地图右边缘
  var axisMaxY=g2px(0,GRID_ROWS-1).y-CELL/2; // Y轴延伸到地图上边缘

  ctx.save();
  ctx.globalAlpha=0.75;

  // ── X轴（水平）──
  ctx.strokeStyle='#4af';ctx.lineWidth=2.5;ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(axisMaxX+20,oy);ctx.stroke();
  // X轴箭头
  ctx.beginPath();ctx.moveTo(axisMaxX+20,oy);ctx.lineTo(axisMaxX+12,oy-6);ctx.lineTo(axisMaxX+12,oy+6);ctx.closePath();ctx.fillStyle='#4af';ctx.fill();
  // X轴标签
  ctx.fillStyle='#6df';ctx.font='bold 22px SimSun';ctx.textAlign='left';ctx.textBaseline='bottom';
  ctx.fillText('X（酸度）',axisMaxX+24,oy+4);

  // ── Y轴（垂直）──
  ctx.strokeStyle='#f84';ctx.lineWidth=2.5;
  ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ox,axisMaxY-20);ctx.stroke();
  // Y轴箭头
  ctx.beginPath();ctx.moveTo(ox,axisMaxY-20);ctx.lineTo(ox-6,axisMaxY-12);ctx.lineTo(ox+6,axisMaxY-12);ctx.closePath();ctx.fillStyle='#f84';ctx.fill();
  // Y轴标签
  ctx.fillStyle='#fa8';ctx.font='bold 22px SimSun';ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillText('Y（香气）',ox+8,axisMaxY-48);

  // ── 原点 O ──
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ox,oy,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ddd';ctx.font='bold 18px SimSun';ctx.textAlign='right';ctx.textBaseline='top';
  ctx.fillText('O',ox-6,oy+4);

  // ── 刻度（每 5 格一个大刻度，每 1 格一个小刻度）──
  ctx.fillStyle='rgba(180,220,255,0.85)';ctx.font='12px monospace';ctx.textAlign='center';ctx.textBaseline='top';
  for(var tx=0;tx<GRID_COLS;tx++){
    var px_=g2px(tx,0).x;
    var isMaj=(tx%5===0);
    // X轴刻度线
    ctx.strokeStyle=isMaj?'rgba(100,200,255,0.7)':'rgba(100,200,255,0.3)';
    ctx.lineWidth=isMaj?1.5:0.8;
    ctx.beginPath();ctx.moveTo(px_,oy-(isMaj?8:4));ctx.lineTo(px_,oy+(isMaj?8:4));ctx.stroke();
    if(isMaj&&tx>0){ctx.fillStyle='rgba(150,220,255,0.9)';ctx.fillText(tx,px_,oy+10);}
  }
  ctx.fillStyle='rgba(255,200,140,0.85)';ctx.font='12px monospace';ctx.textAlign='right';ctx.textBaseline='middle';
  for(var ty=0;ty<GRID_ROWS;ty++){
    var py_=g2px(0,ty).y;
    var isMajY=(ty%5===0);
    // Y轴刻度线
    ctx.strokeStyle=isMajY?'rgba(255,180,100,0.7)':'rgba(255,180,100,0.3)';
    ctx.lineWidth=isMajY?1.5:0.8;
    ctx.beginPath();ctx.moveTo(ox-(isMajY?8:4),py_);ctx.lineTo(ox+(isMajY?8:4),py_);ctx.stroke();
    if(isMajY&&ty>0){ctx.fillStyle='rgba(255,200,140,0.9)';ctx.fillText(ty,ox-10,py_);}
  }

  // ── 全局网格线（淡色，对齐格子边沿）──
  ctx.globalAlpha=0.08;
  ctx.strokeStyle='#fff';ctx.lineWidth=0.5;
  // 竖线：x = gx*CELL（格子左边沿），从地图顶部到底部
  for(var gx=0;gx<=GRID_COLS;gx++){
    var vx=gx*CELL;
    ctx.beginPath();ctx.moveTo(vx,0);ctx.lineTo(vx,MAP_H);ctx.stroke();
  }
  // 横线：y = MAP_H - gy*CELL（格子下边沿），从地图最左到最右
  for(var gy=0;gy<=GRID_ROWS;gy++){
    var hy=MAP_H-gy*CELL;
    ctx.beginPath();ctx.moveTo(0,hy);ctx.lineTo(MAP_W,hy);ctx.stroke();
  }
  ctx.globalAlpha=0.75;

  ctx.restore();
})();
// ─────────────────────────────────────────────────────────────────────────────

ctx.restore();
}

function updateAnimStep(ts){if(!animating||animPts.length<2)return;animIdx+=1.5;if(animIdx>=animPts.length-1){stopAnim();return;}var pt=animPts[Math.floor(animIdx)];if(!pt)return;curPos.x=pt.x;curPos.y=pt.y;ctx.save();ctx.translate(-camX*zoom,-camY*zoom);ctx.scale(zoom,zoom);ctx.beginPath();ctx.moveTo(animStart.x,animStart.y);for(var k=0;k<=Math.floor(animIdx)&&k<animPts.length;k++)ctx.lineTo(animPts[k].x,animPts[k].y);ctx.strokeStyle='rgba(255,215,0,0.85)';ctx.lineWidth=3.5;ctx.stroke();ctx.beginPath();ctx.arc(curPos.x,curPos.y,7,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.restore();}

function autoMoveUpdate(){
  if(knowPaused)return;
  var jar=getJar();
  var amp=jar?jar.autoMovePath||[]:[];
  var isMoving=jar?jar.autoMoving:false;
  var moveIdx=jar?jar.autoMoveIdx:0;
  if(!isMoving||moveIdx>=amp.length-1){
    if(isMoving&&moveIdx>=amp.length-1){
      if(jar){jar.autoMoveIdx=amp.length-1;jar.autoMoving=false;}
      autoMoving=false;
      // 把终点记录进pathPts和jar.curPos，确保第二天起点正确
      var endPt=amp[amp.length-1];
      if(endPt){
        curPos.x=endPt.x;curPos.y=endPt.y;
        if(jar){jar.curPos={x:endPt.x,y:endPt.y};}
        if(jar){if(!jar.pathPts)jar.pathPts=[];jar.pathPts.push({x:endPt.x,y:endPt.y});}
        if(pathPts)pathPts.push({x:endPt.x,y:endPt.y});
      }
      // 标记当前坛子为已探索
      if(jar&&exploredToday.indexOf(jar.id)<0)exploredToday.push(jar.id);
      // 显示选坛界面让玩家手动选择下一个
      setTimeout(function(){showJarSelect();},600);
    }
    if(jar)jar.autoMoving=false;
    autoMoving=false;
    return;
  }
  if(jar){jar.autoMoveIdx+=0.02;moveIdx=jar.autoMoveIdx;}
  autoMoveIdx=moveIdx;
  var idx=Math.floor(moveIdx);
  var frac=moveIdx-idx;
  var p1=amp[idx];
  var p2=amp[Math.min(idx+1,amp.length-1)];
  if(!p1||!p2)return;
  curPos.x=p1.x+(p2.x-p1.x)*frac;
  curPos.y=p1.y+(p2.y-p1.y)*frac;
  if(jar){jar.curPos={x:curPos.x,y:curPos.y};}

  // 传送门检测：穿过传送门时将curPos及后续路点整体偏移到出口侧
  var teleDest=checkPortal(curPos.x,curPos.y,_lastTeleportDestId);
  _lastTeleportDestId='';
  if(teleDest){
    var tdx=teleDest.x-curPos.x;
    var tdy=teleDest.y-curPos.y;
    // 将autoMovePath中从当前步（idx）往后的所有路点全部平移到传送门出口侧
    var teleIdx=Math.floor(moveIdx);
    for(var ti=teleIdx;ti<amp.length;ti++){
      amp[ti].x+=tdx;
      amp[ti].y+=tdy;
    }
    curPos.x=teleDest.x;curPos.y=teleDest.y;
    if(jar){jar.curPos={x:curPos.x,y:curPos.y};}
    _teleportCooldown=60;           // 冷却60帧（约1秒），给足离开出口的时间
    _lastTeleportDestId=teleDest.destId; // 出口portal id，下帧排除
    toast('穿过传送门，在另一端继续前进！');
  }
  // 固定知识点检测
  for(var ki=0;ki<FIXED_KNOWS.length;ki++){
    if(knownVisited[ki])continue;
    var kp=FIXED_KNOWS[ki];
    var kgx=Math.floor(kp.x/8),kgy=Math.floor(kp.y/8);
    if(!fog[kgy]||fog[kgy][kgx]!==1)continue;
    var dx=curPos.x-kp.x,dy=curPos.y-kp.y;
    if(Math.sqrt(dx*dx+dy*dy)<30){showKnowledgePopup(ki);return;}
  }

  // 更新坛子pathPts（保留历史，只更新当天）
  if(jar){
    var hstart=jar.histStart||0;
    var sameRef=jar.pathPts===pathPts;
    if(!sameRef){
      while(jar.pathPts&&jar.pathPts.length>hstart)jar.pathPts.pop();
    }
    while(pathPts.length>hstart)pathPts.pop();
    var sti=(hstart>0)?1:0;
    for(var pi=sti;pi<=idx;pi++){
      if(amp[pi]){
        if(!sameRef){jar.pathPts.push({x:amp[pi].x,y:amp[pi].y});}
        pathPts.push({x:amp[pi].x,y:amp[pi].y});
      }
    }
    if(frac>0.5){
      if(!sameRef){jar.pathPts.push({x:curPos.x,y:curPos.y});}
      pathPts.push({x:curPos.x,y:curPos.y});
    }
  }
  revealAround(curPos.x,curPos.y,FOG_REVEAL,false);
  checkDiscover();
  camX=curPos.x-cw/zoom/2;camY=curPos.y-ch/zoom/2;clampCam();
}

function updateAllUI(){document.getElementById('ui-day').textContent=gDay;document.getElementById('ui-money').textContent=gMoney;document.getElementById('ui-steps').textContent=pathPts.length;updateIngredList();updateIslandTags();updatePreview();}

function updateIngredList(){var list=document.getElementById('ingred-list');list.innerHTML='';INGREDIENTS_DEF.forEach(function(ing){if(!unlockedIng[ing.id])return;var card=document.createElement('div');var stock=ingredStock[ing.id];var isLocked=gMoney<ing.cost||(ing.cost===0&&stock!==undefined&&stock<=0);card.className='ing-card'+(selectedIng&&selectedIng.id===ing.id?' active':'')+(isLocked?' locked':'');var stk=stock!==undefined?'库存:'+(stock===Infinity||stock>=999999?'∞':stock):'';var acidL=ing.gridDx>0?('→'+ing.gridDx):(ing.gridDx<0?('←'+(-ing.gridDx)):'');var aromaL=ing.gridDy>0?('↑'+ing.gridDy):(ing.gridDy<0?('↓'+(-ing.gridDy)):'');card.innerHTML='<span class="ic">'+ing.icon+'</span><span class="nm">'+ing.name+'</span><span class="cost">'+(ing.cost?ing.cost+'铜':'免费')+'</span>'+(stk?'<span class="stk">'+stk+'</span>':'')+'<span class="ing-dir">'+acidL+' '+aromaL+'</span>';card.title=ing.desc;card.onclick=(function(ingR){return function(){selectIngredient(ingR);};})(ing);list.appendChild(card);});}

function selectIngredient(ing){if(cellarPreviewMode){toast('地窖已规划好路线，醋坛自动前进中……');return;}if((ingredStock[ing.id]||0)<=0&&ing.cost>0&&gMoney<ing.cost){toast('铜钱不足，无法购买【'+ing.name+'】！');return;}if(ing.cost>0&&gMoney>=ing.cost){gMoney-=ing.cost;ingredStock[ing.id]=(ingredStock[ing.id]||0)+1;toast('购买【'+ing.name+'】×1，花费'+ing.cost+'铜！');}selectedIng=ing;updateAllUI();toast('已选食材：【'+ing.name+'】——点击地图放置！');}

function updatePreview(){
  var cvs=document.getElementById('preview-canvas');if(!cvs)return;
  var c=cvs.getContext('2d');
  var PW=200,PH=200;
  c.clearRect(0,0,PW,PH);
  // 按地图真实尺寸等比缩放：让整张 MAP_W×MAP_H 映射到 PW×PH
  var scx=PW/MAP_W,scy=PH/MAP_H;
  function mx(x){return x*scx;}
  function my(y){return y*scy;}

  // 背景深色
  c.fillStyle='rgba(15,10,25,0.95)';
  c.fillRect(0,0,PW,PH);

  // 绘制岛屿（已发现=彩色，未发现=暗灰）
  for(var ii=0;ii<ISLANDS.length;ii++){
    var isl=ISLANDS[ii];
    var disc=discovered[isl.id];
    var ir=Math.max(isl.r*scx,3);
    c.beginPath();c.arc(mx(isl.x),my(isl.y),ir,0,Math.PI*2);
    c.fillStyle=disc?isl.color+'55':'rgba(60,50,70,0.5)';
    c.fill();
    c.strokeStyle=disc?isl.color:'rgba(100,80,120,0.4)';
    c.lineWidth=disc?1.5:1;
    c.stroke();
    if(disc){
      c.fillStyle=isl.color;
      c.font='6px SimSun';c.textAlign='center';c.textBaseline='middle';
      c.fillText(isl.name,mx(isl.x),my(isl.y));
    }
  }


  // 绘制传送门（紫圈）
  for(var pi=0;pi<PORTALS.length;pi++){
    var pt=PORTALS[pi];
    var pr=Math.max(pt.r*scx,3);
    c.beginPath();c.arc(mx(pt.x),my(pt.y),pr,0,Math.PI*2);
    c.fillStyle='rgba(138,43,226,0.55)';
    c.fill();
    c.strokeStyle='rgba(200,150,255,0.8)';c.lineWidth=1;
    c.stroke();
  }

  // 绘制已走路径（金色实线，和大地图橙线对应）
  if(pathPts.length>1){
    c.strokeStyle='rgba(220,160,60,0.9)';
    c.lineWidth=1.5;c.setLineDash([]);
    c.beginPath();
    c.moveTo(mx(pathPts[0].x),my(pathPts[0].y));
    for(var pj=1;pj<pathPts.length;pj++)c.lineTo(mx(pathPts[pj].x),my(pathPts[pj].y));
    c.stroke();
    // 路径节点小圆点
    for(var pk=0;pk<pathPts.length;pk++){
      c.beginPath();c.arc(mx(pathPts[pk].x),my(pathPts[pk].y),1.5,0,Math.PI*2);
      c.fillStyle='#e0a040';c.fill();
    }
  }

  // 当前位置（金色亮点）
  if(curPos){
    c.beginPath();c.arc(mx(curPos.x),my(curPos.y),3,0,Math.PI*2);
    c.fillStyle='#ffd700';c.fill();
    c.strokeStyle='#fff';c.lineWidth=1;c.stroke();
  }

  // 食材散落点
  for(var pri=0;pri<INGREDIENT_DROPS.length;pri++){
    var prp=INGREDIENT_DROPS[pri];
    var pUnlocked=!!unlockedIng[prp.id];
    c.beginPath();c.arc(mx(prp.x),my(prp.y),pUnlocked?1.5:2.5,0,Math.PI*2);
    c.fillStyle=pUnlocked?'rgba(100,255,150,0.85)':'rgba(255,215,0,0.85)';c.fill();
    c.strokeStyle='#fff';c.lineWidth=0.5;c.stroke();
  }

  // 规划路线（虚线 cyan）
  var jar=getJar();
  if(jar&&jar.autoMovePath&&jar.autoMovePath.length>1){
    c.strokeStyle='rgba(100,200,255,0.7)';
    c.lineWidth=1.5;
    c.setLineDash([4,3]);
    c.beginPath();
    c.moveTo(mx(jar.autoMovePath[0].x),my(jar.autoMovePath[0].y));
    for(var ami=1;ami<jar.autoMovePath.length;ami++){
      c.lineTo(mx(jar.autoMovePath[ami].x),my(jar.autoMovePath[ami].y));
    }
    c.stroke();
    c.setLineDash([]);
  }

  // 起点标记
  c.beginPath();c.arc(mx(MAP_W/2),my(MAP_H/2),2,0,Math.PI*2);
  c.fillStyle='rgba(255,255,255,0.5)';c.fill();

  // 图例（右下角，简洁）
  c.font='7px SimSun';c.textBaseline='middle';
  c.fillStyle='rgba(200,50,50,0.9)';c.beginPath();c.arc(8,PH-22,4,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,80,80,0.8)';c.lineWidth=0.8;c.stroke();
  c.fillStyle='#aaa';c.textAlign='left';c.fillText('障碍',15,PH-22);

  c.fillStyle='rgba(138,43,226,0.8)';c.beginPath();c.arc(8,PH-11,3,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(200,150,255,0.7)';c.lineWidth=0.8;c.stroke();
  c.fillStyle='#aaa';c.fillText('传送门',15,PH-11);

  c.strokeStyle='rgba(220,160,60,0.9)';c.lineWidth=1.5;c.setLineDash([]);
  c.beginPath();c.moveTo(50,PH-11);c.lineTo(62,PH-11);c.stroke();
  c.fillStyle='#aaa';c.fillText('走过路径',66,PH-11);

  if(jar&&jar.autoMovePath&&jar.autoMovePath.length>1){
    c.strokeStyle='rgba(100,200,255,0.7)';c.lineWidth=1.5;c.setLineDash([4,3]);
    c.beginPath();c.moveTo(96,PH-11);c.lineTo(108,PH-11);c.stroke();c.setLineDash([]);
    c.fillStyle='#aaa';c.fillText('规划路线',112,PH-11);
  }
}

function updateIslandTags(){var cont=document.getElementById('island-tags');cont.innerHTML='';ISLANDS.forEach(function(isl){var tag=document.createElement('div');tag.className='island-tag'+(discovered[isl.id]?' fresh':' lc');tag.innerHTML='<span class="dot" style="background:'+isl.color+'"></span><span>'+(discovered[isl.id]?isl.name:'？？')+'</span>';cont.appendChild(tag);});}

function mapUndo(){if(!pathPts.length)return;pathPts.pop();curPos=pathPts.length?{x:pathPts[pathPts.length-1].x,y:pathPts[pathPts.length-1].y}:{x:MAP_W/2,y:MAP_H/2};if(usedIngreds.length){var lid=usedIngreds.pop();INGREDIENTS_DEF.forEach(function(ing){if(ing.id===lid)gMoney+=ing.cost;});}toast('已撤销一步');updateAllUI();}

function mapReset(){pathPts=[];usedIngreds=[];curPos={x:MAP_W/2,y:MAP_H/2};gMoney=Math.max(30,gMoney);selectedIng=null;for(var gy=0;gy<MAP_H/8;gy++){if(!fog[gy])continue;for(var gx=0;gx<MAP_W/8;gx++)fog[gy][gx]=0;}discovered={};animating=false;camX=curPos.x-400;camY=curPos.y-300;revealAround(curPos.x,curPos.y,140,true);toast('已重置！');updateAllUI();updatePreview();}
function resumeAutoMove(){if(autoMovePath.length>0){autoMoving=true;autoMoveIdx=0;toast('重新规划路线，继续前进！');document.getElementById('btn-resume').style.display='none';}}

function showMapFinishModal(){mapFinish();}
var _jarExploredDone=false;
var _mapModalShown=false;
function mapFinish(){
  if(_mapModalShown)return;
  if(animating){toast('移动中，请稍候');return;}
  _mapModalShown=true;
  var jar=getJar();
  if(jar){
    jar.curPos={x:curPos.x,y:curPos.y};
    if(!jar.pathPts)jar.pathPts=[];
    var hstart=jar.histStart||0;
    // 保存实际走过的路径（含障碍边界点），而非计划路径
    // 先复制pathPts（防止和jar.pathPts是同一引用导致截断后for不执行）
    var savedPts=[];
    for(var i=hstart;i<pathPts.length;i++){savedPts.push({x:pathPts[i].x,y:pathPts[i].y});}
    while(jar.pathPts.length>hstart)jar.pathPts.pop();
    for(var i=0;i<savedPts.length;i++){jar.pathPts.push(savedPts[i]);}
    if(exploredToday.indexOf(jar.id)<0)exploredToday.push(jar.id);
    selectedJarIdx=-1;
  }
  var best=null,bestD=Infinity;ISLANDS.forEach(function(isl){if(!discovered[isl.id])return;var d=Math.sqrt(Math.pow(curPos.x-isl.x,2)+Math.pow(curPos.y-isl.y,2));if(d<bestD){bestD=d;best=isl;}});
  var jarName=jar?'【'+jar.name+'】':'';
  // 检查该坛醋是否已酿造完成（done=true且在readyVinegar中有记录）
  var doneVinegar=null;
  if(jar&&jar.done){
    // 找到本坛本次酿成的醋
    for(var rvi=0;rvi<readyVinegar.length;rvi++){
      if(readyVinegar[rvi].from===jar.name){doneVinegar=readyVinegar[rvi];break;}
    }
  }
  if(doneVinegar){
    // 酿造完成：优先显示醋的完成结算
    var cnt=Object.keys(discovered).length;
    var earn=(best?best.reward:15)+usedIngreds.length*5+20;
    document.getElementById('m-title').textContent=doneVinegar.icon+' '+doneVinegar.name+' 酿成！';
    document.getElementById('m-desc').textContent=jarName+'历经 '+jar.totalDays+' 天发酵，醋已成熟！'+(best?'风味以'+best.name+'为基础。':'');
    document.getElementById('m-earn').textContent='获得 '+earn+' 铜钱！';
    var islandInfo=cnt>0?('🏝️ 累计发现 '+cnt+' 座风味岛<br>'+Object.keys(discovered).map(function(id){var isl=ISLANDS.find(function(s){return s.id===id;});return isl?'· '+isl.name+' → '+isl.prod:'';}).join('<br>')):'本坛未踏足风味岛，但醋已自然成熟。';
    document.getElementById('m-islands').innerHTML=islandInfo;
    gMoney+=earn;
  } else if(!best){
    document.getElementById('m-title').textContent='探索结算';
    document.getElementById('m-desc').textContent=jarName+'尚未发现任何风味岛，继续探索吧！';
    document.getElementById('m-earn').textContent='铜钱 +'+usedIngreds.length*3;
    document.getElementById('m-islands').textContent='发现岛屿：0 个';
    gMoney+=usedIngreds.length*3;
  }else{
    var earn=best.reward+usedIngreds.length*5;
    var cnt=Object.keys(discovered).length;
    document.getElementById('m-title').textContent=best.prod+' 酿造完成！';
    document.getElementById('m-desc').textContent=jarName+'以 '+best.name+' 为基础'+(cnt>1?'（另发现'+(cnt-1)+'座）':'');
    document.getElementById('m-earn').textContent='获得 '+earn+' 铜钱！';
    document.getElementById('m-islands').innerHTML='🏝️ 已发现 '+cnt+'/'+ISLANDS.length+' 座岛屿<br>'+Object.keys(discovered).map(function(id){var isl=ISLANDS.find(function(s){return s.id===id;});return isl?'· '+isl.name+' → '+isl.prod:'';}).join('<br>');
    gMoney+=earn;
  }
  var activeJars=cellarJars.filter(function(j){return !j.done;});
  _jarExploredDone=(exploredToday.length>=activeJars.length);
  var btn=document.querySelector('#modal-overlay .act-btn');
  if(btn){btn.textContent=_jarExploredDone?'全部探索完毕 · 酿造结算':'继续探索其他坛子 →';}
  document.getElementById('modal-overlay').classList.add('show');
  updateAllUI();
}

function closeModal(){
  document.getElementById('modal-overlay').classList.remove('show');
  _mapModalShown=false;
  if(_jarExploredDone){
    showBrewingSummary();
  } else {
    gMapActive=false;
    showJarSelect();
  }
}

// 从酿造总结回到地窖开新坛（无活跃坛子时的出口）
function summaryBackToCellar(){
  document.getElementById('brew-summary-overlay').classList.remove('show');
  exploredToday=[];_jarExploredDone=false;_mapModalShown=false;
  cellarUsedToday=false;cellarNewJarToday=false;
  goCellar();
}
