import React from 'react';
import {createRoot} from 'react-dom/client';
import './style.css';
(import.meta.env.MODE==='public'?import('./PublicApp.jsx'):import('./LiveApp.jsx')).then(({default:App})=>{
 createRoot(document.getElementById('root')).render(<App/>);
});
