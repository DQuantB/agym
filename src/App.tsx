import { useEffect } from 'react';
import { BriefingView } from './components/BriefingView';
import { DataPanel } from './components/DataPanel';
import { EventTimeline } from './components/EventTimeline';
import { LogInput } from './components/LogInput';
import { ParsePreview } from './components/ParsePreview';
import { useAgymStore } from './state/store';
import type { Tab } from './domain/types';
const tabs: {id:Tab; label:string}[] = [{id:'log',label:'Log'}, {id:'timeline',label:'Timeline'}, {id:'briefing',label:'Briefing'}, {id:'data',label:'Data'}];
export default function App(){ const {activeTab,lastMessage}=useAgymStore(s=>s.ui); const setTab=useAgymStore(s=>s.setTab); const hydrate=useAgymStore(s=>s.hydrate); useEffect(()=>{void hydrate();},[hydrate]); return <main><header className="hero"><div className="poster-word">AGYM</div><nav>{tabs.map(t=><button key={t.id} className={activeTab===t.id?'active':''} onClick={()=>setTab(t.id)}>{t.label}</button>)}</nav></header>{lastMessage && <div className="toast">{lastMessage}</div>}{activeTab==='log' && <><LogInput/><ParsePreview/></>}{activeTab==='timeline' && <EventTimeline/>}{activeTab==='briefing' && <BriefingView/>}{activeTab==='data' && <DataPanel/>}</main> }
