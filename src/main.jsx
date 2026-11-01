import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
(import.meta.env.MODE==='public'?import('./PublicApp.jsx'):import('./LiveApp.jsx')).then(({default:App})=>{
 const LiveTestnet=React.lazy(()=>import('./LiveTestnet.jsx'));
 function Root(){
  const [testnet,setTestnet]=useState(location.hash.startsWith('#testnet'));
  useEffect(()=>{const change=()=>setTestnet(location.hash.startsWith('#testnet'));addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change);},[]);
  return import.meta.env.MODE!=='public'&&testnet?<React.Suspense fallback={<p role="status">Loading testnet wallets…</p>}><LiveTestnet onBack={()=>{location.hash='';setTestnet(false);}}/></React.Suspense>:<App/>;
 }
 createRoot(document.getElementById('root')).render(<Root/>);
});
