/* Shared clock UI for the public page and Apps Script workspace. */
(function (global) {
'use strict';
const countries = [["United Kingdom", "Europe/London", "gb", "#012169 #ffffff #c8102e"], ["France", "Europe/Paris", "fr", "#002395 #ffffff #ed2939"], ["Germany", "Europe/Berlin", "de", "#181818 #dd0000 #ffce00"], ["Spain", "Europe/Madrid", "es", "#aa151b #f1bf00 #aa151b"], ["Italy", "Europe/Rome", "it", "#009246 #ffffff #ce2b37"], ["Portugal", "Europe/Lisbon", "pt", "#006600 #ff0000"], ["Netherlands", "Europe/Amsterdam", "nl", "#ae1c28 #ffffff #21468b"], ["Greece", "Europe/Athens", "gr", "#0d5eaf #ffffff"], ["Poland", "Europe/Warsaw", "pl", "#ffffff #dc143c"], ["Finland", "Europe/Helsinki", "fi", "#ffffff #003580"], ["Turkey", "Europe/Istanbul", "tr", "#e30a17 #ffffff"], ["South Africa", "Africa/Johannesburg", "za", "#007749 #ffb81c #de3831 #002395"], ["Egypt", "Africa/Cairo", "eg", "#ce1126 #ffffff #000000"], ["Kenya", "Africa/Nairobi", "ke", "#000000 #bb0000 #006600"], ["Nigeria", "Africa/Lagos", "ng", "#008751 #ffffff #008751"], ["Morocco", "Africa/Casablanca", "ma", "#c1272d #006233"], ["Brazil - S\u00e3o Paulo", "America/Sao_Paulo", "br", "#009739 #ffdf00 #002776"], ["Argentina", "America/Argentina/Buenos_Aires", "ar", "#74acdf #ffffff #74acdf"], ["Chile", "America/Santiago", "cl", "#0039a6 #ffffff #d52b1e"], ["Colombia", "America/Bogota", "co", "#fcd116 #003893 #ce1126"], ["Peru", "America/Lima", "pe", "#d91023 #ffffff #d91023"], ["Venezuela", "America/Caracas", "ve", "#ffcc00 #00247d #cf142b"], ["USA - New York", "America/New_York", "us", "#b22234 #ffffff #3c3b6e"], ["USA - Chicago", "America/Chicago", "us", "#b22234 #ffffff #3c3b6e"], ["USA - Los Angeles", "America/Los_Angeles", "us", "#b22234 #ffffff #3c3b6e"], ["Canada - Toronto", "America/Toronto", "ca", "#ff0000 #ffffff #ff0000"], ["Mexico - Mexico City", "America/Mexico_City", "mx", "#006847 #ffffff #ce1126"], ["India", "Asia/Kolkata", "in", "#ff9933 #ffffff #138808"], ["China", "Asia/Shanghai", "cn", "#de2910 #ffde00"], ["Japan", "Asia/Tokyo", "jp", "#ffffff #bc002d"], ["Indonesia - Jakarta", "Asia/Jakarta", "id", "#ff0000 #ffffff"], ["Indonesia - Makassar", "Asia/Makassar", "id", "#ff0000 #ffffff"], ["Philippines", "Asia/Manila", "ph", "#0038a8 #ce1126 #fcd116"], ["Singapore", "Asia/Singapore", "sg", "#ef3340 #ffffff"], ["UAE", "Asia/Dubai", "ae", "#00732f #ffffff #000000 #ff0000"], ["Australia - Sydney", "Australia/Sydney", "au", "#012169 #ffffff #e4002b"], ["New Zealand", "Pacific/Auckland", "nz", "#00247d #ffffff #cc142b"], ["Bulgaria", "Europe/Sofia", "bg", "#ffffff #00966e #d62612"], ["Croatia", "Europe/Zagreb", "hr", "#ff0000 #ffffff #171796"], ["Czechia (Czech Republic)", "Europe/Prague", "cz", "#ffffff #d7141a #11457e"], ["Latvia", "Europe/Riga", "lv", "#9e1b34 #ffffff #9e1b34"], ["Lithuania", "Europe/Vilnius", "lt", "#fdb913 #006a44 #c1272d"], ["Iceland", "Atlantic/Reykjavik", "is", "#02529c #ffffff #dc1e35"], ["Austria", "Europe/Vienna", "at", "#ed2939 #ffffff #ed2939"], ["Malta", "Europe/Malta", "mt", "#ffffff #cf142b"], ["Belgium", "Europe/Brussels", "be", "#000000 #fdda24 #ef3340"], ["Switzerland", "Europe/Zurich", "ch", "#da291c #ffffff"], ["Sweden", "Europe/Stockholm", "se", "#006aa7 #fecc00"], ["Norway", "Europe/Oslo", "no", "#ba0c2f #ffffff #00205b"], ["Denmark", "Europe/Copenhagen", "dk", "#c60c30 #ffffff"], ["Ireland", "Europe/Dublin", "ie", "#169b62 #ffffff #ff883e"], ["Estonia", "Europe/Tallinn", "ee", "#4891d9 #181818 #ffffff"], ["Romania", "Europe/Bucharest", "ro", "#002b7f #fcd116 #ce1126"], ["Hungary", "Europe/Budapest", "hu", "#ce2939 #ffffff #477050"], ["Slovakia", "Europe/Bratislava", "sk", "#ffffff #0b4ea2 #ee1c25"], ["Slovenia", "Europe/Ljubljana", "si", "#ffffff #005da4 #ed1c24"], ["Serbia", "Europe/Belgrade", "rs", "#c6363c #0c4076 #ffffff"], ["Bosnia and Herzegovina", "Europe/Sarajevo", "ba", "#002395 #fecb00 #ffffff"], ["Montenegro", "Europe/Podgorica", "me", "#c40308 #d3ae3b"], ["Albania", "Europe/Tirane", "al", "#e41e20 #000000"], ["North Macedonia", "Europe/Skopje", "mk", "#d20000 #ffe600"], ["Luxembourg", "Europe/Luxembourg", "lu", "#ed2939 #ffffff #00a1de"], ["Cyprus", "Asia/Nicosia", "cy", "#ffffff #d57800 #4e5b31"], ["Ukraine", "Europe/Kyiv", "ua", "#0057b7 #ffd700"], ["Moldova", "Europe/Chisinau", "md", "#003da5 #ffd200 #cc092f"], ["Georgia", "Asia/Tbilisi", "ge", "#ffffff #ff0000"], ["Armenia", "Asia/Yerevan", "am", "#d90012 #0033a0 #f2a800"], ["Saudi Arabia", "Asia/Riyadh", "sa", "#006c35 #ffffff"], ["Thailand", "Asia/Bangkok", "th", "#a51931 #ffffff #2d2a4a"], ["Vietnam", "Asia/Ho_Chi_Minh", "vn", "#da251d #ffff00"], ["South Korea", "Asia/Seoul", "kr", "#ffffff #cd2e3a #0047a0"], ["Malaysia", "Asia/Kuala_Lumpur", "my", "#010066 #ffffff #cc0001 #ffcc00"], ["Pakistan", "Asia/Karachi", "pk", "#01411c #ffffff"], ["Bangladesh", "Asia/Dhaka", "bd", "#006a4e #f42a41"], ["Nepal", "Asia/Kathmandu", "np", "#dc143c #003893"], ["Uruguay", "America/Montevideo", "uy", "#ffffff #0038a8 #fcd116"], ["Ecuador", "America/Guayaquil", "ec", "#ffdd00 #034ea2 #ed1c24"], ["Bolivia", "America/La_Paz", "bo", "#d52b1e #f9e300 #007934"], ["Paraguay", "America/Asuncion", "py", "#d52b1e #ffffff #0038a8"], ["Ghana", "Africa/Accra", "gh", "#ce1126 #fcd116 #006b3f"], ["USA - Honolulu", "Pacific/Honolulu", "us", "#b22234 #ffffff #3c3b6e"]];

function utcMinutes(zone, now = new Date()) {
  const name = new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(now).find(p=>p.type==='timeZoneName').value;
  const match = name.match(/GMT([+-])(\d+):(\d+)/);
  return match ? (match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3])) : 0;
}
function offsetLabel(minutes) {
  const sign = minutes<0 ? '-' : '+'; const value=Math.abs(minutes);
  return 'UTC'+sign+String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
}
function groups(ids, now=new Date()) {
  const map=new Map();
  [...new Set(ids)].filter(i=>Number.isInteger(i)&&countries[i]).forEach(i=>{
    const offset=utcMinutes(countries[i][1],now); if(!map.has(offset))map.set(offset,[]); map.get(offset).push(i);
  });
  return [...map].sort((a,b)=>a[0]-b[0]).map(([offset,ids])=>({offset,ids:ids.sort((a,b)=>countries[a][0].localeCompare(countries[b][0]))}));
}
function node(tag, className, text) {const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
function mount(root, options={}) {
  const key=options.key || 'tq_public_clocks_v2';
  let selected=[0,11,16], floating=false, timer, signature='', floatSignature='';
  try {
    const saved=JSON.parse(localStorage.getItem(key)||'null');
    if(Array.isArray(saved))selected=saved;
    else if(saved){selected=saved.selected||[];floating=!!saved.floating;}
  } catch {}
  selected=selected.filter(i=>Number.isInteger(i)&&countries[i]);
  root.classList.add('tz-workspace');root.replaceChildren();
  const controls=node('div','tz-controls'), label=node('label','','Choose a country / city'), select=node('select','tz-select');
  select.id=options.selectId || 'tz-country-select';label.htmlFor=select.id;
  const placeholder=node('option','','Select a country');placeholder.value='';select.appendChild(placeholder);
  countries.map((c,i)=>({c,i})).sort((a,b)=>a.c[0].localeCompare(b.c[0])).forEach(({c,i})=>{const option=node('option','',c[0]+' ('+c[1]+')');option.value=String(i);select.appendChild(option);});
  const add=node('button','tz-button','Add clock');add.type='button';
  const hint=node('p','tz-hint','Clocks group by current UTC offset and adjust automatically for daylight saving time. Choices are saved on this browser.');
  const status=node('p','tz-status');status.setAttribute('role','status');
  const all=node('div','tz-groups');
  const floatPanel=node('aside','tz-floating');floatPanel.setAttribute('aria-label','Floating timezones');floatPanel.hidden=true;
  const floatHeader=node('div','tz-floating-header'), floatTitle=node('strong','','Timezones'), close=node('button','tz-button','Hide');close.type='button';floatHeader.append(floatTitle,close);
  const floatList=node('div','tz-float-list');floatPanel.append(floatHeader,floatList);
  let floatingToggle;
  controls.append(label,select,add);
  if(options.floating){
    const toggleLabel=node('label','tz-float-toggle');floatingToggle=node('input');floatingToggle.type='checkbox';floatingToggle.checked=floating;toggleLabel.append(floatingToggle,document.createTextNode(' Show floating clocks across pages'));controls.append(toggleLabel);
    floatingToggle.addEventListener('change',()=>{floating=floatingToggle.checked;persist();render();});document.body.appendChild(floatPanel);
  }
  root.append(controls,hint,status,all);
  function persist(){try {localStorage.setItem(key,JSON.stringify({selected,floating}));status.textContent='';}catch{status.textContent='Could not save clock preferences on this browser.';}}
  function remove(id){selected=selected.filter(i=>i!==id);persist();render();}
  function build(container,compact){
    container.replaceChildren();
    const grouped=groups(selected);
    if(!grouped.length){container.appendChild(node('p','tz-empty','Choose a country to add your first clock.'));return;}
    grouped.forEach(group=>{
      const section=node('section','tz-group'), heading=node('h3','tz-offset',offsetLabel(group.offset)), grid=node('div','tz-cards');
      section.append(heading,grid);container.appendChild(section);
      group.ids.forEach(id=>{
        const [name,zone,code,colors]=countries[id], card=node('article','tz-clock');card.dataset.zone=zone;
        const palette=colors.split(' ');card.style.setProperty('--flag-stripe','linear-gradient(90deg,'+palette.map((color,i)=>color+' '+(100*i/palette.length)+'% '+(100*(i+1)/palette.length)+'%').join(',')+')');
        const head=node('div','tz-clock-head'), country=node('h4','tz-country');
        const flag=node('img','tz-flag');flag.src='https://flagcdn.com/w80/'+code+'.png';flag.alt=name+' flag';flag.width=40;flag.height=28;flag.loading='lazy';flag.referrerPolicy='no-referrer';
        const fallback=node('span','tz-flag-fallback',code.toUpperCase());fallback.hidden=true;
        flag.addEventListener('error',()=>{flag.hidden=true;fallback.hidden=false;});
        country.append(flag,fallback,document.createTextNode(name));head.appendChild(country);
        if(!compact){const removeButton=node('button','tz-remove','Remove');removeButton.type='button';removeButton.setAttribute('aria-label','Remove '+name);removeButton.onclick=()=>remove(id);head.appendChild(removeButton);}
        const time=node('time','tz-time'), date=node('p','tz-date');card.append(head,time,date);grid.appendChild(card);
      });
    });
  }
  function update(container,now){container.querySelectorAll('.tz-clock').forEach(card=>{
    const zone=card.dataset.zone,time=card.querySelector('time');time.dateTime=now.toISOString();time.textContent=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now);
    card.querySelector('.tz-date').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:zone,weekday:'short',day:'numeric',month:'short'}).format(now)+' / '+offsetLabel(utcMinutes(zone,now));
  });}
  function render(){
    const now=new Date(),next=JSON.stringify(groups(selected,now));
    if(signature!==next){signature=next;build(all,false);} update(all,now);
    floatPanel.hidden=!floating || !options.floating;
    if(floating&&options.floating){if(floatSignature!==next){floatSignature=next;build(floatList,true);}update(floatList,now);}
  }
  add.addEventListener('click',()=>{if(select.value===''){status.textContent='Choose a country first.';return;}const id=Number(select.value);if(!selected.includes(id))selected.push(id);persist();render();});
  close.addEventListener('click',()=>{floating=false;if(floatingToggle)floatingToggle.checked=false;persist();render();});
  render();timer=setInterval(render,1000);
  return {destroy(){clearInterval(timer);floatPanel.remove();root.replaceChildren();},render};
}
global.TQTimezones={countries,utcMinutes,offsetLabel,groups,mount};
})(typeof window!=='undefined'?window:globalThis);
