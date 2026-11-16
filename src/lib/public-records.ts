import { leadInputSchema, normalize, type LeadInput } from "./domain";
import { safeFetch } from "./safe-fetch";
import { z } from "zod";

type RecordRow=Record<string,string>;
export const PUBLIC_DATASETS={
  trades:{host:"https://data.cityofnewyork.us",id:"t8hj-ruu2",name:"NYC DOB business license records",city:"license_business_city",state:"business_state",company:"business_name"},
  legal:{host:"https://data.ny.gov",id:"eqw2-r5nb",name:"NYS attorney business offices",city:"city",state:"state",company:"company_name"},
  property:{host:"https://data.ny.gov",id:"yg7h-zjbf",name:"NYS real estate business licenses",city:"business_city",state:"business_state",company:"business_name"},
} as const;
type Dataset=keyof typeof PUBLIC_DATASETS;
export function publicRecordQuery(kind:Dataset,city:string,industry:string,limit:number) {
  const source=PUBLIC_DATASETS[kind];
  const quote=(value:string)=>`'${value.replace(/'/g,"''")}'`;
  const cities=normalize(city)==="newyork"||normalize(city)==="nyc"?["NEW YORK","NEW YORK CITY","MANHATTAN","NYC"]:[city.trim().toUpperCase()];
  const conditions=[`${source.state}='NY'`,`${source.company} IS NOT NULL`];
  if(city.trim())conditions.push(`upper(${source.city}) IN (${cities.map(quote).join(",")})`);
  if(kind==="trades"){
    conditions.push("license_status='ACTIVE'");
    if(industry==="Plumbing")conditions.push("license_type='MASTER PLUMBER'");
    else if(industry==="Electrical")conditions.push("license_type IN ('ELECTRICAL CONTRACTOR','ELECTRICAL FIRM')");
    else if(industry==="Home renovation")conditions.push("license_type='GENERAL CONTRACTOR'");
    else conditions.push("license_type IN ('MASTER PLUMBER','ELECTRICAL CONTRACTOR','ELECTRICAL FIRM','GENERAL CONTRACTOR')");
  }
  return new URLSearchParams({$where:conditions.join(" AND "),$limit:String(limit),$order:kind==="legal"?"registration_number":kind==="trades"?"license_sl_no":"license_number"});
}
export function mapPublicRecords(kind:Dataset,rows:RecordRow[]):LeadInput[] {
  const source=PUBLIC_DATASETS[kind],leads:LeadInput[]=[];
  for(const row of rows){
    const name=row[source.company]?.trim();if(!name)continue;
    if(kind==="trades"&&row.license_status!=="ACTIVE")continue;
    if(kind==="legal"&&row.status&&/deceas|suspend|disbar|resign|retir|delinq/i.test(row.status))continue;
    const rawEmail=(row.business_email||"").split(/[;,]/)[0].trim().toLowerCase();
    const id=kind==="trades"?row.license_sl_no:kind==="legal"?row.registration_number:row.license_number;
    const industry=kind==="legal"?"Legal":kind==="property"?"Real estate":row.license_type?.includes("PLUMB")?"Plumbing":row.license_type?.includes("ELECTRICAL")?"Electrical":"Home renovation";
    const parsed=leadInputSchema.safeParse({name,industry,city:row[source.city],state:row[source.state],address:kind==="trades"?[row.business_house_number,row.business_street_name].filter(Boolean).join(" "):kind==="legal"?row.street_1||"":row.business_address_1||"",email:z.email().safeParse(rawEmail).success?rawEmail:"",phone:(row.business_phone_number||row.phone_number||"").slice(0,50),sourceName:source.name,sourceUrl:`${source.host}/d/${source.id}`,sourceRecordId:id||"",notes:`Published business/practice details from an official public dataset. Registry category: ${row.license_type||"Attorney business office"}. License status must be checked at its authority before relying on it; contact accuracy, marketing eligibility, website and budget need review.`});
    if(parsed.success)leads.push(parsed.data);
  }
  return leads;
}
export async function collectPublicRecords(input:{state:string;city:string;industry:string;limit:number}) {
  if(input.state!=="NY")throw new Error("This official-record connector currently covers New York. Use OpenStreetMap, an approved directory or a licensed CSV for other states.");
  const kinds:Dataset[]=input.industry==="Legal"?["legal"]:input.industry==="Real estate"?["property"]:["Plumbing","Electrical","Home renovation"].includes(input.industry)?["trades"]:input.industry==="all"?["trades","legal","property"]:[];
  if(!kinds.length)throw new Error("This source covers plumbers, electrical businesses, contractors, legal offices and real estate businesses. Choose one of those or All local businesses.");
  const leads:LeadInput[]=[];const warnings:string[]=[];
  for(const kind of kinds){const source=PUBLIC_DATASETS[kind],url=new URL(`${source.host}/resource/${source.id}.json`);url.search=publicRecordQuery(kind,input.city,input.industry,Math.ceil(input.limit/kinds.length)).toString();
    try{const response=await safeFetch(url.href,4_000_000,0,url.origin,{timeoutMs:20000});if(response.status!==200)throw new Error(`HTTP ${response.status}`);const rows=JSON.parse(response.text);if(!Array.isArray(rows))throw new Error("Unexpected public dataset response");leads.push(...mapPublicRecords(kind,rows));}catch(error){warnings.push(`${source.name}: ${error instanceof Error?error.message:"unavailable"}`);}
  }
  if(!leads.length&&warnings.length)throw new Error(warnings.join("; "));
  return{leads:leads.slice(0,input.limit),partial:true,message:`${leads.length} business/practice records from bounded New York public datasets. Company records may collapse duplicate licenses; this is partial coverage. ${warnings.length?`Some datasets unavailable: ${warnings.join("; ")}`:"Websites and missing contact fields require separate research."}`};
}
