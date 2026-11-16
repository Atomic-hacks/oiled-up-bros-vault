import type { CSSProperties } from 'react'
export function Icon({name,size=20,style}:{name:string,size?:number,style?:CSSProperties}) {
 const paths:Record<string, React.ReactNode>={
 home:<><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/></>,
 activity:<><path d="M3 12h4l3-8 4 16 3-8h4"/></>,plus:<path d="M12 5v14M5 12h14"/>,
 goal:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
 user:<><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>,up:<path d="M7 17 17 7M7 7h10v10"/>,down:<path d="M12 4v16m-6-6 6 6 6-6"/>,
 bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,chevron:<path d="m9 5 7 7-7 7"/>,check:<path d="m5 12 4 4 10-10"/>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></>,
 shield:<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,upload:<><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/></>,close:<path d="m6 6 12 12M6 18 18 6"/>,file:<><path d="M14 3H5v18h14V8Zm0 0v5h5M8 12h8m-8 4h5"/></>,search:<><circle cx="10" cy="10" r="7"/><path d="m16 16 5 5"/></>,sun:<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,logout:<><path d="M9 4H4v16h5m4-12 4 4-4 4m-5-4h13"/></>,wallet:<><rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 8h18m-5 5h5v4h-5Z"/></>,chart:<><path d="M4 3v18h17M8 16v-5m5 5V7m5 9V4"/></>,spark:<><path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8Z"/></>,eye:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,lock:<><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></>}
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">{paths[name]||paths.spark}</svg>
}
