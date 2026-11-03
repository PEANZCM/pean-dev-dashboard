// ============================================================
//  学习看板 - 核心逻辑
//  数据自动存储到电脑（Electron userData/data/ 目录）
// ============================================================

// ===== 学习阶段数据 =====
const STAGES=[
  {id:'s0',title:'阶段 0 · 起步',sub:'今晚 · 环境搭建',tasks:[
    {id:'t001',t:'安装 Node.js LTS 版（nodejs.org 下载，一路Next）'},
    {id:'t002',t:'确认 VS Code 已安装，装插件：Live Server、Chinese Language Pack'},
    {id:'t003',t:'创建第一个 index.html，浏览器打开看到 Hello World'},
    {id:'t004',t:'注册 GitHub 账号 + 安装 Git，配置用户名邮箱'}
  ]},
  {id:'s1',title:'阶段 1 · Web 基础',sub:'暑假3周 · 能跑能看能交互',tasks:[
    {week:'Week 1 · HTML + CSS（做出好看页面）'},
    {id:'t101',t:'写一个自我介绍页面（HTML：div/p/h1/img/span/a 标签）'},
    {id:'t102',t:'给页面加颜色、字体、背景、边距（CSS 基础样式）'},
    {id:'t103',t:'用 Flexbox 把内容居中排列（display:flex/justify-content/align-items）'},
    {id:'t104',t:'加圆角、阴影、渐变背景（border-radius/box-shadow/linear-gradient）'},
    {id:'t105',t:'加 hover 效果：鼠标悬停变色放大（transition 过渡）'},
    {id:'t106',t:'加入场动画：页面加载淡入、图标旋转（@keyframes + animation）'},
    {id:'t107',t:'★ 做一个鸿蒙/iOS 风格启动器页面（圆角卡片 + 图标 + 动画）'},
    {week:'Week 2 · JavaScript（让页面动起来）'},
    {id:'t108',t:'加一个按钮，点击弹出消息（JS 基础 + 事件监听）'},
    {id:'t109',t:'做一个计数器：点击 +1（变量 + 函数 + DOM 操作）'},
    {id:'t110',t:'做一个待办清单：输入框 + 添加按钮 + 列表显示'},
    {id:'t111',t:'给待办项加完成/删除功能（数组操作 + 事件）'},
    {id:'t112',t:'刷新页面不丢数据（localStorage 本地存储）'},
    {id:'t113',t:'加键盘支持：回车键添加待办（keydown 事件）'},
    {id:'t114',t:'★ 完善待办清单：好看 UI + 动画 + 本地存储'},
    {week:'Week 3 · 第一个项目（能跑能看能交互）'},
    {id:'t115',t:'CSS 动画进阶：卡片翻转、弹窗过渡'},
    {id:'t116',t:'调用免费 API 获取天气数据（fetch 请求 + JSON 解析）'},
    {id:'t117',t:'★ 做一个天气卡片应用（API + 动画 + 美观 UI）'},
    {id:'t118',t:'响应式适配：手机上也能看（@media 媒体查询）'},
    {id:'t119',t:'打磨 UI：圆角、阴影、毛玻璃效果，追求鸿蒙级质感'},
    {id:'t120',t:'部署到 GitHub Pages，发链接给朋友看 + 代码推上 GitHub'}
  ]},
  {id:'s2',title:'阶段 2 · 鸿蒙 ArkTS 起步',sub:'大一上 9月-1月 · 原生开发入门',tasks:[
    {id:'t201',t:'DevEco Studio 环境更新，创建第一个鸿蒙项目跑通 Hello World'},
    {id:'t202',t:'ArkTS 语言基础：变量、类型、函数（类 TypeScript，上手快）'},
    {id:'t203',t:'ArkTS 面向对象：class、interface、泛型'},
    {id:'t204',t:'ArkUI 基础组件：Text / Image / Button / TextInput'},
    {id:'t205',t:'ArkUI 布局：Column / Row / Stack（和 CSS Flexbox 思维相通）'},
    {id:'t206',t:'ArkUI 状态管理：@State / @Prop / @Link 状态驱动 UI'},
    {id:'t207',t:'ArkUI 事件交互：onClick / onChange / 手势'},
    {id:'t208',t:'ArkUI 动画：animateTo / transition（追求流畅动画）'},
    {id:'t209',t:'★ 用 ArkTS 复刻你的 Web 待办清单（原生鸿蒙版）'},
    {id:'t210',t:'跟学校 C 语言课，用 K&R 同步学习（学校课为主）'},
    {id:'t211',t:'数据结构基础：数组、链表（跟学校课同步）'}
  ]},
  {id:'s3',title:'阶段 3 · 鸿蒙深入 + 安卓副线',sub:'大一下 2月-7月 · 原生能力提升',tasks:[
    {id:'t301',t:'ArkUI 进阶：自定义组件、@Builder / @Extend'},
    {id:'t302',t:'ArkUI 导航：Navigation 路由管理'},
    {id:'t303',t:'鸿蒙数据存储：Preferences、关系型数据库'},
    {id:'t304',t:'鸿蒙网络请求：HTTP 请求、JSON 解析'},
    {id:'t305',t:'鸿蒙动画精通：属性动画、转场动画、共享元素'},
    {id:'t306',t:'鸿蒙分布式能力：跨端流转入门'},
    {id:'t307',t:'安卓 Kotlin 入门（副线）：语法基础'},
    {id:'t308',t:'安卓 Compose 入门：声明式 UI（思维迁移自 ArkUI）'},
    {id:'t309',t:'★ 开源第一个项目到 GitHub'}
  ]},
  {id:'s4',title:'阶段 4 · 多平台工匠 + 实习',sub:'大二 · 真刀真枪',tasks:[
    {id:'t401',t:'鸿蒙 ArkUI 精通：复杂动画、性能优化'},
    {id:'t402',t:'安卓 Compose 进阶：与鸿蒙对比学习'},
    {id:'t403',t:'架构模式：MVVM 在鸿蒙和安卓中的实现'},
    {id:'t404',t:'参与鸿蒙开源社区贡献，提交第一个 PR'},
    {id:'t405',t:'大二暑假实习：鸿蒙 / 安卓开发岗'},
    {id:'t406',t:'★ 作品集打磨：鸿蒙 + 安卓各一个精品作品'}
  ]},
  {id:'s5',title:'阶段 5 · 少年骇客',sub:'长线 · 你的生态',tasks:[
    {id:'t501',t:'独立做一个精品 App（鸿蒙原生）'},
    {id:'t502',t:'写技术博客 / 建立个人影响力'},
    {id:'t503',t:'攒钱买 Mac → 学 iOS SwiftUI'},
    {id:'t504',t:'带小团队做出惊艳世人的项目'}
  ]}
];

// ===== 内置励志名言库（混合类） =====
const BUILTIN_QUOTES=[
  {text:"代码是写给人看的，顺便能让机器执行。",author:"Harold Abelson"},
  {text:"先让它工作，再让它正确，最后让它快速。",author:"Kent Beck"},
  {text:"任何傻瓜都能写出计算机能理解的代码。好的程序员能写出人能理解的代码。",author:"Martin Fowler"},
  {text:"Talk is cheap. Show me the code.",author:"Linus Torvalds"},
  {text:"调试代码比写代码难一倍。所以如果你写代码时用尽了全部聪明，调试时就需要两倍的聪明。",author:"Brian Kernighan"},
  {text:"我不是一个伟大的程序员，我只是一个有良好习惯的优秀程序员。",author:"Kent Beck"},
  {text:"完美不是无可增加，而是无可删减。",author:"圣埃克苏佩里"},
  {text:"简洁是可靠的前提。",author:"Dijkstra"},
  {text:"好的程序员关心代码，伟大的程序员关心数据结构。",author:"Linus Torvalds"},
  {text:"编程不是关于你知道什么，而是关于你能弄清楚什么。",author:"Chris Pine"},
  {text:"不要重复自己（DRY）。",author:"Andy Hunt"},
  {text:"保持简单，傻瓜（KISS）。",author:"Kelly Johnson"},
  {text:"重构不是奢侈品，而是必需品。",author:"Martin Fowler"},
  {text:"不要优化你还没测量的东西。",author:"匿名"},
  {text:"阅读他人的代码，是提高编程能力最快的方式。",author:"匿名"},
  {text:"每个bug都是一次学习的机会。",author:"匿名"},
  {text:"编程是20%的编码和80%的调试。",author:"匿名"},
  {text:"你的代码就是你的作品集。",author:"匿名"},
  {text:"技术更新很快，但原理长存。学好原理。",author:"匿名"},
  {text:"你今天觉得难的代码，明天就会觉得简单。",author:"匿名"},
  {text:"千里之行，始于足下。",author:"老子"},
  {text:"不积跬步，无以至千里。",author:"荀子"},
  {text:"宝剑锋从磨砺出，梅花香自苦寒来。",author:"古诗"},
  {text:"天行健，君子以自强不息。",author:"《周易》"},
  {text:"种一棵树最好的时间是十年前，其次是现在。",author:"谚语"},
  {text:"不要害怕慢慢前行，要害怕停滞不前。",author:"中国谚语"},
  {text:"失败是成功之母。",author:"中国谚语"},
  {text:"今天的你，是昨天的你所决定的。",author:"匿名"},
  {text:"所有伟大的事情都需要时间。",author:"匿名"},
  {text:"每一次你写的代码比昨天好，你就是在进步。",author:"匿名"},
  {text:"每一个 expert 都曾是 beginner。",author:"Helen Hayes"},
  {text:"一万小时定律：任何人做一件事一万小时，都能成为专家。",author:"格拉德威尔"},
  {text:"经验告诉你如何做，热情告诉你为什么做。",author:"匿名"},
  {text:"走得快，独自走；走得远，一起走。",author:"非洲谚语"},
  {text:"模仿、理解、创造——学习的三步曲。",author:"匿名"},
  {text:"最好的学习方式就是做一个项目。",author:"匿名"},
  {text:"你今天看的每一行代码，都在塑造你明天的能力。",author:"匿名"},
  {text:"学会读错误信息，它比你想的有用。",author:"匿名"},
  {text:"每天写一点代码，比一周写一次更有效。",author:"匿名"},
  {text:"当你觉得一个功能很难实现时，说明你的设计可能有问题。",author:"匿名"},
  {text:"编程是一种思维方式，不只是写代码。",author:"匿名"},
  {text:"少即是多。",author:"Mies van der Rohe"},
  {text:"纸上谈兵终觉浅，绝知此事要躬行。",author:"陆游"},
  {text:"先完成，再完美。",author:"Sheryl Sandberg"},
  {text:"如果你觉得太晚，其实正是最早的时候。",author:"匿名"},
  {text:"没有最好的语言，只有最适合的语言。",author:"匿名"},
  {text:"好的代码自己会说话。",author:"匿名"},
  {text:"你不需要一次写完所有功能。先写能用的。",author:"匿名"},
  {text:"最好的错误信息是那些根本不会出现的错误。",author:"Thomas Fuchs"},
  {text:"代码就像幽默。当你不得不解释它的时候，它就很差。",author:"Cory House"}
];

// ===== 奖章配置 =====
const MEDAL_TIERS={
  none:   {min:0,   max:20,   labels:[],                                                    color:'#999',icon:''},
  blue:   {min:21,  max:53,   labels:['印度公开赛','新加坡公开赛','中国大师赛','丹麦公开赛','法国公开赛','日本公开赛'],color:'#4A90D9',icon:iconSvg('medal')},
  purple: {min:54,  max:127,  labels:['BWF总决赛','中国公开赛','印尼公开赛','全英公开赛','马来西亚公开赛'],       color:'#9B8ADC',icon:iconSvg('medal')},
  crimson:{min:128, max:511,  labels:['世锦赛'],                                               color:'#E53935',icon:iconSvg('medal')},
  gold:   {min:512, max:Infinity,labels:['奥运会'],                                            color:'#FFD700',icon:iconSvg('trophy')}
};
const TIER_ORDER=['none','blue','purple','crimson','gold'];
const TIER_NAMES={none:'无',blue:'蓝奖章',purple:'淡紫奖章',crimson:'大红奖章',gold:'金光奖章'};

// ===== 日期工具 =====
function fmt(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function todayStr(){var d=new Date();d.setHours(0,0,0,0);return fmt(d);}
function yesterdayStr(){var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-1);return fmt(d);}
function dayBeforeStr(){var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-2);return fmt(d);}
function parseDate(s){var p=s.split('-');return new Date(parseInt(p[0]),parseInt(p[1])-1,parseInt(p[2]));}

// ===== 日期变化监测 =====
// 应用长时间运行时（如跨午夜），自动检测日期变化并刷新打卡状态
var _dateMonitorTimer=null;
function startDateChangeMonitor(){
  if(_dateMonitorTimer)return;
  // 每分钟检查一次日期是否变化
  _dateMonitorTimer=setInterval(function(){
    var now=todayStr();
    if(now!==currentDateStr){
      currentDateStr=now;
      // 日期变了，重新检测断卡并刷新所有打卡相关UI
      detectBreak();
      renderToday();
      renderCheckin();
      renderStreakDots();
      renderCalendar();
      renderHeatmap();
      updateStats();
      // 重新检查晚间提醒
      checkEveningReminder();
    }
  },60*1000);
}

// ===== 数据存储 =====
const DataStore={
  cache:{},
  async load(name,def){
    if(name in this.cache)return this.cache[name];
    try{
      var raw=await dashboardAPI.readFile(name);
      if(raw){var d=JSON.parse(raw);this.cache[name]=d;return d;}
    }catch(e){console.error('load failed:',name,e);}
    this.cache[name]=def;return def;
  },
  async save(name,data){
    this.cache[name]=data;
    try{await dashboardAPI.writeFile(name,JSON.stringify(data));}catch(e){console.error('save failed:',name,e);}
  },
  invalidate(name){delete this.cache[name];},
  // 强制从磁盘重新加载数据
  async reload(name,def){
    this.invalidate(name);
    return this.load(name,def);
  }
};

// ===== 全局状态 =====
var checkinData={dates:[]};
var checkinDateSet=new Set(); // 打卡日期Set，用于快速查询
var currentDateStr=''; // 当前日期字符串，用于检测日期变化
var streakData={current:0,startDate:null,lastUpdate:null};
var flameData={total:0};
var medalsData={liveMedal:null,frozenMedals:[],labelMemory:{blue:[],purple:[],crimson:[],gold:[]},grandSlam:0};
var taskData={tasks:{},customStages:null};
var diaryData={entries:{}};
var moodData={moods:{}};
var quotesData={custom:[],lastShownDate:null,currentQuote:null};
var settingsData={darkMode:false};
var screenshotData={shots:{}};
var newsData={items:[],lastFetch:null};
var calCurrentMonth=new Date();
var selectedDate=null;
var diaryEditMode=true;

// ===== 初始化 =====
async function init(){
  // 加载所有数据
  checkinData=await DataStore.load('checkin.json',{dates:[]});
  streakData=await DataStore.load('streak.json',{current:0,startDate:null,lastUpdate:null});
  flameData=await DataStore.load('flame.json',{total:0});
  medalsData=await DataStore.load('medals.json',{liveMedal:null,frozenMedals:[],labelMemory:{blue:[],purple:[],crimson:[],gold:[]},grandSlam:0});
  taskData=await DataStore.load('tasks.json',{tasks:{},customStages:null});
  diaryData=await DataStore.load('diary.json',{entries:{}});
  moodData=await DataStore.load('mood.json',{moods:{}});
  quotesData=await DataStore.load('quotes.json',{custom:[],lastShownDate:null,currentQuote:null});
  settingsData=await DataStore.load('settings.json',{darkMode:false});
  screenshotData=await DataStore.load('screenshots.json',{shots:{}});
  newsData=await DataStore.load('news.json',{items:[],lastFetch:null});

  // 确保labelMemory完整
  ['blue','purple','crimson','gold'].forEach(function(t){if(!medalsData.labelMemory)medalsData.labelMemory={};if(!medalsData.labelMemory[t])medalsData.labelMemory[t]=[];});

  // 初始化打卡日期Set和当前日期
  refreshCheckinSet();
  currentDateStr=todayStr();

  // 启动日期变化检测（每分钟检查一次，跨午夜自动刷新）
  startDateChangeMonitor();

  // 断卡检测
  detectBreak();

  // 应用深色模式
  if(settingsData.darkMode)document.body.classList.add('dark');

  // 渲染所有模块
  renderToday();
  renderCheckin();
  renderFlames();
  renderStreakDots();
  renderRoadmap();
  renderStages();
  updateStats();
  renderCalendar();
  renderHeatmap();
  showDailyQuote();
  renderCustomQuotes();

  // 新闻：先显示缓存，再自动刷新
  renderNews();
  autoFetchNews();

  // 加载应用图标到关于页
  loadAboutIcon();

  // 同步设置面板主题开关初始状态
  var stToggle=document.getElementById('settingsThemeToggle');
  if(stToggle)stToggle.classList.toggle('on',settingsData.darkMode);

  // 事件绑定
  bindEvents();

  // 晚间提醒
  checkEveningReminder();
}

// ===== 断卡检测 =====
function detectBreak(){
  if(streakData.current===0)return;
  var today=todayStr(),yesterday=yesterdayStr(),dayBefore=dayBeforeStr();
  // 如果今天或昨天已打卡，streak还活着
  if(checkinDateSet.has(today)||checkinDateSet.has(yesterday))return;
  // 如果前天已打卡，还可以通过补打昨天恢复
  if(checkinDateSet.has(dayBefore))return;
  // 不可恢复的断卡
  if(streakData.current>0){
    freezeMedal(streakData.current);
    flameData.total=Math.max(0,flameData.total-2);
    streakData.current=0;
    streakData.startDate=null;
    DataStore.save('streak.json',streakData);
    DataStore.save('flame.json',flameData);
    DataStore.save('medals.json',medalsData);
  }
}

// ===== 打卡系统 =====
function refreshCheckinSet(){checkinDateSet=new Set(checkinData.dates);}
function isCheckedIn(dateStr){return checkinDateSet.has(dateStr);}

function doCheckin(){
  var today=todayStr();
  if(isCheckedIn(today))return;
  checkinData.dates.push(today);
  checkinDateSet.add(today);
  // 计算新streak
  var d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-1);
  if(checkinDateSet.has(fmt(d))){streakData.current++;}else{streakData.current=1;streakData.startDate=today;}
  streakData.lastUpdate=today;
  // 加火焰
  flameData.total++;
  // 更新奖章
  updateMedal(streakData.current);
  // 保存
  DataStore.save('checkin.json',checkinData);
  DataStore.save('streak.json',streakData);
  DataStore.save('flame.json',flameData);
  DataStore.save('medals.json',medalsData);
  // 刷新UI
  renderCheckin();renderFlames();renderStreakDots();
  renderCalendar();renderHeatmap();renderMedalWallCurrent();
  showToast('打卡成功，火焰 +1');
}

function doMakeup(){
  var yesterday=yesterdayStr();
  if(isCheckedIn(yesterday)){showToast('昨天已经打卡了');return;}
  checkinData.dates.push(yesterday);
  checkinDateSet.add(yesterday);
  // 重新计算streak
  var newStreak=computeStreak();
  streakData.current=newStreak;
  if(newStreak===1)streakData.startDate=yesterday;
  // 加火焰
  flameData.total++;
  // 更新奖章
  updateMedal(newStreak);
  // 保存
  DataStore.save('checkin.json',checkinData);
  DataStore.save('streak.json',streakData);
  DataStore.save('flame.json',flameData);
  DataStore.save('medals.json',medalsData);
  // 刷新UI
  renderCheckin();renderFlames();renderStreakDots();
  renderCalendar();renderHeatmap();renderMedalWallCurrent();
  showToast('补打成功！连续天数已恢复');
}

function cancelCheckin(){
  var today=todayStr();
  if(!isCheckedIn(today))return;
  var idx=checkinData.dates.indexOf(today);
  if(idx>-1)checkinData.dates.splice(idx,1);
  checkinDateSet.delete(today);
  // 重新计算streak
  streakData.current=computeStreak();
  // 扣火焰
  flameData.total=Math.max(0,flameData.total-1);
  // 更新奖章
  updateMedal(streakData.current);
  // 保存
  DataStore.save('checkin.json',checkinData);
  DataStore.save('streak.json',streakData);
  DataStore.save('flame.json',flameData);
  DataStore.save('medals.json',medalsData);
  // 刷新UI
  renderCheckin();renderFlames();renderStreakDots();
  renderCalendar();renderHeatmap();renderMedalWallCurrent();
  showToast('已取消今日打卡');
}

function computeStreak(){
  if(!checkinData.dates.length)return 0;
  var today=todayStr(),yesterday=yesterdayStr();
  var startStr;
  if(checkinDateSet.has(today)){startStr=today;}
  else if(checkinDateSet.has(yesterday)){startStr=yesterday;}
  else{return 0;}
  var streak=0;
  var d=parseDate(startStr);
  while(checkinDateSet.has(fmt(d))){streak++;d.setDate(d.getDate()-1);}
  return streak;
}

// ===== 火焰系统 =====
function getFlameBreakdown(total){
  // 三进制：9小火焰=1大火焰，3小火焰=1中火焰
  var large=Math.floor(total/9);
  var remaining=total%9;
  var medium=Math.floor(remaining/3);
  var small=remaining%3;
  return{large:large,medium:medium,small:small};
}

// 超级火焰激励：50天/100天/365天里程碑后每10天一个
function getSuperFlames(streak){
  if(streak<50)return [];
  var flames=[];
  var level,count;
  if(streak>=365){
    level='mega';
    count=Math.floor((streak-365)/10)+1;
  }else if(streak>=100){
    level='super';
    count=Math.floor((streak-100)/10)+1;
  }else{
    level='big';
    count=Math.floor((streak-50)/10)+1;
  }
  for(var i=0;i<count;i++)flames.push(level);
  return flames;
}

function getSuperFlameLabel(streak){
  if(streak>=365)return '365天里程碑 · 每10天一个究极火焰';
  if(streak>=100)return '100天里程碑 · 每10天一个超级火焰';
  if(streak>=50)return '50天里程碑 · 每10天一个大火焰';
  return '';
}

function renderFlames(){
  var total=flameData.total;
  var bd=getFlameBreakdown(total);
  var el=document.getElementById('flameDisplay');
  var countEl=document.getElementById('flameCount');
  
  // 计算超级火焰（基于连续天数）
  var streak=computeStreak();
  var supers=getSuperFlames(streak);
  
  if(total===0&&supers.length===0){
    el.innerHTML='<span class="flame-placeholder">打卡后获得火焰 '+iconSvg('flame')+'</span>';
    countEl.textContent='0 个小火焰';
    return;
  }
  
  var html='';
  // 先显示超级火焰
  if(supers.length){
    html+='<div class="super-flame-row">';
    supers.forEach(function(lvl){
      html+='<span class="super-flame super-flame-'+lvl+'">'+iconSvg('flame')+'</span>';
    });
    html+='</div>';
    if(total>0)html+='<div class="flame-divider"></div>';
  }
  // 再显示普通火焰
  for(var i=0;i<bd.large;i++)html+='<span class="flame-large">'+iconSvg('flame')+'</span>';
  for(var i=0;i<bd.medium;i++)html+='<span class="flame-medium">'+iconSvg('flame')+'</span>';
  for(var i=0;i<bd.small;i++)html+='<span class="flame-small">'+iconSvg('flame')+'</span>';
  el.innerHTML=html;
  
  var parts=[];
  if(supers.length)parts.push(supers.length+'个超级火焰');
  if(bd.large)parts.push(bd.large+'大火焰');
  if(bd.medium)parts.push(bd.medium+'中火焰');
  if(bd.small)parts.push(bd.small+'小火焰');
  countEl.innerHTML='共 '+total+' 个小火焰'+(parts.length?'（'+parts.join(' + ')+'）':'')+
    (supers.length?'<br><span class="super-flame-hint">'+getSuperFlameLabel(streak)+'</span>':'');
}

// ===== 奖章系统 =====
function getTier(days){
  if(days>=512)return'gold';
  if(days>=128)return'crimson';
  if(days>=54)return'purple';
  if(days>=21)return'blue';
  return'none';
}

function tierIsHigher(a,b){return TIER_ORDER.indexOf(a)>TIER_ORDER.indexOf(b);}

function assignLabel(tier){
  var labels=MEDAL_TIERS[tier].labels;
  if(!labels.length)return '';
  var used=medalsData.labelMemory[tier]||[];
  var available=labels.filter(function(l){return used.indexOf(l)===-1;});
  var pool=available.length?available:labels;
  if(!available.length){medalsData.labelMemory[tier]=[];}
  var label=pool[Math.floor(Math.random()*pool.length)];
  medalsData.labelMemory[tier].push(label);
  return label;
}

function updateMedal(streak){
  var tier=getTier(streak);
  if(tier==='none'){
    // 不够21天，没有奖章
    return;
  }
  if(!medalsData.liveMedal){
    // 创建新奖章
    medalsData.liveMedal={tier:tier,label:assignLabel(tier),days:streak,startDate:streakData.startDate,maxTier:tier};
  }else{
    medalsData.liveMedal.days=streak;
    var newTier=getTier(streak);
    if(newTier!==medalsData.liveMedal.tier&&tierIsHigher(newTier,medalsData.liveMedal.tier)){
      // 升级
      medalsData.liveMedal.tier=newTier;
      medalsData.liveMedal.maxTier=newTier;
      medalsData.liveMedal.label=assignLabel(newTier);
    }
  }
}

function freezeMedal(days){
  if(!medalsData.liveMedal)return;
  medalsData.frozenMedals.push({
    tier:medalsData.liveMedal.tier,
    label:medalsData.liveMedal.label,
    days:days,
    dateEarned:todayStr(),
    startDate:medalsData.liveMedal.startDate,
    frozen:true
  });
  medalsData.liveMedal=null;
  // 更新大满贯
  var crimsonCount=medalsData.frozenMedals.filter(function(m){return m.tier==='crimson';}).length;
  var goldCount=medalsData.frozenMedals.filter(function(m){return m.tier==='gold';}).length;
  medalsData.grandSlam=Math.min(crimsonCount,goldCount);
}

function renderMedalWall(){
  var statsEl=document.getElementById('medalStats');
  var currentEl=document.getElementById('medalCurrent');
  var gridEl=document.getElementById('medalGrid');
  var gsEl=document.getElementById('grandSlamSection');

  // 统计
  var counts={blue:0,purple:0,crimson:0,gold:0};
  medalsData.frozenMedals.forEach(function(m){if(counts[m.tier]!==undefined)counts[m.tier]++;});
  statsEl.innerHTML=
    '<div class="medal-stat-item"><div class="medal-stat-num" style="color:#4A90D9">'+counts.blue+'</div><div class="medal-stat-label">蓝奖章</div></div>'+
    '<div class="medal-stat-item"><div class="medal-stat-num" style="color:#9B8ADC">'+counts.purple+'</div><div class="medal-stat-label">淡紫奖章</div></div>'+
    '<div class="medal-stat-item"><div class="medal-stat-num" style="color:#E53935">'+counts.crimson+'</div><div class="medal-stat-label">大红奖章</div></div>'+
    '<div class="medal-stat-item"><div class="medal-stat-num" style="color:#FFD700">'+counts.gold+'</div><div class="medal-stat-label">金光奖章</div></div>';

  // 当前进行中
  if(medalsData.liveMedal){
    var lm=medalsData.liveMedal;
    currentEl.innerHTML=
      '<div class="medal-current-title">当前连续打卡</div>'+
      '<div class="medal-current-streak">'+lm.days+' 天</div>'+
      '<div class="medal-current-tier" style="color:'+MEDAL_TIERS[lm.tier].color+'">'+TIER_NAMES[lm.tier]+' · '+lm.label+'</div>';
  }else{
    var streak=computeStreak();
    if(streak>0){
      currentEl.innerHTML='<div class="medal-current-title">当前连续打卡</div><div class="medal-current-streak">'+streak+' 天</div><div class="medal-current-tier" style="color:var(--muted)">坚持到21天获得首个奖章</div>';
    }else{
      currentEl.innerHTML='<div class="medal-current-title">尚未开始连续打卡</div><div class="medal-current-streak" style="font-size:16px;color:var(--muted)">今天打卡开始你的旅程</div>';
    }
  }

  // 奖章网格
  var allMedals=[];
  // 进行中的奖章（如果有）
  if(medalsData.liveMedal){
    allMedals.push(Object.assign({},medalsData.liveMedal,{live:true}));
  }
  // 已冻结的奖章（按获得时间排序）
  medalsData.frozenMedals.slice().sort(function(a,b){return new Date(a.dateEarned)-new Date(b.dateEarned);}).forEach(function(m){allMedals.push(m);});

  if(!allMedals.length){
    gridEl.innerHTML='<div class="medal-empty"><div class="medal-empty-icon">'+iconSvg('medal')+'</div><div class="medal-empty-text">还没有奖章</div><div class="medal-empty-hint">连续打卡21天获得第一个蓝奖章</div></div>';
  }else{
    gridEl.innerHTML=allMedals.map(function(m){
      var tierClass='medal-tier-'+m.tier;
      var liveBadge=m.live?'<span class="medal-live-badge">进行中</span>':'';
      var dateStr=m.dateEarned?new Date(m.dateEarned).toLocaleDateString('zh-CN'):'';
      return '<div class="medal-item '+tierClass+(m.live?' live':'')+'">'+liveBadge+
        '<div class="medal-circle">'+MEDAL_TIERS[m.tier].icon+
        '<div class="medal-days">'+m.days+'</div></div>'+
        '<div class="medal-label">'+m.label+'</div>'+
        '<div class="medal-date">'+dateStr+'</div></div>';
    }).join('');
  }

  // 大满贯
  if(medalsData.grandSlam>0){
    gsEl.style.display='block';
    gsEl.innerHTML='<div class="grand-slam-title">'+iconSvg('trophy')+' 大满贯成就</div>'+
      '<div class="grand-slam-medal">'+
      '<div class="grand-slam-hex"><svg viewBox="0 0 72 72"><polygon points="36,4 64,20 64,52 36,68 8,52 8,20" fill="url(#gsGrad)" stroke="#FFD700" stroke-width="2"/><defs><linearGradient id="gsGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD700"/><stop offset="1" stop-color="#FF3B30"/></linearGradient></defs></svg></div>'+
      '<div class="grand-slam-label">大满贯'+(medalsData.grandSlam>1?'*'+medalsData.grandSlam:'')+'</div>'+
      '<div class="grand-slam-count">同时拥有世锦赛 + 奥运会奖章</div></div>';
  }else{
    gsEl.style.display='none';
  }
}

function renderMedalWallCurrent(){
  // 只更新当前进行中的部分（不重渲染整个奖章墙）
  // 奖章墙是独立视图，不需要实时更新
}

// ===== 打卡UI渲染 =====
function renderToday(){
  var d=new Date();
  var months=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var weeks=['日','一','二','三','四','五','六'];
  document.getElementById('todayDate').textContent=months[d.getMonth()]+d.getDate()+'日 周'+weeks[d.getDay()];
}

function renderCheckin(){
  var today=todayStr();
  var yesterday=yesterdayStr();
  var checked=isCheckedIn(today);
  var btn=document.getElementById('checkinBtn');
  btn.classList.toggle('done',checked);
  btn.querySelector('.checkin-label').textContent=checked?'今日已打卡':'今日打卡';
  btn.querySelector('.checkin-emoji').innerHTML=iconSvg(checked?'check':'book');
  // 补打按钮
  var makeupBtn=document.getElementById('makeupBtn');
  makeupBtn.disabled=isCheckedIn(yesterday);
  if(isCheckedIn(yesterday)){makeupBtn.style.opacity='0.4';makeupBtn.style.cursor='not-allowed';}
  else{makeupBtn.style.opacity='';makeupBtn.style.cursor='';}
  // 取消按钮
  var cancelBtn=document.getElementById('cancelCheckinBtn');
  cancelBtn.disabled=!checked;
  cancelBtn.style.opacity=checked?'':'0.4';
  cancelBtn.style.cursor=checked?'':'not-allowed';
  // 连续天数
  var streak=computeStreak();
  document.getElementById('streakCount').textContent=streak;
}

function renderStreakDots(){
  var days=[];var d=new Date();d.setHours(0,0,0,0);
  var labels=['日','一','二','三','四','五','六'];
  for(var i=6;i>=0;i--){
    var dd=new Date(d);dd.setDate(dd.getDate()-i);
    var ds=fmt(dd);
    days.push({date:ds,checked:isCheckedIn(ds),isToday:ds===todayStr(),label:labels[dd.getDay()]});
  }
  document.getElementById('streakDots').innerHTML=days.map(function(d){
    return '<div class="dot-wrap"><span class="dot-label">'+d.label+'</span><span class="dot '+(d.checked?'filled':'')+' '+(d.isToday?'today':'')+'"></span></div>';
  }).join('');
}

// ===== 路线图 =====
function renderRoadmap(){
  var icons=['rocket','globe','phone','wrench','dumbbell','star'];
  var times=['今晚','暑假3周','大一上','大一下','大二','长线'];
  var html='';
  STAGES.forEach(function(s,i){
    var state='';
    if(isStageDone(s.id))state='done';
    else if(s.id===currentStageId())state='current';
    if(i>0)html+='<div class="rm-arrow">›</div>';
    html+='<div class="rm-node '+state+'"><div class="rm-icon">'+iconSvg(icons[i])+'</div><div class="rm-title">'+s.title.split('·')[1].trim()+'</div><div class="rm-time">'+times[i]+'</div></div>';
  });
  document.getElementById('roadmapFlow').innerHTML=html;
}

// ===== 任务系统 =====
function getStages(){return taskData.customStages||STAGES;}
function stageTasks(s){return s.tasks.filter(function(x){return x.id;});}
function allTasks(){var a=[];getStages().forEach(function(s){s.tasks.forEach(function(x){if(x.id)a.push(x.id);});});return a;}
function isStageDone(id){var s=getStages().find(function(x){return x.id===id;});if(!s)return false;var t=stageTasks(s);return t.length>0&&t.every(function(x){return taskData.tasks[x.id];});}
function currentStageId(){for(var i=0;i<getStages().length;i++){if(!isStageDone(getStages()[i].id))return getStages()[i].id;}return null;}

function renderStages(){
  var board=document.getElementById('board');board.innerHTML='';
  getStages().forEach(function(s){
    var tasks=stageTasks(s);
    var done=tasks.filter(function(t){return taskData.tasks[t.id];}).length;
    var allDone=done>0&&done===tasks.length;
    var isCurrent=s.id===currentStageId();
    var el=document.createElement('div');
    el.className='stage'+(allDone?' done':'')+(isCurrent&&allDone?'':'');
    el.dataset.id=s.id;
    el.innerHTML=
      '<div class="stage-head">'+
        '<div class="stage-num">'+(allDone?'✓':s.id.replace('s',''))+'</div>'+
        '<div class="stage-meta"><h3>'+s.title+'</h3><div class="stage-sub">'+s.sub+'</div>'+
        '<div class="stage-bar"><i style="width:'+(tasks.length?Math.round(done/tasks.length*100):0)+'%"></i></div></div>'+
        '<div class="stage-arrow">›</div>'+
      '</div>'+
      '<div class="stage-body"><div class="stage-tasks"></div></div>';
    var body=el.querySelector('.stage-tasks');
    s.tasks.forEach(function(x){
      if(x.week){
        var wl=document.createElement('div');wl.className='week-label';wl.textContent=x.week;body.appendChild(wl);
      }else{
        var isStar=x.t.indexOf('★')===0;
        var t=document.createElement('div');
        t.className='task'+(taskData.tasks[x.id]?' done':'');
        t.innerHTML='<div class="ck"></div><div class="tx'+(isStar?' star':'')+'">'+(isStar?'<span class="star-icon">★</span> ':'')+x.t.replace(/^★\s*/,'')+'</div>';
        t.addEventListener('click',function(){
          taskData.tasks[x.id]=!taskData.tasks[x.id];
          DataStore.save('tasks.json',taskData);
          renderStages();updateStats();renderRoadmap();
        });
        body.appendChild(t);
      }
    });
    el.querySelector('.stage-head').addEventListener('click',function(){el.classList.toggle('open');});
    if(isCurrent)el.classList.add('open');
    board.appendChild(el);
  });
}

function updateStats(){
  var all=allTasks();
  var done=all.filter(function(id){return taskData.tasks[id];}).length;
  document.getElementById('doneCount').textContent=done;
  document.getElementById('totalCount').textContent=all.length;
  var pct=all.length?Math.round(done/all.length*100):0;
  document.getElementById('pctNum').textContent=pct+'%';
  var circumference=2*Math.PI*50;
  var offset=circumference-(pct/100)*circumference;
  document.getElementById('ringFg').style.strokeDashoffset=offset;
}

// ===== 日历 =====
function renderCalendar(){
  var year=calCurrentMonth.getFullYear();
  var month=calCurrentMonth.getMonth();
  var months=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  document.getElementById('calTitle').textContent=year+'年 '+months[month];

  var firstDay=new Date(year,month,1);
  var lastDay=new Date(year,month+1,0);
  var startWeekday=firstDay.getDay();
  var daysInMonth=lastDay.getDate();
  var today=todayStr();

  var html='';
  // 上月填充
  var prevMonth=new Date(year,month,0);
  var prevDays=prevMonth.getDate();
  for(var i=startWeekday-1;i>=0;i--){
    var d=prevMonth.getDate()-i;
    html+='<div class="cal-cell other-month"><span class="cal-day-num">'+d+'</span></div>';
  }
  // 本月
  for(var d=1;d<=daysInMonth;d++){
    var ds=fmt(new Date(year,month,d));
    var checked=checkinDateSet.has(ds);
    var isToday=ds===today;
    var isFuture=ds>today;
    var mood=moodData.moods[ds];
    var hasDiary=diaryData.entries[ds]&&diaryData.entries[ds].trim();
    var classes='cal-cell';
    if(checked)classes+=' checked';
    else if(!isFuture)classes+=' unchecked';
    if(isFuture)classes+=' future';
    if(isToday)classes+=' today';
    html+='<div class="'+classes+'" data-date="'+ds+'">'+
      '<span class="cal-day-num">'+d+'</span>'+
      (mood?'<span class="cal-mood">'+mood+'</span>':'')+
      (hasDiary?'<span class="cal-diary-dot"></span>':'')+
    '</div>';
  }
  // 下月填充
  var totalCells=startWeekday+daysInMonth;
  var remaining=(7-totalCells%7)%7;
  for(var i=1;i<=remaining;i++){
    html+='<div class="cal-cell other-month"><span class="cal-day-num">'+i+'</span></div>';
  }
  document.getElementById('calGrid').innerHTML=html;
  // 绑定点击
  document.querySelectorAll('.cal-cell[data-date]').forEach(function(cell){
    cell.addEventListener('click',function(){
      var date=cell.dataset.date;
      if(date)openDayDetail(date);
    });
  });
}

// ===== 日详情 =====
function openDayDetail(dateStr){
  selectedDate=dateStr;
  var panel=document.getElementById('dayDetail');
  panel.style.display='block';
  var d=parseDate(dateStr);
  var months=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  var weeks=['日','一','二','三','四','五','六'];
  document.getElementById('dayDetailDate').textContent=months[d.getMonth()]+d.getDate()+'日 周'+weeks[d.getDay()];
  // 打卡状态
  var statusEl=document.getElementById('dayDetailStatus');
  if(isCheckedIn(dateStr)){statusEl.textContent='✓ 已打卡';statusEl.className='day-detail-status';}
  else{statusEl.textContent='未打卡';statusEl.className='day-detail-status not-checked';}
  // 心情
  var currentMood=moodData.moods[dateStr]||'';
  document.querySelectorAll('.mood-btn').forEach(function(btn){
    btn.classList.toggle('selected',btn.dataset.mood===currentMood);
  });
  // 日记
  document.getElementById('diaryText').value=diaryData.entries[dateStr]||'';
  diaryEditMode=true;
  document.getElementById('diaryText').style.display='';
  document.getElementById('diaryPreview').style.display='none';
  document.getElementById('diaryEditBtn').classList.add('active');
  document.getElementById('diaryPreviewBtn').classList.remove('active');
  // 截图
  renderScreenshots(dateStr);
  // 滚动到面板
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function closeDayDetail(){
  document.getElementById('dayDetail').style.display='none';
  selectedDate=null;
}

function setMood(mood){
  if(!selectedDate)return;
  if(mood){moodData.moods[selectedDate]=mood;}
  else{delete moodData.moods[selectedDate];}
  DataStore.save('mood.json',moodData);
  document.querySelectorAll('.mood-btn').forEach(function(btn){
    btn.classList.toggle('selected',btn.dataset.mood===mood);
  });
  renderCalendar();
  showToast(mood?'心情已记录':'心情已清除');
}

function saveDiary(){
  if(!selectedDate)return;
  var text=document.getElementById('diaryText').value;
  if(text.trim()){diaryData.entries[selectedDate]=text;}
  else{delete diaryData.entries[selectedDate];}
  DataStore.save('diary.json',diaryData);
  renderCalendar();
}

function toggleDiaryMode(preview){
  diaryEditMode=!preview;
  document.getElementById('diaryText').style.display=preview?'none':'';
  document.getElementById('diaryPreview').style.display=preview?'':'none';
  document.getElementById('diaryEditBtn').classList.toggle('active',!preview);
  document.getElementById('diaryPreviewBtn').classList.toggle('active',preview);
  if(preview){
    saveDiary();
    document.getElementById('diaryPreview').innerHTML=parseMarkdown(document.getElementById('diaryText').value);
  }
}

// ===== Markdown 解析器 =====
function parseMarkdown(text){
  if(!text)return'';
  // 转义HTML
  text=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var lines=text.split('\n');
  var html=[];
  var inList=false,inOl=false,inCode=false,inQuote=false;
  for(var i=0;i<lines.length;i++){
    var line=lines[i];
    // 代码块
    if(line.trim().indexOf('```')===0){inCode=!inCode;html.push(inCode?'<pre><code>':'</code></pre>');continue;}
    if(inCode){html.push(line);continue;}
    // 标题
    var h=line.match(/^(#{1,3})\s+(.+)/);
    if(h){var level=h[1].length;if(inList){html.push('</ul>');inList=false;}if(inOl){html.push('</ol>');inOl=false;}html.push('<h'+level+'>'+inlineMd(h[2])+'</h'+level+'>');continue;}
    // 引用
    if(line.trim().indexOf('>')===0){if(!inQuote){html.push('<blockquote>');inQuote=true;}html.push(inlineMd(line.replace(/^\s*>\s?/,'')));continue;}
    else{if(inQuote){html.push('</blockquote>');inQuote=false;}}
    // 有序列表
    var ol=line.match(/^\d+\.\s+(.+)/);
    if(ol){if(!inOl){html.push('<ol>');inOl=true;}if(inList){html.push('</ul>');inList=false;}html.push('<li>'+inlineMd(ol[1])+'</li>');continue;}
    // 无序列表
    var ul=line.match(/^[-*]\s+(.+)/);
    if(ul){if(!inList){html.push('<ul>');inList=true;}if(inOl){html.push('</ol>');inOl=false;}html.push('<li>'+inlineMd(ul[1])+'</li>');continue;}
    // 关闭列表
    if(inList){html.push('</ul>');inList=false;}
    if(inOl){html.push('</ol>');inOl=false;}
    // 空行
    if(!line.trim()){html.push('');continue;}
    // 普通段落
    html.push('<p>'+inlineMd(line)+'</p>');
  }
  if(inList)html.push('</ul>');
  if(inOl)html.push('</ol>');
  if(inQuote)html.push('</blockquote>');
  if(inCode)html.push('</code></pre>');
  return html.join('\n');
}

function inlineMd(text){
  // 图片
  text=text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,function(m,alt,src){return'<img src="'+src+'" alt="'+alt+'">';});
  // 链接
  text=text.replace(/\[([^\]]+)\]\(([^)]+)\)/g,function(m,t,u){return'<a href="'+u+'" target="_blank">'+t+'</a>';});
  // 加粗
  text=text.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  // 斜体
  text=text.replace(/\*(.+?)\*/g,'<em>$1</em>');
  // 删除线
  text=text.replace(/~~(.+?)~~/g,'<del>$1</del>');
  // 行内代码
  text=text.replace(/`([^`]+)`/g,'<code>$1</code>');
  return text;
}

// ===== 截图 =====
async function uploadScreenshots(){
  var files=await dashboardAPI.openImage();
  if(!files||!files.length)return;
  if(!selectedDate)return;
  if(!screenshotData.shots[selectedDate])screenshotData.shots[selectedDate]=[];
  files.forEach(function(f){screenshotData.shots[selectedDate].push(f);});
  DataStore.save('screenshots.json',screenshotData);
  renderScreenshots(selectedDate);
  showToast('上传了 '+files.length+' 张截图');
}

async function renderScreenshots(dateStr){
  var grid=document.getElementById('screenshotGrid');
  var shots=screenshotData.shots[dateStr]||[];
  if(!shots.length){grid.innerHTML='<div class="screenshot-empty">还没有截图记录</div>';return;}
  grid.innerHTML='';
  for(var i=0;i<shots.length;i++){
    (async function(filename,idx){
      var item=document.createElement('div');
      item.className='screenshot-item';
      var img=document.createElement('img');
      var base64=await dashboardAPI.readScreenshot(filename);
      if(base64)img.src=base64;
      var del=document.createElement('div');
      del.className='screenshot-delete';del.textContent='✕';
      del.addEventListener('click',function(e){
        e.stopPropagation();
        deleteScreenshot(dateStr,idx);
      });
      item.appendChild(img);
      item.appendChild(del);
      grid.appendChild(item);
    })(shots[i],i);
  }
}

function deleteScreenshot(dateStr,idx){
  var shots=screenshotData.shots[dateStr]||[];
  if(idx<0||idx>=shots.length)return;
  dashboardAPI.deleteScreenshot(shots[idx]);
  shots.splice(idx,1);
  if(!shots.length)delete screenshotData.shots[dateStr];
  DataStore.save('screenshots.json',screenshotData);
  renderScreenshots(dateStr);
  showToast('截图已删除');
}

// ===== 名言系统 =====
function showDailyQuote(){
  var today=todayStr();
  if(quotesData.lastShownDate!==today){
    // 新的一天，自动换一条
    quotesData.lastShownDate=today;
    quotesData.currentQuote=pickRandomQuote();
    DataStore.save('quotes.json',quotesData);
  }
  displayQuote();
}

function pickRandomQuote(){
  var pool=BUILTIN_QUOTES.concat(quotesData.custom||[]);
  return pool[Math.floor(Math.random()*pool.length)];
}

function displayQuote(){
  var q=quotesData.currentQuote||pickRandomQuote();
  quotesData.currentQuote=q;
  document.getElementById('quoteText').textContent=q.text;
  document.getElementById('quoteAuthor').textContent=q.author?'— '+q.author:'— 匿名';
}

function refreshQuote(){
  quotesData.currentQuote=pickRandomQuote();
  DataStore.save('quotes.json',quotesData);
  displayQuote();
  // 淡入动画
  var el=document.getElementById('quoteText');
  el.style.opacity='0';
  setTimeout(function(){el.style.transition='opacity .4s';el.style.opacity='1';},50);
}

function addCustomQuote(){
  document.getElementById('quoteModal').style.display='flex';
  document.getElementById('quoteInput').value='';
  document.getElementById('quoteAuthorInput').value='';
}

function saveCustomQuote(){
  var text=document.getElementById('quoteInput').value.trim();
  if(!text){showToast('请输入名言内容');return;}
  var author=document.getElementById('quoteAuthorInput').value.trim();
  if(!quotesData.custom)quotesData.custom=[];
  quotesData.custom.push({text:text,author:author});
  DataStore.save('quotes.json',quotesData);
  document.getElementById('quoteModal').style.display='none';
  renderCustomQuotes();
  showToast('名言已添加');
}

function renderCustomQuotes(){
  var el=document.getElementById('customQuotes');
  var list=quotesData.custom||[];
  if(!list.length){el.style.display='none';return;}
  el.style.display='block';
  var html='<div class="custom-quotes-title">我的收藏 ('+list.length+')</div>';
  list.forEach(function(q,idx){
    html+='<div class="custom-quote-item"><div class="cq-text">'+q.text+'</div>'+
      (q.author?'<div class="cq-author">— '+q.author+'</div>':'')+
      '<div class="cq-delete" data-idx="'+idx+'">✕</div></div>';
  });
  document.getElementById('customQuotesList').innerHTML=html;
  document.querySelectorAll('.cq-delete').forEach(function(btn){
    btn.addEventListener('click',function(){
      var idx=parseInt(btn.dataset.idx);
      quotesData.custom.splice(idx,1);
      DataStore.save('quotes.json',quotesData);
      renderCustomQuotes();
      showToast('已删除');
    });
  });
}

// ===== 热力图（修复：月份标签用绝对定位防重叠 + 月份分隔线）=====
function renderHeatmap(){
  var grid=document.getElementById('heatmapGrid');
  var monthsEl=document.getElementById('heatmapMonths');
  var today=new Date();today.setHours(0,0,0,0);
  // 显示最近365天
  var start=new Date(today);start.setDate(start.getDate()-364);
  // 调整到周的起始（周日）
  start.setDate(start.getDate()-start.getDay());
  var CELL=14;
  var TOTAL_WEEKS=53;
  var weeks=[];
  var monthPositions=[];
  var currentMonth=-1;
  for(var w=0;w<TOTAL_WEEKS;w++){
    var week=[];
    var monthStart=false;
    for(var d=0;d<7;d++){
      var day=new Date(start);day.setDate(day.getDate()+w*7+d);
      var ds=fmt(day);
      if(day>today){
        week.push({date:ds,future:true,checked:false});
      }else{
        week.push({date:ds,future:false,checked:checkinDateSet.has(ds)});
      }
      if(d===0){
        var m=day.getMonth();
        if(m!==currentMonth){
          monthPositions.push({week:w,label:(m+1)+'月'});
          currentMonth=m;
          monthStart=true;
        }
      }
    }
    weeks.push({days:week,monthStart:monthStart});
  }
  // 渲染月份标签（绝对定位，防止重叠）
  monthsEl.style.position='relative';
  monthsEl.style.width=(TOTAL_WEEKS*CELL)+'px';
  monthsEl.style.height='18px';
  var mh='';
  for(var i=0;i<monthPositions.length;i++){
    var mp=monthPositions[i];
    var nextWeek=i<monthPositions.length-1?monthPositions[i+1].week:TOTAL_WEEKS;
    var spanW=(nextWeek-mp.week)*CELL;
    mh+='<span style="position:absolute;left:'+(mp.week*CELL)+'px;width:'+spanW+'px;overflow:hidden;white-space:nowrap;">'+mp.label+'</span>';
  }
  monthsEl.innerHTML=mh;
  // 渲染网格（月份起始列加分隔线）
  var gh='';
  weeks.forEach(function(week,w){
    gh+='<div class="heatmap-col'+(week.monthStart&&w>0?' month-sep':'')+'">';
    week.days.forEach(function(day){
      var cls='hm-cell';
      if(day.future)cls+=' hm-future';
      else if(day.checked)cls+=' hm-4';
      else cls+=' hm-0';
      gh+='<span class="'+cls+'" title="'+day.date+'"></span>';
    });
    gh+='</div>';
  });
  grid.innerHTML=gh;
}

// ===== 深色模式 =====
function toggleDarkMode(){
  settingsData.darkMode=!settingsData.darkMode;
  document.body.classList.toggle('dark',settingsData.darkMode);
  // 同步设置面板开关视觉
  var stToggle=document.getElementById('settingsThemeToggle');
  if(stToggle)stToggle.classList.toggle('on',settingsData.darkMode);
  DataStore.save('settings.json',settingsData);
}

// ===== 晚间提醒 =====
function checkEveningReminder(){
  var hour=new Date().getHours();
  var today=todayStr();
  if(hour>=20&&!isCheckedIn(today)){
    dashboardAPI.showNotification('学习看板提醒','今天还没打卡哦！坚持下去，别断了连续天数 🔥');
  }
}

// ===== 任务编辑（交互式：每条带边框 + 添加/删除按钮）=====
function openTaskEditor(){
  var modal=document.getElementById('taskModal');
  var area=document.getElementById('taskEditArea');
  area.innerHTML='';
  var stages=getStages();
  stages.forEach(function(s,idx){
    var div=document.createElement('div');
    div.className='task-edit-stage';
    div.dataset.stage=idx;
    div.innerHTML='<div class="task-edit-stage-title">'+s.title+'</div>';
    var list=document.createElement('div');
    list.className='task-edit-list';
    div.appendChild(list);
    s.tasks.forEach(function(t){
      list.appendChild(createTaskEditRow(t));
    });
    // 添加任务按钮
    var addTaskBtn=document.createElement('button');
    addTaskBtn.className='task-edit-add-btn';
    addTaskBtn.textContent='+ 添加任务';
    addTaskBtn.addEventListener('click',function(){
      var row=createTaskEditRow({t:''});
      list.appendChild(row);
      row.querySelector('.task-edit-input').focus();
    });
    div.appendChild(addTaskBtn);
    // 添加周标签按钮
    var addWeekBtn=document.createElement('button');
    addWeekBtn.className='task-edit-add-btn week';
    addWeekBtn.textContent='+ 添加周标签';
    addWeekBtn.addEventListener('click',function(){
      var row=createTaskEditRow({week:''});
      list.appendChild(row);
      row.querySelector('.task-edit-input').focus();
    });
    div.appendChild(addWeekBtn);
    area.appendChild(div);
  });
  modal.style.display='flex';
}

function createTaskEditRow(task){
  var isWeek=task.week!==undefined;
  var row=document.createElement('div');
  row.className='task-edit-row'+(isWeek?' week-row':'');
  var input=document.createElement('input');
  input.className='task-edit-input';
  input.type='text';
  input.dataset.type=isWeek?'week':'task';
  input.placeholder=isWeek?'周标签（如 Week 1 · HTML + CSS）':'任务内容（★ 开头为重点任务）';
  input.value=isWeek?(task.week||''):(task.t||'');
  row.appendChild(input);
  var delBtn=document.createElement('button');
  delBtn.className='task-edit-del-btn';
  delBtn.textContent='✕';
  delBtn.title='删除此条';
  delBtn.addEventListener('click',function(){row.remove();});
  row.appendChild(delBtn);
  return row;
}

function saveTaskEdits(){
  var stages=getStages();
  document.querySelectorAll('.task-edit-stage').forEach(function(stageDiv){
    var idx=parseInt(stageDiv.dataset.stage);
    var tasks=[];
    stageDiv.querySelectorAll('.task-edit-row').forEach(function(row){
      var input=row.querySelector('.task-edit-input');
      var val=input.value.trim();
      if(!val)return;
      if(input.dataset.type==='week'){
        tasks.push({week:val});
      }else{
        var existing=stages[idx].tasks.find(function(t){return t.t===val;});
        tasks.push({id:existing?existing.id:('t_'+idx+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6)),t:val});
      }
    });
    stages[idx].tasks=tasks;
  });
  taskData.customStages=stages;
  DataStore.save('tasks.json',taskData);
  document.getElementById('taskModal').style.display='none';
  renderStages();updateStats();renderRoadmap();
  showToast('任务已保存');
}

// ===== 科技新闻系统 =====
function loadAboutIcon(){
  if(!dashboardAPI.getAppIcon)return;
  dashboardAPI.getAppIcon().then(function(dataUrl){
    if(dataUrl){
      var img=document.getElementById('aboutIconImg');
      var fallback=document.getElementById('aboutIconFallback');
      if(img){img.src=dataUrl;img.style.display='';}
      if(fallback)fallback.style.display='none';
    }
  }).catch(function(){});
}

function autoFetchNews(){
  // 如果缓存超过30分钟，自动刷新
  var needFetch=true;
  if(newsData.lastFetch){
    var age=Date.now()-new Date(newsData.lastFetch).getTime();
    if(age<30*60*1000)needFetch=false;
  }
  if(needFetch)fetchNews();
}

async function fetchNews(){
  var listEl=document.getElementById('newsList');
  if(listEl&&!newsData.items.length)listEl.innerHTML='<div class="news-loading">正在获取最新科技资讯...</div>';
  try{
    var result=await dashboardAPI.fetchNews();
    newsData.items=result.news||[];
    newsData.lastFetch=result.fetchTime;
    DataStore.save('news.json',newsData);
    renderNews();
  }catch(e){
    console.error('News fetch error:',e);
    if(listEl&&!newsData.items.length)listEl.innerHTML='<div class="news-loading">获取失败，点击右上角刷新重试</div>';
  }
}

function renderNews(){
  var listEl=document.getElementById('newsList');
  var timeEl=document.getElementById('newsUpdateTime');
  if(!listEl)return;
  if(!newsData.items.length){
    listEl.innerHTML='<div class="news-loading">暂无新闻，点击右上角刷新获取</div>';
    if(timeEl)timeEl.textContent='';
    return;
  }
  var html='';
  newsData.items.forEach(function(item){
    var title=escapeHtml(item.title);
    var source=escapeHtml(item.source||'');
    var time=formatNewsDate(item.date);
    var catsHtml='';
    if(item.cats&&item.cats.length){
      catsHtml=item.cats.slice(0,3).map(function(c){return '<span class="news-cat">'+escapeHtml(c)+'</span>';}).join('');
    }
    html+='<a class="news-item" href="#" data-link="'+escapeHtml(item.link||'')+'">'+
      '<div class="news-item-title">'+title+'</div>'+
      '<div class="news-item-meta">'+
      '<span class="news-source">'+source+'</span>'+
      catsHtml+
      '<span class="news-time">'+time+'</span></div></a>';
  });
  listEl.innerHTML=html;
  // 绑定点击
  listEl.querySelectorAll('.news-item').forEach(function(a){
    a.addEventListener('click',function(e){
      e.preventDefault();
      var link=a.dataset.link;
      if(link)openNewsLink(link);
    });
  });
  // 更新时间
  if(timeEl&&newsData.lastFetch){
    var fd=new Date(newsData.lastFetch);
    timeEl.textContent='更新于 '+fd.toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }
}

function formatNewsDate(dateStr){
  if(!dateStr)return'';
  var d=new Date(dateStr);
  if(isNaN(d))return'';
  var now=new Date();
  var diff=Math.floor((now-d)/(1000*60));
  if(diff<1)return'刚刚';
  if(diff<60)return diff+'分钟前';
  diff=Math.floor(diff/60);
  if(diff<24)return diff+'小时前';
  diff=Math.floor(diff/24);
  if(diff<30)return diff+'天前';
  return (d.getMonth()+1)+'月'+d.getDate()+'日';
}

function openNewsLink(url){
  if(window.dashboardAPI&&dashboardAPI.openExternal){
    dashboardAPI.openExternal(url);
  }else{
    window.open(url,'_blank');
  }
}

function escapeHtml(s){
  if(!s)return'';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== Toast =====
var toastTimer=null;
function showToast(msg){
  var el=document.getElementById('toast');
  el.textContent=msg;
  el.classList.add('show');
  if(toastTimer)clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){el.classList.remove('show');},2500);
}

// ===== 事件绑定 =====
function bindEvents(){
  // 打卡
  document.getElementById('checkinBtn').addEventListener('click',doCheckin);
  document.getElementById('makeupBtn').addEventListener('click',doMakeup);
  document.getElementById('cancelCheckinBtn').addEventListener('click',cancelCheckin);
  // 深色模式
  document.getElementById('themeToggle').addEventListener('click',toggleDarkMode);
  // 新闻刷新
  document.getElementById('newsRefresh').addEventListener('click',function(){
    fetchNews();
    showToast('正在刷新科技资讯...');
  });
  // 备份
  document.getElementById('exportBtn').addEventListener('click',async function(){
    var r=await dashboardAPI.exportBackup();
    showToast(r?'备份已导出':'导出取消');
  });
  document.getElementById('importBtn').addEventListener('click',async function(){
    var r=await dashboardAPI.importBackup();
    if(r){showToast('备份已导入，即将刷新');setTimeout(function(){location.reload();},1000);}
  });
  // 奖章墙
  document.getElementById('medalWallBtn').addEventListener('click',function(){
    renderMedalWall();
    document.getElementById('medalWallView').style.display='block';
  });
  document.getElementById('medalWallBack').addEventListener('click',function(){
    document.getElementById('medalWallView').style.display='none';
  });
  // 日历导航
  document.getElementById('calPrev').addEventListener('click',function(){
    calCurrentMonth.setMonth(calCurrentMonth.getMonth()-1);renderCalendar();
  });
  document.getElementById('calNext').addEventListener('click',function(){
    calCurrentMonth.setMonth(calCurrentMonth.getMonth()+1);renderCalendar();
  });
  document.getElementById('calToday').addEventListener('click',function(){
    calCurrentMonth=new Date();renderCalendar();
  });
  // 日详情
  document.getElementById('dayDetailClose').addEventListener('click',closeDayDetail);
  document.querySelectorAll('.mood-btn').forEach(function(btn){
    btn.addEventListener('click',function(){setMood(btn.dataset.mood);});
  });
  document.getElementById('diaryEditBtn').addEventListener('click',function(){toggleDiaryMode(false);});
  document.getElementById('diaryPreviewBtn').addEventListener('click',function(){toggleDiaryMode(true);});
  document.getElementById('diaryText').addEventListener('blur',saveDiary);
  document.getElementById('uploadShotBtn').addEventListener('click',uploadScreenshots);
  // 名言
  document.getElementById('quoteRefresh').addEventListener('click',refreshQuote);
  document.getElementById('quoteAdd').addEventListener('click',addCustomQuote);
  document.getElementById('quoteSave').addEventListener('click',saveCustomQuote);
  document.getElementById('quoteCancel').addEventListener('click',function(){
    document.getElementById('quoteModal').style.display='none';
  });
  // 任务编辑
  document.getElementById('editTasksBtn').addEventListener('click',openTaskEditor);
  document.getElementById('taskSave').addEventListener('click',saveTaskEdits);
  document.getElementById('taskCancel').addEventListener('click',function(){
    document.getElementById('taskModal').style.display='none';
  });
  // 重置
  document.getElementById('resetBtn').addEventListener('click',function(){
    document.getElementById('resetConfirm').classList.add('show');
  });
  document.getElementById('resetYes').addEventListener('click',async function(){
    checkinData={dates:[]};streakData={current:0,startDate:null,lastUpdate:null};
    flameData={total:0};medalsData={liveMedal:null,frozenMedals:[],labelMemory:{blue:[],purple:[],crimson:[],gold:[]},grandSlam:0};
    taskData={tasks:{},customStages:null};diaryData={entries:{}};
    moodData={moods:{}};
    await DataStore.save('checkin.json',checkinData);
    await DataStore.save('streak.json',streakData);
    await DataStore.save('flame.json',flameData);
    await DataStore.save('medals.json',medalsData);
    await DataStore.save('tasks.json',taskData);
    await DataStore.save('diary.json',diaryData);
    await DataStore.save('mood.json',moodData);
    document.getElementById('resetConfirm').classList.remove('show');
    location.reload();
  });
  document.getElementById('resetNo').addEventListener('click',function(){
    document.getElementById('resetConfirm').classList.remove('show');
  });
  // 模态背景点击关闭
  document.querySelectorAll('.modal').forEach(function(modal){
    modal.addEventListener('click',function(e){
      if(e.target===modal)modal.style.display='none';
    });
  });
}

// ===== 启动 =====
init();
