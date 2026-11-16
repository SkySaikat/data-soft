import nodemailer from "nodemailer";
import { resolveMx } from "node:dns/promises";
import { z } from "zod";
import { repository, type Repository } from "./db";

export function mailConfig() {
  const port=Number(process.env.SMTP_PORT||587),secure=process.env.SMTP_SECURE==="true";
  const values={host:process.env.SMTP_HOST||"",user:process.env.SMTP_USER||"",pass:process.env.SMTP_PASS||"",from:process.env.SMTP_FROM||"",replyTo:process.env.SMTP_REPLY_TO||process.env.SMTP_FROM||"",agency:process.env.AGENCY_NAME||"",postalAddress:process.env.AGENCY_POSTAL_ADDRESS||""};
  const missing:string[]=[];
  for(const [key,value] of Object.entries(values))if(!value)missing.push(key);
  for(const name of ["EMAIL_CHANNEL_APPROVED","EMAIL_REPLY_MONITORING_CONFIRMED","EMAIL_AUTHENTICATION_CONFIRMED"])if(process.env[name]!=="true")missing.push(name);
  if(!z.email().safeParse(values.from).success||!z.email().safeParse(values.replyTo).success)missing.push("valid sender/reply email");
  if(!Number.isInteger(port)||port<1||port>65535)missing.push("valid SMTP port");
  return {...values,port,secure,dailyLimit:Math.max(1,Math.min(500,Number(process.env.EMAIL_DAILY_LIMIT||20)||20)),ready:missing.length===0,missing};
}
export function publicMailConfig(){const {pass,user,...config}=mailConfig();void pass;void user;return config;}
function smtpTransport() {
  const config=mailConfig();
  return nodemailer.createTransport({host:config.host,port:config.port,secure:config.secure,requireTLS:!config.secure,auth:{user:config.user,pass:config.pass},connectionTimeout:12000,greetingTimeout:12000,socketTimeout:25000,disableFileAccess:true,disableUrlAccess:true,tls:{rejectUnauthorized:true}});
}
export async function verifyMailConnection() {const config=mailConfig();if(!config.ready)throw new Error(`Complete email settings first: ${config.missing.join(", ")}`);const transport=smtpTransport();try{await transport.verify();return {ok:true,message:"SMTP connection and authentication succeeded. This does not verify inbox placement or recipient consent."};}finally{transport.close();}}
export const sendSchema=z.object({id:z.string().uuid(),leadId:z.string().uuid(),recipient:z.email().max(254),subject:z.string().trim().min(3).max(200).refine(s=>!/[\r\n]/.test(s),"Subject cannot contain newlines").refine(s=>!/^\s*(re|fw|fwd)\s*:/i.test(s),"First messages cannot imply an existing thread"),body:z.string().trim().min(20).max(12000),reviewed:z.literal(true),reviewNote:z.string().trim().min(10).max(1000)});
export type SendInput=z.infer<typeof sendSchema>;
type Sender={sendMail:(message:Record<string,unknown>)=>Promise<{accepted?:unknown[];rejected?:unknown[];messageId?:string}>};
type MailPolicy={ready:boolean;missing:string[];from:string;replyTo:string;agency:string;postalAddress:string;dailyLimit:number};
export function renderMail(body:string,config:Pick<MailPolicy,"agency"|"postalAddress"|"replyTo">) {
  if(/\{\{|\}\}|\[(your name|agency|valid postal address|sender|company)/i.test(body))throw new Error("Replace template placeholders before sending.");
  return `${body.trim()}\n\n${config.agency}\n${config.postalAddress}\nBusiness advertisement for our agency services.\nTo stop future marketing emails, reply “unsubscribe” to ${config.replyTo}.`;
}
export async function recipientDomainCheck(email:string) {
  const domain=email.split("@")[1];
  try{const records=await resolveMx(domain);return records.some(r=>r.exchange&&r.exchange!==".");}catch{return false;}
}
export async function sendReviewedEmail(raw:unknown,dependencies?:{repo:Repository;sender:Sender;config:MailPolicy;domainCheck:(email:string)=>Promise<boolean>}) {
  const input=sendSchema.parse(raw),repo=dependencies?.repo||repository(),config=dependencies?.config||mailConfig();
  if(!config.ready)throw new Error(`Email sending is not configured: ${config.missing.join(", ")}`);
  const lead=repo.getLead(input.leadId,"live");if(!lead)throw new Error("Only live business contacts can receive emails. Sample businesses cannot be emailed.");
  const known=new Set([lead.email,...(lead.contacts||[]).filter(c=>c.kind==="email").map(c=>c.value)].filter(Boolean).map(v=>v.toLowerCase()));
  if(!known.has(input.recipient.toLowerCase()))throw new Error("Choose a recorded business email from this lead's contact information.");
  if(/^(abuse|privacy|security|dpo|postmaster|no-?reply|emergency|patient)@/i.test(input.recipient))throw new Error("This role address is not eligible for agency marketing outreach.");
  if(repo.isSuppressed(input.recipient))throw new Error("This recipient has opted out or was marked do-not-contact.");
  const body=renderMail(input.body,config);
  const domainCheck=dependencies?.domainCheck||recipientDomainCheck;
  if(!await domainCheck(input.recipient))throw new Error("Recipient domain has no confirmed mail routing. Review the address; this check does not verify mailbox deliverability.");
  repo.reviewContact(lead.id,input.recipient,input.reviewNote);
  const reservation=repo.reserveMessage({...input,body},config.dailyLimit);
  if(!reservation.created)return {id:input.id,status:reservation.status,duplicate:true,message:"This request already exists in send history. It was not submitted again."};
  // A reply/opt-out entered while DNS was checked must still prevent submission.
  if(repo.isSuppressed(input.recipient)){repo.finishMessage(input.id,"blocked","","Do-not-contact request received before submission.");throw new Error("Recipient is now suppressed. Nothing was sent.");}
  const transport=dependencies?.sender||smtpTransport();
  try{
    const response=await transport.sendMail({from:{name:config.agency,address:config.from},to:input.recipient,replyTo:config.replyTo,subject:input.subject,text:body,messageId:`<${input.id}@${config.from.split("@")[1]}>`,disableFileAccess:true,disableUrlAccess:true});
    if(!response.accepted?.length){repo.finishMessage(input.id,"failed","","SMTP server did not accept the recipient.");return {id:input.id,status:"failed",message:"SMTP server did not accept the recipient. Review send history."};}
    repo.finishMessage(input.id,"accepted",response.messageId||"");
    return {id:input.id,status:"accepted",message:"Your SMTP server accepted this email. Inbox placement and delivery are not confirmed."};
  }catch(error){const smtp=error as {code?:string;command?:string;responseCode?:number};const definitive=smtp.code==="EAUTH"||smtp.command==="CONN"||smtp.command==="AUTH"||Boolean(smtp.responseCode&&smtp.responseCode>=500);const status=definitive?"failed":"uncertain";const message=definitive?"SMTP connection, authentication or recipient was rejected. Check your provider settings.":"Submission ended without a reliable acceptance result. Do not resend until you check your provider's logs.";repo.finishMessage(input.id,status,"",message);return {id:input.id,status,message};}
  finally{if(!dependencies)(transport as ReturnType<typeof smtpTransport>).close();}
}
