"use client";
import { useState } from "react";
export function PageSize({value,onChange}:{value:string;onChange:(value:string)=>void}){
  const common=["25","50","100","250","500","1000","all"],isCustom=!common.includes(value),[custom,setCustom]=useState("");
  return <div className="page-size-control"><label>Rows per page<select aria-label="Rows per page" value={isCustom?"custom":value} onChange={event=>event.target.value==="custom"?setCustom(value):onChange(event.target.value)}>{common.map(size=><option key={size} value={size}>{size==="all"?"All matching leads":size}</option>)}<option value="custom">Custom…</option></select></label>{custom||isCustom?<form onSubmit={event=>{event.preventDefault();if(Number(custom)>0){onChange(String(Math.min(10000,Math.floor(Number(custom)))));setCustom("");}}}><input aria-label="Custom rows per page" type="number" min={1} max={10000} required value={custom||value} onChange={event=>setCustom(event.target.value)}/><button className="text-button">Apply</button></form>:null}{value==="all"?<span>Large lists may take longer to render.</span>:null}</div>;
}
