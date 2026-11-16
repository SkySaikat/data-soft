import { z } from "zod";
import { repository, type Repository } from "./db";
import { collectOsm } from "./business-discovery";
import { collectDirectory, collectNppes } from "./collection";
import { researchWebsite } from "./website-research";
import type { WorkJob } from "./domain";

export const collectionSchema=z.object({source:z.enum(["osm","nppes","directory"]),state:z.string().length(2),city:z.string().trim().max(120).default(""),industry:z.string().max(80).default("all"),radiusKm:z.coerce.number().min(1).max(30).default(10),limit:z.coerce.number().int().min(1).max(250).default(100),keyword:z.string().max(100).default(""),url:z.string().max(2048).default(""),sourceName:z.string().min(2).max(160).default("Approved directory"),permissionConfirmed:z.boolean().default(false),enrich:z.boolean().default(true)}).refine(v=>v.source!=="osm"||v.city.length>1,{message:"Enter a city for local business discovery."});
export const enrichmentSchema=z.object({leadIds:z.array(z.string().uuid()).min(1).max(1000)});

export async function processJob(job:WorkJob,repo:Repository=repository()) {
  let ids:string[]=[],summary:Record<string,unknown>={};
  if(job.kind==="collect"){
    const input=collectionSchema.parse(job.payload);repo.updateJob(job.id,{message:`Searching ${input.industry==='all'?'local businesses':input.industry} in ${input.city||input.state}…`});
    const result=input.source==="osm"?await collectOsm(input,repo):input.source==="nppes"?await collectNppes(input.state,input.city,input.keyword):await collectDirectory(input);
    const stored=repo.upsertMany(result.leads,"live");ids=input.enrich?[...new Set(stored.ids)]:[];
    repo.incrementSource(input.source,stored.imported);
    repo.recordRun({source:input.source==="osm"?"OpenStreetMap contributors (ODbL 1.0)":input.source==="nppes"?"CMS NPPES":input.sourceName,state:input.state,city:input.city,status:result.partial?"partial":"completed",imported:stored.imported,updated:stored.updated,message:result.message});
    summary={imported:stored.imported,updated:stored.updated,discoveryMessage:result.message};
  }else if(job.kind==="enrich"){ids=enrichmentSchema.parse(job.payload).leadIds;}
  else throw new Error("Unsupported collection job type.");
  let enriched=0,failed=0;const failures:{leadId:string;name:string;message:string}[]=[];
  repo.updateJob(job.id,{total:ids.length,progress:0,message:ids.length?`Researching ${ids.length} business websites…` : "Discovery complete."});
  for(let i=0;i<ids.length;i++){
    const lead=repo.getLead(ids[i],"live");
    if(!lead){failed++;continue;}
    repo.updateJob(job.id,{progress:i,message:`${i+1}/${ids.length}: ${lead.name}`});
    try{await researchWebsite(lead,repo);enriched++;}catch(error){failed++;failures.push({leadId:lead.id,name:lead.name,message:error instanceof Error?error.message:"Research failed"});}
    repo.updateJob(job.id,{progress:i+1,result:{...summary,enriched,failed,failures:failures.slice(-50)}});
  }
  repo.updateJob(job.id,{status:failed?"partial":"completed",progress:ids.length,total:ids.length,message:`${summary.imported??0} new businesses; ${enriched} websites researched${failed?`; ${failed} need review or configuration`:""}.`,result:{...summary,enriched,failed,failures:failures.slice(-50)}});
}
