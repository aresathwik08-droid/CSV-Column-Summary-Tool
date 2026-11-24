const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let cur=null,sum=null,tab='overview',pg=1;
function toast(m,bad){const t=$('#toast');t.textContent=m;t.style.background=bad?'#dc2626':'#16a34a';t.style.display='block';setTimeout(()=>t.style.display='none',3500)}
async function api(u,o){const r=await fetch(u,o),j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||r.statusText);return j}
async function loadList(){const l=await api('/api/datasets');$('#list').innerHTML=l.map(d=>`<div class="ds ${d.id==cur?'sel':''}" onclick="pick('${d.id}')"><div>${esc(d.name)}<small>${d.rows} rows · ${d.cols} cols</small></div><button class="alt" title="Delete" onclick="event.stopPropagation();del('${d.id}')">✕</button></div>`).join('')||'<small>No datasets yet</small>';return l}
async function pick(id){cur=id;try{sum=await api('/api/datasets/'+id);tab='overview';pg=1;render();loadList()}catch(e){toast(e.message,1)}}
async function del(id){if(!confirm('Delete this dataset?'))return;await api('/api/datasets/'+id,{method:'DELETE'});if(cur==id){cur=null;$('#main').innerHTML='<div class="card">Select or upload a dataset.</div>'}loadList()}
function upload(f){if(!f)return;if(f.size>5*1048576)return toast('File too large (max 5 MB)',1);
 const r=new FileReader();r.onload=async()=>{try{const j=await api('/api/datasets',{method:'POST',body:JSON.stringify({name:f.name,content:r.result})});toast('Imported'+(j.errors?` with ${j.errors} row issue(s) logged`:' successfully'));await pick(j.id)}catch(e){toast(e.message,1)}};r.readAsText(f)}
$('#drop').onclick=()=>$('#file').click();$('#file').onchange=e=>{upload(e.target.files[0]);e.target.value=''};
$('#drop').ondragover=e=>{e.preventDefault();$('#drop').classList.add('on')};$('#drop').ondragleave=()=>$('#drop').classList.remove('on');
$('#drop').ondrop=e=>{e.preventDefault();$('#drop').classList.remove('on');upload(e.dataTransfer.files[0])};
function render(){const T=['overview','columns','records','charts','log'];
 $('#main').innerHTML=`<div class="tabs">${T.map(t=>`<button class="${t==tab?'on':''}" onclick="tab='${t}';render()">${{overview:'Overview',columns:'Column Summary',records:'Search Records',charts:'Charts',log:'Import Log ('+sum.errors.length+')'}[t]}</button>`).join('')}
 <span style="flex:1"></span>${['md','txt','csv','json'].map(f=>`<a href="/api/datasets/${cur}/export?fmt=${f}"><button class="alt">⬇ ${f.toUpperCase()}</button></a>`).join('')}</div><div id="tabbody"></div>`;
 ({overview,columns,records,charts,log})[tab]()}
function overview(){const s=sum,k=(v,l)=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
 $('#tabbody').innerHTML=`<div class="card"><h3 style="margin-top:0">Executive summary — ${esc(s.name)}</h3><div class="kpis">${k(s.rows,'Rows')}${k(s.cols,'Columns')}${k(s.numeric_cols,'Numeric columns')}${k(s.missing_total,'Missing cells')}${k(s.completeness+'%','Completeness')}${k(s.duplicates,'Duplicate rows')}</div></div>
 <div class="card"><b>⚠ Threshold warnings</b><div style="margin-top:8px">${s.warnings.map(w=>`<span class="b w">${esc(w)}</span>`).join('')||'<span class="ok">✔ No issues detected</span>'}</div></div>`}
function columns(){const f=v=>v===undefined?'<span class="miss">–</span>':v;
 $('#tabbody').innerHTML=`<div class="card sc"><table><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Min</th><th>Max</th><th>Mean</th><th>Median</th><th>Std</th><th>Flags</th></tr>${sum.columns.map(c=>{const s=c.stats||{};return`<tr><td><b>${esc(c.name)}</b></td><td><span class="b">${c.type}</span></td><td>${c.missing} (${c.missing_pct}%)</td><td>${c.unique}</td><td>${f(s.min)}</td><td>${f(s.max)}</td><td>${f(s.mean)}</td><td>${f(s.median)}</td><td>${f(s.std)}</td><td>${c.warnings.map(w=>`<span class="b w">${esc(w)}</span>`).join('')}</td></tr>`}).join('')}</table></div>`}
async function records(){$('#tabbody').innerHTML=`<div class="card"><div class="row"><input id="q" type="text" placeholder="Keyword…" onkeydown="if(event.key=='Enter'){pg=1;runSearch()}"><select id="col"><option value="">All columns</option>${sum.columns.map(c=>`<option>${esc(c.name)}</option>`).join('')}</select><label><input type="checkbox" id="ms"> only rows with missing values</label><button onclick="pg=1;runSearch()">Search</button></div><div id="res"></div></div>`;runSearch()}
async function runSearch(){try{const r=await api(`/api/datasets/${cur}/search?q=${encodeURIComponent($('#q').value)}&col=${encodeURIComponent($('#col').value)}&missing=${$('#ms').checked?1:0}&page=${pg}`);pg=r.page;
 $('#res').innerHTML=`<p>${r.total} matching row(s)</p><div class="sc"><table><tr><th>#</th>${r.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr>${r.rows.map(x=>`<tr>${x.map(v=>`<td>${v===''?'<span class="miss">empty</span>':esc(v)}</td>`).join('')}</tr>`).join('')}</table></div>
 <div class="row" style="margin-top:10px"><button class="alt" ${pg<=1?'disabled':''} onclick="pg--;runSearch()">◀ Prev</button>Page ${r.page} / ${r.pages}<button class="alt" ${pg>=r.pages?'disabled':''} onclick="pg++;runSearch()">Next ▶</button></div>`}catch(e){toast(e.message,1)}}
function charts(){$('#tabbody').innerHTML=`<div class="card"><div class="row"><select id="cc" onchange="drawChart()">${sum.columns.map(c=>`<option>${esc(c.name)}</option>`).join('')}</select></div><div id="chart"></div></div>`;drawChart()}
function drawChart(){const n=$('#cc').value,c=sum.columns.find(x=>x.name==n),box=$('#chart');
 box.innerHTML=`<img style="max-width:100%" src="/api/datasets/${cur}/chart?col=${encodeURIComponent(n)}">`;
 box.firstChild.onerror=()=>{ // fallback when matplotlib is unavailable
  const d=c.stats?c.stats.hist.map((v,i)=>[(c.stats.hist_range[0]+(c.stats.hist_range[1]-c.stats.hist_range[0])*i/10).toFixed(1),v]):(c.top||[]);const m=Math.max(1,...d.map(x=>x[1]));
  box.innerHTML=`<p><small>Built-in chart (install matplotlib for PNG charts)</small></p>`+d.map(([k,v])=>`<div class="row" style="margin:3px 0;flex-wrap:nowrap"><span style="width:110px;overflow:hidden">${esc(k)}</span><div class="bar" style="width:${v/m*60}%"></div> ${v}</div>`).join('')}}
function log(){$('#tabbody').innerHTML=`<div class="card">${sum.errors.length?`<table><tr><th>Line</th><th>Issue</th></tr>${sum.errors.map(e=>`<tr><td>${e.row}</td><td>${esc(e.issue)}</td></tr>`).join('')}</table>`:'<span class="ok">✔ Every row imported cleanly.</span>'}</div>`}
loadList().then(l=>l.length&&pick(l[0].id));
