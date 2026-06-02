
const API = "https://script.google.com/macros/s/AKfycbwTBGvrKBRdbGi11kSu1XQCiGfTUm8Gk0NgeC7Hu9ygdAjswjVyfR5uEAN2dfJyEUXl/exec";
let allLeads = [];
let editingLead = null;
let savingInline = false;
const STATUS_CLASS = {
  "⏳ Sin contactar": "sin",
  "✅ Interesado": "interesado",
  "📞 Recontactar": "recontactar",
  "❌ No contesta": "nocontesta",
  "🚫 No interesado": "noint",
  "🤝 Cerrado": "cerrado",
};
const STATUS_OPTIONS = ["⏳ Sin contactar","✅ Interesado","📞 Recontactar","❌ No contesta","🚫 No interesado","🤝 Cerrado"];
const PRIORITY_OPTIONS = ["🔴 Alta","🟡 Media","🟢 Baja"];
function esc(s){return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;");}
function escAttr(s){return esc(s).replace(/'/g,"&#39;");}
function parseDateAR(value){
  if(!value) return null;
  const str=String(value).trim();
  const match=str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if(match){let [,d,m,y]=match; d=Number(d); m=Number(m); y=Number(y); if(y<100) y+=2000; const date=new Date(y,m-1,d); if(!Number.isNaN(date.getTime())) return date;}
  const isoLike=str.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if(isoLike){
    const [,y,m,d]=isoLike; const year=Number(y); const month=Number(m); const day=Number(d); const normal=new Date(str);
    if(!Number.isNaN(normal.getTime())){
      const today=new Date(); today.setHours(0,0,0,0); const futureLimit=new Date(today); futureLimit.setDate(futureLimit.getDate()+45);
      if(month<=12 && day<=12){ const swapped=new Date(year,day-1,month); if(!Number.isNaN(swapped.getTime()) && normal>futureLimit && swapped<=futureLimit) return swapped; }
      return normal;
    }
  }
  const iso=new Date(str); if(!Number.isNaN(iso.getTime())) return iso; return null;
}
function formatDateAR(date){const dd=String(date.getDate()).padStart(2,"0"); const mm=String(date.getMonth()+1).padStart(2,"0"); const yyyy=date.getFullYear(); return `${dd}/${mm}/${yyyy}`;}
function displayDate(value){const parsed=parseDateAR(value); return parsed ? formatDateAR(parsed) : String(value || "");}
function toInputDate(value){const parsed=parseDateAR(value); if(!parsed) return ""; const dd=String(parsed.getDate()).padStart(2,"0"); const mm=String(parsed.getMonth()+1).padStart(2,"0"); const yyyy=parsed.getFullYear(); return `${yyyy}-${mm}-${dd}`;}
function fromInputDate(value){const str=String(value || "").trim(); if(!str) return ""; const match=str.match(/^(\d{4})-(\d{2})-(\d{2})$/); if(!match) return str; const [,yyyy,mm,dd]=match; return `${dd}/${mm}/${yyyy}`;}
function normalizeLead(lead){return {...lead,Nombre:lead.Nombre ?? lead.nombre ?? "",Auto:lead.Auto ?? lead.auto ?? "",Telefono:lead.Telefono ?? lead.telefono ?? "",Estado:lead.Estado ?? lead.estado ?? "",Prioridad:lead.Prioridad ?? lead.prioridad ?? "",Notas:lead.Notas ?? lead.notas ?? "",FechaLead:lead.FechaLead ?? lead["Fecha lead"] ?? lead.fechaLead ?? lead.fecha_lead ?? "",FechaContacto:lead.FechaContacto ?? lead["Últ. contacto"] ?? lead["Ult. contacto"] ?? lead.fechaContacto ?? lead.fecha_contacto ?? "",_row:lead._row ?? lead.row ?? lead.Row ?? 0};}
function sortLeads(leads){return [...leads].sort((a,b)=>{const da=parseDateAR(a.FechaLead); const db=parseDateAR(b.FechaLead); if(da&&db) return db-da; if(db) return 1; if(da) return -1; return (a._row||0)-(b._row||0);});}
function api(params){return new Promise((resolve,reject)=>{const callbackName="jsonp_cb_"+Date.now()+"_"+Math.floor(Math.random()*10000); const script=document.createElement("script"); const timeout=setTimeout(()=>{cleanup(); reject(new Error("Timeout consultando Apps Script"));},15000); function cleanup(){clearTimeout(timeout); try{delete window[callbackName];}catch(_){} if(script.parentNode) script.parentNode.removeChild(script);} params.callback=callbackName; params._ts=Date.now(); const url=API+"?"+new URLSearchParams(params).toString(); window[callbackName]=(data)=>{cleanup(); resolve(data);}; script.onerror=()=>{cleanup(); reject(new Error("Error cargando API"));}; script.src=url; document.body.appendChild(script);});}
async function loadData(){const tb=document.getElementById("tableBody"); tb.innerHTML=`<tr><td colspan="10"><div class="loading"><div class="spinner"></div>Cargando leads...</div></td></tr>`; try{const data=await api({action:"getAll"}); if(data && data.ok===false) throw new Error(data.error || "Error desconocido"); allLeads=Array.isArray(data) ? sortLeads(data.map(normalizeLead)) : []; updateStats(); renderTable();}catch(e){tb.innerHTML=`<tr><td colspan="10"><div class="empty">Error al cargar leads: ${esc(e.message || "desconocido")}</div></td></tr>`;}}
function updateStats(){const count=(st)=>allLeads.filter(l=>l.Estado===st).length; document.getElementById("s-total").textContent=allLeads.length; document.getElementById("s-sin").textContent=count("⏳ Sin contactar"); document.getElementById("s-int").textContent=count("✅ Interesado"); document.getElementById("s-rec").textContent=count("📞 Recontactar"); document.getElementById("s-cer").textContent=count("🤝 Cerrado");}
function renderTable(){
  const q=document.getElementById("searchInput").value.trim().toLowerCase();
  const est=document.getElementById("filterEstado").value;
  const prio=document.getElementById("filterPrio").value;
  const fechaOrden=document.getElementById("filterFechaOrden").value || "desc";
  const leads=allLeads.filter(l=>{const matchQ=!q || [l.Nombre,l.Auto,l.Telefono,l.Notas].some(v=>String(v||"").toLowerCase().includes(q)); const matchE=!est || l.Estado===est; const matchP=!prio || l.Prioridad===prio; return matchQ && matchE && matchP;}).sort((a,b)=>{const da=parseDateAR(a.FechaLead); const db=parseDateAR(b.FechaLead); if(da&&db){const diff=fechaOrden==="asc" ? da-db : db-da; if(diff!==0) return diff;} else if(db){return fechaOrden==="asc" ? -1 : 1;} else if(da){return fechaOrden==="asc" ? 1 : -1;} return fechaOrden==="asc" ? (b._row||0)-(a._row||0) : (a._row||0)-(b._row||0);});
  const tb=document.getElementById("tableBody");
  if(!leads.length){tb.innerHTML=`<tr><td colspan="10"><div class="empty">Sin resultados</div></td></tr>`; return;}
  tb.innerHTML=leads.map((l,i)=>{const currentStatus=l.Estado || "⏳ Sin contactar"; const currentPriority=l.Prioridad || "🟡 Media"; const sc=STATUS_CLASS[currentStatus] || "sin"; const statusOptions=STATUS_OPTIONS.map(st=>`<option value="${escAttr(st)}" ${currentStatus===st ? "selected" : ""}>${esc(st)}</option>`).join(""); const priorityOptions=PRIORITY_OPTIONS.map(pr=>`<option value="${escAttr(pr)}" ${currentPriority===pr ? "selected" : ""}>${esc(pr)}</option>`).join(""); return `
    <tr>
      <td style="color:var(--text3);font-family:'DM Mono',monospace;font-size:12px">${i+1}</td>
      <td><div class="name">${esc(l.Nombre || "")}</div></td>
      <td class="auto-cell hide-mobile">${esc(l.Auto || "")}</td>
      <td class="phone">${esc(l.Telefono || "")}</td>
      <td class="inline-cell"><select class="inline-select badge ${sc}" onchange="inlineUpdate(${Number(l._row)||0}, 5, this, 'estado')">${statusOptions}</select></td>
      <td class="date-cell hide-mobile">${esc(displayDate(l.FechaLead || ""))}</td>
      <td class="hide-mobile inline-cell"><input class="inline-input date-cell" type="date" value="${escAttr(toInputDate(l.FechaContacto || ""))}" data-prev="${escAttr(displayDate(l.FechaContacto || ""))}" onchange="inlineUpdate(${Number(l._row)||0}, 6, this, 'fecha')"></td>
      <td class="hide-mobile inline-cell notes-inline"><textarea class="inline-textarea" placeholder="Agregar nota..." data-prev="${escAttr(l.Notas || "")}" title="${escAttr(l.Notas || "")}" onblur="inlineUpdate(${Number(l._row)||0}, 7, this, 'notas')" onkeydown="handleInlineTextareaKey(event, ${Number(l._row)||0}, 7, this, 'notas')">${esc(l.Notas || "")}</textarea></td>
      <td class="inline-cell"><select class="inline-select prio" onchange="inlineUpdate(${Number(l._row)||0}, 8, this, 'prioridad')">${priorityOptions}</select></td>
      <td><button class="action-btn" onclick="openEdit(${Number(l._row)||0})">Editar</button></td>
    </tr>`;}).join("");
}
function handleInlineTextareaKey(event,row,col,el,kind){if((event.ctrlKey||event.metaKey)&&event.key==="Enter"){event.preventDefault(); el.blur(); return;} if(event.key==="Escape"){el.value=el.dataset.prev||""; el.blur();}}
async function inlineUpdate(row,col,el,kind){if(!el || savingInline) return; const rawValue="value" in el ? el.value : el.textContent; const value=String(rawValue || "").trim(); const prev=el.dataset.prev || ""; let normalizedValue=value; if(kind==="fecha" && value){ if(el.type==="date"){ normalizedValue=value; } else { const parsed=parseDateAR(value); if(!parsed){ toast("Us� formato dd/mm/aaaa"); el.value=prev; return; } normalizedValue=formatDateAR(parsed); el.value=normalizedValue; } } else if(kind==="fecha"){ normalizedValue=""; } if(normalizedValue===prev) return; const lead=allLeads.find(l=>Number(l._row)===Number(row)); if(!lead) return; const updates=[{col,value:normalizedValue}]; if(kind==="estado" && !lead.FechaContacto){updates.push({col:6,value:formatDateAR(new Date())});} savingInline=true; el.disabled=true; el.classList.add("saving"); try{for(const item of updates){const res=await api({action:"update",row,col:item.col,value:item.value}); if(res && res.ok===false) throw new Error(res.error || "No se pudo guardar");} await loadData(); toast("Cambio guardado ?");}catch(e){el.value=kind==="fecha" && el.type==="date" ? toInputDate(prev) : prev; toast("Error al guardar cambio"); console.error(e);}finally{savingInline=false; el.disabled=false; el.classList.remove("saving");}}
function toggleFiltersMenu(){document.getElementById("filtersPanel").classList.toggle("open");}
function closeFiltersMenu(){document.getElementById("filtersPanel").classList.remove("open");}
function clearFilters(){document.getElementById("searchInput").value=""; document.getElementById("filterEstado").value=""; document.getElementById("filterPrio").value=""; document.getElementById("filterFechaOrden").value="desc"; renderTable();}
function refreshData(){closeFiltersMenu(); loadData();}
function openAddModal(){["f-nombre","f-tel","f-auto","f-notas"].forEach(id=>{document.getElementById(id).value="";}); document.getElementById("f-estado").value="⏳ Sin contactar"; document.getElementById("f-prio").value="🟡 Media"; document.getElementById("f-fechalead").value=toInputDate(formatDateAR(new Date())); document.getElementById("addModal").classList.add("open");}
async function addLead(){const nombre=document.getElementById("f-nombre").value.trim(); const auto=document.getElementById("f-auto").value.trim(); const telefono=document.getElementById("f-tel").value.trim(); const fechaLeadInput=document.getElementById("f-fechalead").value; const fechaLead=fechaLeadInput ? fromInputDate(fechaLeadInput) : ""; if(!nombre){toast("Falta el nombre"); document.getElementById("f-nombre").focus(); return;} if(!auto){toast("Falta el auto/publicaci�n"); document.getElementById("f-auto").focus(); return;} const params={action:"add",Nombre:nombre,Auto:auto,Telefono:telefono,FechaLead:fechaLeadInput || fechaLead,Estado:document.getElementById("f-estado").value,Prioridad:document.getElementById("f-prio").value,Notas:document.getElementById("f-notas").value.trim()}; try{closeModal("addModal"); toast("Guardando..."); const res=await api(params); if(res && res.ok===false) throw new Error(res.error || "No se pudo guardar"); await loadData(); if(fechaLead){ const createdLead=[...allLeads].filter(l=>String(l.Nombre||"").trim()===nombre && String(l.Auto||"").trim()===auto && String(l.Telefono||"").trim()===telefono).sort((a,b)=>(a._row||0)-(b._row||0))[0]; if(createdLead && displayDate(createdLead.FechaLead)!==fechaLead){ const updateRes=await api({action:"update",row:createdLead._row,col:4,value:fechaLeadInput || fechaLead}); if(updateRes && updateRes.ok===false) throw new Error(updateRes.error || "No se pudo guardar la fecha del lead"); await loadData(); }} toast("Lead agregado ?");}catch(e){toast("Error al guardar"); console.error(e);}}
function openEdit(row){const lead=allLeads.find(l=>Number(l._row)===Number(row)); if(!lead) return; editingLead=lead; document.getElementById("editModalTitle").textContent=lead.Nombre || "Editar lead"; document.getElementById("e-nombre").value=lead.Nombre || ""; document.getElementById("e-tel").value=lead.Telefono || ""; document.getElementById("e-auto").value=lead.Auto || ""; document.getElementById("e-estado").value=lead.Estado || "⏳ Sin contactar"; document.getElementById("e-prio").value=lead.Prioridad || "🟡 Media"; document.getElementById("e-fechacontacto").value=toInputDate(lead.FechaContacto || ""); document.getElementById("e-fechalead").value=toInputDate(lead.FechaLead || ""); document.getElementById("e-notas").value=lead.Notas || ""; document.getElementById("editModal").classList.add("open");}
async function saveEdit(){if(!editingLead) return; const row=Number(editingLead._row); const nombre=document.getElementById("e-nombre").value.trim(); const auto=document.getElementById("e-auto").value.trim(); if(!nombre){toast("Falta el nombre"); document.getElementById("e-nombre").focus(); return;} if(!auto){toast("Falta el auto/publicaci�n"); document.getElementById("e-auto").focus(); return;} const fields=[{col:1,id:"e-nombre"},{col:2,id:"e-auto"},{col:3,id:"e-tel"},{col:4,id:"e-fechalead"},{col:5,id:"e-estado"},{col:6,id:"e-fechacontacto"},{col:7,id:"e-notas"},{col:8,id:"e-prio"}]; try{closeModal("editModal"); toast("Guardando..."); for(const field of fields){let value=document.getElementById(field.id).value; if(field.id==="e-fechalead" || field.id==="e-fechacontacto") value=value || ""; const res=await api({action:"update",row,col:field.col,value}); if(res && res.ok===false) throw new Error(res.error || `Fall� columna ${field.col}`);} await loadData(); toast("Cambios guardados ?");}catch(e){toast("Error al guardar cambios"); console.error(e);}}
function closeModal(id){const el=document.getElementById(id); if(el) el.classList.remove("open");}
function toast(msg){const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove("show"),2200);}
document.addEventListener("click",(e)=>{if(e.target.classList && e.target.classList.contains("modal-overlay")){e.target.classList.remove("open");} const menu=document.querySelector(".toolbar-menu"); if(menu && !menu.contains(e.target)) closeFiltersMenu();});
loadData();
