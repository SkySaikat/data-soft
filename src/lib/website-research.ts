import { load } from "cheerio";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import robotsParser from "robots-parser";
import { z } from "zod";
import type { Lead } from "./domain";
import { repository, type Repository } from "./db";
import { safeFetch, validateRemoteUrl } from "./safe-fetch";

const BLOCKED_HOST=/(^|\.)(google\.[a-z.]+|googleapis\.com|facebook\.com|instagram\.com|linkedin\.com|yelp\.com|bbb\.org|yellowpages\.com|maps\.apple\.com)$/i;
export type ContactResult={emails:{value:string;sourceUrl:string}[];phones:{value:string;sourceUrl:string;e164:string}[];links:string[]};
export function extractPublicContacts(html:string,url:string):ContactResult {
  const $=load(html),emails=new Set<string>(),phones=new Map<string,{value:string;sourceUrl:string;e164:string}>();
  function addEmail(raw:string){const value=raw.replace(/^mailto:/i,"").split("?")[0].replace(/[.,;:)>\]]+$/,"").trim().toLowerCase();if(z.email().safeParse(value).success&&!/\.(png|jpg|jpeg|webp|svg|gif|woff|ico|avif)$/.test(value)&&!/@(example\.(com|org|net)|sentry\.io)$/i.test(value))emails.add(value);}
  function addPhone(raw:string){const phone=parsePhoneNumberFromString(raw.replace(/^tel:/i,""),"US");if(phone?.isValid())phones.set(phone.number,{value:phone.formatInternational()+(phone.ext?` ext ${phone.ext}`:""),e164:phone.number,sourceUrl:url});}
  $("a[href^='mailto:']").each((_,e)=>{try{decodeURIComponent($(e).attr("href")||"").split(/[;,]/).forEach(addEmail);}catch{/* Invalid encoding. */}});
  $("a[href^='tel:']").each((_,e)=>addPhone($(e).attr("href")||""));
  $("script,style,noscript,svg,template,[hidden],[aria-hidden='true']").remove();
  const text=$("body").text();
  for(const email of text.match(/[A-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[])addEmail(email.trim());
  for(const phone of text.match(/(?:\+1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}(?:\s*(?:ext\.?|x)\s*\d{1,6})?/gi)||[])addPhone(phone);
  const links:string[]=[];
  $("a[href]").each((_,e)=>{const href=$(e).attr("href")||"",label=$(e).text();if(!/contact|about|location/i.test(href+" "+label))return;try{const link=new URL(href,url);link.hash="";if(link.origin===new URL(url).origin&&!/\.(pdf|jpe?g|png|zip)$/i.test(link.pathname))links.push(link.href);}catch{/* Malformed URLs. */}});
  return {emails:[...emails].slice(0,20).map(value=>({value,sourceUrl:url})),phones:[...phones.values()].slice(0,10),links:[...new Set(links)].sort((a,b)=>Number(/contact/i.test(b))-Number(/contact/i.test(a))).slice(0,4)};
}
function usableWebsite(value:string){const url=validateRemoteUrl(value);if(BLOCKED_HOST.test(url.hostname))throw new Error("This is a directory/social platform, not an enabled business website source.");return url;}
export async function lookupBusinessWebsite(lead:Lead,repo:Repository=repository()):Promise<string> {
  if(lead.website)return usableWebsite(lead.website).href;
  if(!process.env.BRAVE_SEARCH_API_KEY||process.env.SEARCH_STORAGE_RIGHTS_CONFIRMED!=="true")throw new Error("No website listed. Optional web search requires BRAVE_SEARCH_API_KEY and storage rights for the chosen API plan; you can also add the correct website manually.");
  const cacheKey=`website-search:${lead.id}`,cached=repo.cacheGet<string>(cacheKey);if(cached)return cached;
  repo.takeQuota(`search:${new Date().toISOString().slice(0,7)}`,Number(process.env.SEARCH_MONTHLY_REQUEST_LIMIT||100));
  const apiUrl=new URL("https://api.search.brave.com/res/v1/web/search");apiUrl.search=new URLSearchParams({q:`"${lead.name}" "${lead.city.replace(/ area$/,"")}" ${lead.state} official website`,count:"5",country:"US"}).toString();
  const response=await safeFetch(apiUrl.href,1_000_000,0,apiUrl.origin,{headers:{"X-Subscription-Token":process.env.BRAVE_SEARCH_API_KEY},timeoutMs:12000});
  if(response.status!==200)throw new Error(`Website search returned ${response.status}. No automatic retry.`);
  const results=(JSON.parse(response.text).web?.results||[]) as {url:string;title:string;description?:string}[];
  const tokens=lead.name.toLowerCase().replace(/\b(llc|inc|pllc|the|group|company|co)\b/g,"").match(/[a-z0-9]{3,}/g)||[];
  const candidates=results.filter(r=>{try{usableWebsite(r.url);const evidence=(r.title+" "+r.description).toLowerCase();return tokens.length>0&&tokens.filter(t=>evidence.includes(t)).length/ tokens.length>=0.75&&evidence.includes(lead.city.replace(/ area$/,"").toLowerCase());}catch{return false;}});
  const hosts=new Set(candidates.map(c=>new URL(c.url).hostname.replace(/^www\./,"")));
  if(hosts.size!==1)throw new Error("Website identity is uncertain. Review candidates and enter the correct business website manually.");
  const website=new URL(candidates[0].url).origin;repo.cacheSet(cacheKey,website,30*86400);return website;
}
export async function researchWebsite(lead:Lead,repo:Repository=repository()) {
  const website=await lookupBusinessWebsite(lead,repo),url=usableWebsite(website);
  const robotsUrl=new URL("/robots.txt",url).href;
  const robots=await safeFetch(robotsUrl,250_000,0,url.origin,{allowWebsiteRedirects:true});
  if(![200,404].includes(robots.status))throw new Error(`Website robots access is unavailable (${robots.status}); research paused.`);
  const rules=robotsParser(robotsUrl,robots.status===200?robots.text:"");
  const delay=Math.max(2,rules.getCrawlDelay("DataSoftLocalResearch")||0);
  if(delay>30)throw new Error("Website requests a long crawl delay; use manual research for this business.");
  const pages=[url.href],visited=new Set<string>(),emails=new Map<string,{value:string;sourceUrl:string}>(),phones=new Map<string,{value:string;sourceUrl:string;e164:string}>();
  const failures:string[]=[];let bytes=0;
  for(let index=0;index<pages.length&&visited.size<3;index++){
    const page=pages[index];if(visited.has(page)||rules.isAllowed(page,"DataSoftLocalResearch")===false)continue;
    await new Promise(resolve=>setTimeout(resolve,delay*1000));
    try{
      const response=await safeFetch(page,Math.min(2_000_000,5_000_000-bytes),0,url.origin,{allowWebsiteRedirects:true});visited.add(page);bytes+=response.body.length;
      if(response.status!==200||!response.contentType.includes("html")){failures.push(`${response.status} at ${new URL(page).pathname}`);if([401,403,429].includes(response.status))break;continue;}
      const found=extractPublicContacts(response.text,response.url);for(const email of found.emails)emails.set(email.value,email);for(const phone of found.phones)phones.set(phone.e164,phone);
      if(index===0)for(const link of found.links)if(!pages.includes(link))pages.push(link);
    }catch(error){failures.push(error instanceof Error?error.message:"Page unavailable");break;}
  }
  if(!visited.size)throw new Error("No permitted contact pages could be read. No contacts were guessed.");
  const notes=`Read ${visited.size} permitted public pages; found ${emails.size} public email(s) and ${phones.size} public phone(s). Public listing is not deliverability verification or outreach consent.${failures.length?` Some pages were unavailable: ${failures.join("; ")}`:""}`;
  return repo.enrichLead(lead.id,{website,emails:[...emails.values()],phones:[...phones.values()],notes,sourceUrl:website});
}
