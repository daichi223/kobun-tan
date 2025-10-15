import { describe, it, expect, vi, beforeEach } from "vitest";

// same lightweight mock infra as above:
class Doc { constructor(public id:string, public dataObj:any){} get(){return Promise.resolve({exists:!!this.dataObj, data:()=>this.dataObj});} update(p:any){Object.assign(this.dataObj,p); return Promise.resolve();} set(p:any){this.dataObj=p; return Promise.resolve();} }
class Snapshot { constructor(public docs:Doc[]){} }
class Query {
  constructor(private arr:Doc[]){};
  where(){ return this; }
  limit(){ return this; }
  async get(){ return new Snapshot(this.arr); }
}
class Collection {
  docs = new Map<string, Doc>();
  doc(id?:string){ const k=id??Math.random().toString(36).slice(2); if(!this.docs.has(k)) this.docs.set(k,new Doc(k,null)); return this.docs.get(k)!; }
  add(p:any){ const d=this.doc(); d.set(p); return Promise.resolve({id:d.id}); }
  where(){ return new Query([...this.docs.values()]); }
}
const answers = new Collection();
const overrides = new Collection();
const dbMock = {
  collection: (name:string)=> name==="answers" ? answers : overrides,
  batch: ()=>({ update:()=>{}, commit:()=>Promise.resolve() }),
  runTransaction: (fn:(tx:any)=>any)=> fn({ get:(ref:Doc)=>ref.get(), set:(ref:Doc,p:any)=>ref.set(p) })
};

vi.mock("./_firebaseAdmin", () => ({ db: dbMock }));

import handler from "./upsertOverride";
import { makeKey } from "./_normalize";

const req = (body:any)=>({ method:"POST", body } as any);
const res = ()=>{ const r:any = { code:200, jsonBody:null }; r.status=(c:number)=>{ r.code=c; return r; }; r.json=(b:any)=>{ r.jsonBody=b; return r; }; return r; };

describe("upsertOverride", () => {
  beforeEach(()=>{ answers.docs.clear(); overrides.docs.clear(); });

  it("apply override updates matching attempts (manual excluded)", async () => {
    const key = makeKey("4-2", "はっと目が覚めた");
    // matching attempt (no manual)
    const a1 = answers.doc("x1"); await a1.set({ raw:{ qid:"4-2" }, curated:{ answerNorm:key.split("::")[1] }, final:{ result:"NG", source:"auto" } });
    // manual exists -> should be ignored
    const a2 = answers.doc("x2"); await a2.set({ raw:{ qid:"4-2" }, curated:{ answerNorm:key.split("::")[1] }, manual:{ result:"NG" }, final:{ result:"NG", source:"manual" } });

    const response:any = res();
    await handler(req({ key, label:"OK", active:true, actor:"t1" }), response);

    expect(response.code).toBe(200);
    expect(response.jsonBody.updated).toBe(1);
    // a1 should be updated to override
    const after1:any = (await a1.get()).data();
    expect(after1.final.source).toBe("override");
    expect(after1.final.result).toBe("OK");
    // a2 manual untouched
    const after2:any = (await a2.get()).data();
    expect(after2.final.source).toBe("manual");
  });
});
